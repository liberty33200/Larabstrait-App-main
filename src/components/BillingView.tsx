import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Receipt,
  FileCheck,
  FilePlus,
  RefreshCw,
  Calendar // <-- Nouvel import
} from 'lucide-react';

interface BillingViewProps {
  appointments: any[];
  clients: any[];
  apiFetch: (url: string, options?: any) => Promise<Response>;
  key?: string;
}

export const BillingView = ({ appointments, clients, apiFetch }: BillingViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all, invoices, quotes, pos
  const [hideCompleted, setHideCompleted] = useState(true);
  const [timeFilter, setTimeFilter] = useState('month'); // NOUVEAU : Filtre temporel (month, last_month, year, all)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const docsRes = await apiFetch('/api/abby/documents');
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setInvoices(docsData);
        if (docsData.length === 0) {
          const debugRes = await apiFetch('/api/abby/test-debug');
          if (debugRes.ok) {
            setDebugInfo(await debugRes.json());
          }
        }
      } else if (docsRes.status === 401) {
        setHasApiKey(false);
      }
    } catch (err) {
      console.error("Erreur fetch documents:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const keyRes = await apiFetch('/api/settings/abby');
        if (keyRes.ok) {
          const keyData = await keyRes.json();
          const keyExists = !!keyData.abby_api_key;
          setHasApiKey(keyExists);

          if (keyExists) {
            await fetchDocuments();
          }
        }
      } catch (err) {
        console.error("Erreur initialisation Billing:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleCreateDocument = async (appt: any, type: string) => {
    if (!hasApiKey) {
      alert("Veuillez d'abord configurer votre clé API Abby dans les paramètres.");
      return;
    }
    
    setIsCreating(`${appt.id}-${type}`);
    try {
      const res = await apiFetch('/api/abby/create-document', {
        method: 'POST',
        body: JSON.stringify({ appointment: appt, type }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
      } else {
        alert(data.error || "Erreur lors de la création du document.");
      }
    } catch (err) {
      alert("Erreur réseau lors de la création du document.");
    } finally {
      setIsCreating(null);
    }
  };

  const handleDownloadPDF = async (inv: any) => {
    try {
      const res = await apiFetch(`/api/abby/documents/${inv.internalId}/pdf`);
      if (!res.ok) throw new Error("Erreur lors du téléchargement");
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.type}_${inv.id}.pdf`; 
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert("Impossible de télécharger le PDF. Le document n'est peut-être pas encore généré par Abby.");
    }
  };

  const handlePreviewPDF = async (inv: any) => {
    try {
      const res = await apiFetch(`/api/abby/documents/${inv.internalId}/pdf?inline=true`);
      if (!res.ok) throw new Error("Erreur lors de la récupération");
      
      const blob = await res.blob();
      const file = new Blob([blob], { type: 'application/pdf' });
      const url = URL.createObjectURL(file);
      
      window.open(url, '_blank');
      
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      alert("Impossible de prévisualiser le PDF.");
    }
  };

  // --- LOGIQUE DES STATISTIQUES ---
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const isDateInPeriod = (dateStr: string, period: string) => {
    if (period === 'all') return true;
    if (!dateStr || dateStr === 'N/A') return false;
    
    // Convertir "DD/MM/YYYY" en Date Javascript
    const parts = dateStr.split('/');
    if (parts.length !== 3) return false;
    const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    
    if (period === 'month') {
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }
    if (period === 'last_month') {
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const yearOfLastMonth = currentMonth === 0 ? currentYear - 1 : currentYear;
      return d.getMonth() === lastMonth && d.getFullYear() === yearOfLastMonth;
    }
    if (period === 'year') {
      return d.getFullYear() === currentYear;
    }
    return true;
  };

  const statsInvoices = invoices.filter(inv => isDateInPeriod(inv.date, timeFilter));
  
  let pendingAmount = 0;
  let pendingCount = 0;
  let paidAmount = 0;
  let poAmount = 0;

  statsInvoices.forEach(inv => {
    // En attente (Factures envoyées/finalisées mais non payées)
    if (inv.type === 'Facture' && inv.status === 'sent') {
      pendingAmount += inv.amount;
      pendingCount++;
    }
    // Encaissé (Factures payées)
    if (inv.type === 'Facture' && inv.status === 'paid') {
      paidAmount += inv.amount;
    }
    // Bons de commande générés
    if (inv.type === 'Bon de commande') {
      poAmount += inv.amount;
    }
  });

  // --- LOGIQUE DU TABLEAU ---
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          inv.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesType = true;
    if (filter === 'invoices') matchesType = inv.type === 'Facture';
    if (filter === 'quotes') matchesType = inv.type === 'Devis';
    if (filter === 'pos') matchesType = inv.type === 'Bon de commande';

    let matchesStatus = true;
    if (hideCompleted && inv.status === 'paid') {
      matchesStatus = false;
    }

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Facturation</h2>
          <p className="text-gray-400 mt-1">Gérez vos devis, bons de commande et factures via Abby.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {loading && <RefreshCw size={20} className="text-lilas animate-spin mr-2" />}
          <button className="btn-primary flex items-center space-x-2">
            <Plus size={20} />
            <span>Nouveau document</span>
          </button>
        </div>
      </div>

      {/* Zone des Cartes de Statistiques avec Filtre Temporel */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Vue d'ensemble</h3>
          <div className="flex items-center space-x-2 bg-white/5 rounded-xl p-1 border border-white/10">
            <Calendar size={16} className="text-gray-400 ml-3" />
            <select 
              value={timeFilter} 
              onChange={(e) => setTimeFilter(e.target.value)}
              className="bg-transparent border-none text-sm font-medium text-white focus:outline-none focus:ring-0 py-1 pr-4 pl-2 cursor-pointer appearance-none"
            >
              <option value="month" className="bg-[#1a1a1a]">Ce mois</option>
              <option value="last_month" className="bg-[#1a1a1a]">Le mois dernier</option>
              <option value="year" className="bg-[#1a1a1a]">Cette année</option>
              <option value="all" className="bg-[#1a1a1a]">Toujours</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">En attente (Factures)</span>
              <Clock size={20} className="text-amber-400" />
            </div>
            <div className="text-2xl font-bold">{pendingAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
            <div className="text-xs text-amber-400/80">{pendingCount} facture(s) en attente</div>
          </div>
          
          <div className="glass-card p-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Encaissé (Factures)</span>
              <CheckCircle2 size={20} className="text-emerald-400" />
            </div>
            <div className="text-2xl font-bold">{paidAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
            <div className="text-xs text-emerald-400/80">Sur la période sélectionnée</div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher une facture ou un client..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-lilas/50 transition-all"
          />
        </div>
        
        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${filter === 'all' ? 'bg-lilas text-black' : 'bg-white/5 hover:bg-white/10 text-gray-400'}`}
          >
            Tous
          </button>
          <button 
            onClick={() => setFilter('pos')}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filter === 'pos' ? 'bg-lilas text-black' : 'bg-white/5 hover:bg-white/10 text-gray-400'}`}
          >
            Bons de commande
          </button>
          <button 
            onClick={() => setFilter('quotes')}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filter === 'quotes' ? 'bg-lilas text-black' : 'bg-white/5 hover:bg-white/10 text-gray-400'}`}
          >
            Devis
          </button>
          <button 
            onClick={() => setFilter('invoices')}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filter === 'invoices' ? 'bg-lilas text-black' : 'bg-white/5 hover:bg-white/10 text-gray-400'}`}
          >
            Factures
          </button>

          <div className="w-px h-6 bg-white/10 mx-1"></div>

          <button 
            onClick={() => setHideCompleted(!hideCompleted)}
            className={`px-3 py-2 flex items-center space-x-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${hideCompleted ? 'bg-white/10 text-white' : 'bg-white/5 hover:bg-white/10 text-gray-400'}`}
            title="Masquer/Afficher les documents signés ou encaissés"
          >
            <Filter size={16} />
            <span>{hideCompleted ? 'En cours' : 'Tous les statuts'}</span>
          </button>
          
          <button 
            onClick={fetchDocuments}
            disabled={loading}
            className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-lilas transition-all disabled:opacity-50"
            title="Actualiser"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Référence</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Client</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Type</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Montant</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Statut</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredInvoices.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 italic">
                    {hasApiKey === false 
                      ? "Veuillez configurer votre clé API Abby dans les paramètres pour voir vos documents."
                      : "Aucun document ne correspond à vos filtres."}
                  </td>
                </tr>
              )}
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 font-mono text-sm text-lilas">{inv.id}</td>
                  <td className="px-6 py-4 font-medium">{inv.client}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{inv.type}</td>
                  <td className="px-6 py-4 font-bold">{inv.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{inv.date}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      inv.status === 'sent' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                    }`}>
                      {inv.statusLabel || 'Brouillon'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleDownloadPDF(inv)}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all" 
                        title="Télécharger PDF"
                      >
                        <Download size={16} />
                      </button>
                      <button 
                        onClick={() => handlePreviewPDF(inv)}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all" 
                        title="Visualiser le document"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Debug Info if empty */}
      {hasApiKey && invoices.length === 0 && !loading && debugInfo && (
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-mono text-gray-500 overflow-hidden">
          <p className="mb-2 font-bold text-gray-400 uppercase tracking-widest">DIAGNOSTIC TECHNIQUE :</p>
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}

      {/* Abby Integration Banner */}
      <div className={`p-6 bg-gradient-to-r ${hasApiKey ? 'from-emerald-500/10' : 'from-lilas/20'} to-transparent border ${hasApiKey ? 'border-emerald-500/20' : 'border-lilas/20'} rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6`}>
        <div className="flex items-center space-x-4">
          <div className={`w-12 h-12 ${hasApiKey ? 'bg-emerald-500 text-white' : 'bg-lilas text-black'} rounded-xl flex items-center justify-center`}>
            {hasApiKey ? <FileCheck size={24} /> : <Receipt size={24} />}
          </div>
          <div>
            <h3 className="font-bold text-lg">{hasApiKey ? 'Compte Abby Connecté' : 'Liez votre compte Abby'}</h3>
            <p className="text-sm text-gray-400">
              {hasApiKey 
                ? 'Votre compte est correctement lié. Vos documents Abby sont synchronisés.' 
                : 'Automatisez la création de vos factures et bons de commande en connectant Larabstrait à Abby.'}
            </p>
          </div>
        </div>
        {!hasApiKey && (
          <button className="px-6 py-3 bg-lilas text-black font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-lilas/20">
            Configurer l'API Abby
          </button>
        )}
      </div>
    </motion.div>
  );
};