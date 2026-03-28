import React, { useState, useEffect } from 'react';
import { Search, Receipt, FileText, CheckCircle2, Clock, Copy, Check, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

export const BillingView = ({ appointments, clients, apiFetch }: any) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'invoices' | 'deposits' | 'bdc'>('all');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true);
      try {
        const res = await apiFetch('/api/abby/documents');
        if (res.ok) {
          const data = await res.json();
          setInvoices(data);
        }
      } catch (e) {
        console.error("Erreur téléchargement Abby docs:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [apiFetch]);

  const filteredInvoices = invoices.filter(inv => {
    const query = searchQuery.toLowerCase();
    // Sécurité : on vérifie que le client et l'id existent avant de faire toLowerCase()
    const clientName = inv.client || "";
    const invId = inv.id || "";
    const matchesSearch = clientName.toLowerCase().includes(query) || invId.toLowerCase().includes(query);

    let matchesType = true;
    if (filter === 'invoices') matchesType = inv.type === 'Facture';
    if (filter === 'deposits') matchesType = inv.type === "Facture d'acompte";
    if (filter === 'bdc') matchesType = inv.type === 'Bon de commande' || inv.type === 'Devis';

    let matchesStatus = true;
    if (hideCompleted && inv.status === 'paid') {
      matchesStatus = false;
    }

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleCopyId = (internalId: string) => {
    navigator.clipboard.writeText(internalId);
    setCopiedId(internalId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-1">Facturation</h2>
          <p className="text-gray-400 text-sm">Gérez vos devis et factures Abby</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher (client, ref)..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card-bg border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-lilas/50"
            />
          </div>
        </div>
      </div>

      {/* TABS (Filtres) */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 custom-scrollbar">
        <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filter === 'all' ? 'bg-lilas text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
          Tous les documents
        </button>
        <button onClick={() => setFilter('bdc')} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filter === 'bdc' ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
          Bons de commande
        </button>
        <button onClick={() => setFilter('deposits')} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filter === 'deposits' ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
          Acomptes
        </button>
        <button onClick={() => setFilter('invoices')} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filter === 'invoices' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
          Factures finales
        </button>

        <div className="ml-auto pl-4 flex items-center">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} className="form-checkbox text-lilas rounded border-white/20 bg-white/5" />
            <span className="text-sm text-gray-400 whitespace-nowrap">Masquer les encaissés</span>
          </label>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <RefreshCw className="animate-spin text-lilas mb-4" size={32} />
            <p>Synchronisation avec Abby en cours...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Receipt size={48} className="mb-4 opacity-20" />
            <p>Aucun document trouvé.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-4 font-medium">Référence & Copie ID</th>
                  <th className="px-6 py-4 font-medium">Client</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium text-right">Montant</th>
                  <th className="px-6 py-4 font-medium text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 font-mono text-sm text-gray-300">
                      <div className="flex items-center space-x-3">
                        <span className="text-lilas font-bold">{inv.id}</span>
                        {/* BOUTON COPIER ID SECRET */}
                        <button 
                          onClick={() => handleCopyId(inv.internalId)}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] text-gray-400 transition-all flex items-center space-x-1"
                          title="Copier l'ID interne pour Dataverse"
                        >
                          {copiedId === inv.internalId ? <><Check size={12} className="text-emerald-400" /><span className="text-emerald-400">Copié</span></> : <><Copy size={12} /><span>Copier ID</span></>}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{inv.client}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        {inv.type.includes('commande') ? <FileText size={14} className="text-blue-400" /> : <Receipt size={14} className={inv.type.includes('acompte') ? 'text-amber-400' : 'text-emerald-400'} />}
                        <span>{inv.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">{inv.date}</td>
                    <td className="px-6 py-4 text-right font-bold">{inv.amount}€</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        inv.status === 'sent' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}>
                        {inv.status === 'paid' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        <span>{inv.statusLabel}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};