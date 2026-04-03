import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, FileText, RefreshCw, Download, Eye, Phone, Instagram, Edit2, Save } from 'lucide-react';

export const ClientsView = ({ clients, appointments, onSelectAppointment, apiFetch, onUpdate }: any) => {
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [sortBy, setSortBy] = useState('alpha');

  const [clientDocuments, setClientDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Nouveaux états pour l'édition des contacts
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ phone: '', instagram: '' });

  useEffect(() => {
    const checkKey = async () => {
      if (!apiFetch) return;
      try {
        const res = await apiFetch('/api/settings/abby');
        if (res.ok) {
          const data = await res.json();
          setHasApiKey(!!data.abby_api_key);
        }
      } catch (err) {
        console.error("Erreur check clé Abby:", err);
      }
    };
    checkKey();
  }, [apiFetch]);

  useEffect(() => {
    const fetchClientDocuments = async () => {
      if (!hasApiKey || !selectedClient || !apiFetch) return;
      setLoadingDocs(true);
      try {
        const res = await apiFetch('/api/abby/documents');
        if (res.ok) {
          const allDocs = await res.json();
          const clientName = (selectedClient.displayName || `${selectedClient.firstName || ''} ${selectedClient.lastName || ''}`).toLowerCase().trim();
          
          const matchingDocs = allDocs.filter((doc: any) => {
            if (!doc || !doc.client) return false;
            return doc.client.toLowerCase().includes(clientName) || clientName.includes(doc.client.toLowerCase());
          });
          setClientDocuments(matchingDocs);
        }
      } catch (err) {
        console.error("Erreur fetch documents:", err);
      } finally {
        setLoadingDocs(false);
      }
    };
    fetchClientDocuments();
  }, [hasApiKey, selectedClient, apiFetch]);

  const handleDownloadPDF = async (inv: any) => {
    if (!apiFetch) return;
    try {
      const res = await apiFetch(`/api/abby/documents/${inv.internalId}/pdf`);
      if (!res.ok) throw new Error("Erreur");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.type}_${inv.id}.pdf`; 
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) { alert("Impossible de télécharger le PDF."); }
  };

  const handlePreviewPDF = async (inv: any) => {
    if (!apiFetch) return;
    try {
      const res = await apiFetch(`/api/abby/documents/${inv.internalId}/pdf?inline=true`);
      if (!res.ok) throw new Error("Erreur");
      const blob = await res.blob();
      const file = new Blob([blob], { type: 'application/pdf' });
      const url = URL.createObjectURL(file);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) { alert("Impossible de prévisualiser le PDF."); }
  };

  const clientsWithStats = useMemo(() => {
    return clients.map((client: any) => {
      const clientAppts = appointments.filter((appt: any) => {
        if (appt.isTimeOff) return false;
        const apptEmail = (appt.clientEmail || "").toLowerCase().trim();
        const clientEmail = (client.email || "").toLowerCase().trim();
        if (clientEmail && apptEmail && apptEmail === clientEmail) return true;
        if (!clientEmail && !apptEmail) {
          const apptName = (appt.client || "").toLowerCase().trim();
          const clientName = (client.displayName || client.firstName || "").toLowerCase().trim();
          return apptName && apptName === clientName;
        }
        return false;
      });

      const totalSpent = clientAppts.reduce((sum: number, appt: any) => {
        const amount = typeof appt.total === 'number' ? appt.total : parseFloat(String(appt.total || appt.price || 0).replace(/[^\d.-]/g, '')) || 0;
        return sum + amount;
      }, 0);

      // On récupère le tel/insta depuis le rendez-vous le plus récent de ce client
      let latestPhone = '';
      let latestInsta = '';
      const sortedAppts = [...clientAppts].sort((a: any, b: any) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());
      if (sortedAppts.length > 0) {
        const latest = sortedAppts[0];
        latestPhone = latest.phone || '';
        latestInsta = latest.instagram || '';
      }
      
      return { 
        ...client, 
        appointmentCount: clientAppts.length, 
        totalSpent,
        phone: latestPhone,
        instagram: latestInsta,
        appointments: clientAppts // On stocke les RDV pour l'update Postgres
      };
    });
  }, [clients, appointments]);

  const sortedClients = useMemo(() => {
    const list = [...clientsWithStats];
    if (sortBy === 'alpha') return list.sort((a, b) => (a.displayName || a.firstName || "").localeCompare(b.displayName || b.firstName || ""));
    if (sortBy === 'appointments') return list.sort((a, b) => b.appointmentCount - a.appointmentCount);
    if (sortBy === 'spending') return list.sort((a, b) => b.totalSpent - a.totalSpent);
    return list;
  }, [clientsWithStats, sortBy]);

  const handleSelectClient = (client: any) => {
    setSelectedClient(client);
    setEditForm({ phone: client.phone || '', instagram: client.instagram || '' });
    setIsEditing(false);
  };

  const handleSaveContactInfo = async () => {
    if (!selectedClient || !apiFetch) return;
    setSaving(true);
    try {
      // 🎯 MODIFICATION ICI : On utilise les noms Postgres pour la mise à jour
      const updatePromises = selectedClient.appointments.map((app: any) => 
        apiFetch(`/api/appointments/${app.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_phone: editForm.phone,
            instagram: editForm.instagram
          })
        })
      );

      await Promise.all(updatePromises);
      
      // Mise à jour locale pour que l'affichage change de suite
      setSelectedClient({ ...selectedClient, phone: editForm.phone, instagram: editForm.instagram });
      setIsEditing(false);
      if (onUpdate) onUpdate(); 
      
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du client", error);
      alert("Une erreur est survenue lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  if (selectedClient) {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={() => setSelectedClient(null)} className="p-2 hover:bg-white/5 rounded-xl transition-all text-gray-400 hover:text-white">
              <ChevronRight size={24} className="rotate-180" />
            </button>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">{selectedClient.displayName || `${selectedClient.firstName} ${selectedClient.lastName}`}</h2>
              <p className="text-gray-400 text-sm md:text-base">{selectedClient.email}</p>
            </div>
          </div>
          
          {/* BOUTONS D'ÉDITION */}
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all flex items-center space-x-2">
              <Edit2 size={16} /><span>Modifier contact</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium transition-all">Annuler</button>
              <button onClick={handleSaveContactInfo} disabled={saving} className="px-4 py-2 bg-lilas text-black rounded-xl text-sm font-bold transition-all flex items-center space-x-2 disabled:opacity-50">
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
              </button>
            </div>
          )}
        </div>

        {/* NOUVELLE SECTION CONTACT */}
        <div className="glass-card p-6 border-t-4 border-lilas">
          <h3 className="font-bold text-lg mb-4">Coordonnées</h3>
          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase block mb-1 ml-1">Téléphone</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-lilas" />
                  <input type="tel" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} placeholder="Ex: 06 12 34 56 78" className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-lilas/50 text-white transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase block mb-1 ml-1">Instagram</label>
                <div className="relative">
                  <Instagram size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-lilas" />
                  <input type="text" value={editForm.instagram} onChange={e => setEditForm({...editForm, instagram: e.target.value})} placeholder="Ex: @pseudo" className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-lilas/50 text-white transition-colors" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex items-center space-x-3 text-gray-300">
                <div className="p-2 bg-white/5 rounded-lg border border-white/10"><Phone size={18} className={selectedClient.phone ? "text-lilas" : "text-gray-500"} /></div>
                <span className="font-medium">{selectedClient.phone || <span className="italic text-gray-600 font-normal">Aucun numéro</span>}</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-300">
                <div className="p-2 bg-white/5 rounded-lg border border-white/10"><Instagram size={18} className={selectedClient.instagram ? "text-lilas" : "text-gray-500"} /></div>
                <span className="font-medium">{selectedClient.instagram || <span className="italic text-gray-600 font-normal">Aucun Instagram</span>}</span>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-white/5">
            <h3 className="font-bold text-lg">Historique des rendez-vous</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="p-4 text-xs font-bold uppercase text-gray-500">Date</th>
                  <th className="p-4 text-xs font-bold uppercase text-gray-500">Style / Projet</th>
                  <th className="p-4 text-xs font-bold uppercase text-gray-500">Statut</th>
                  <th className="p-4 text-xs font-bold uppercase text-gray-500 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {selectedClient.appointments && selectedClient.appointments.length > 0 ? (
                  selectedClient.appointments.map((appt: any) => (
                    <tr 
                      key={appt.id} 
                      onClick={() => onSelectAppointment(appt)}
                      className="border-b border-white/5 hover:bg-white/[0.05] transition-colors cursor-pointer group"
                    >
                      <td className="p-4 text-sm group-hover:text-lilas transition-colors">{appt.date}</td>
                      <td className="p-4 text-sm">{appt.style}</td>
                      <td className="p-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          appt.status === 'Confirmé' || appt.status === 'Payé' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-purple-500/10 text-purple-400'
                        }`}>
                          {appt.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-bold text-right text-lilas">
                        {typeof appt.total === 'number' ? `${appt.total}€` : appt.price}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-gray-500 italic">
                      Aucun rendez-vous trouvé pour ce client.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {hasApiKey && (
          <div className="glass-card overflow-hidden mt-6">
            <div className="p-6 border-b border-white/5 flex items-center space-x-2">
              <FileText size={20} className="text-lilas" />
              <h3 className="font-bold text-lg">Documents comptables (Abby)</h3>
            </div>
            
            <div className="p-6">
              {loadingDocs ? (
                <div className="text-sm text-gray-400 flex items-center justify-center py-4">
                  <RefreshCw size={16} className="animate-spin mr-2" /> Chargement des documents...
                </div>
              ) : clientDocuments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clientDocuments.map((inv: any) => (
                    <div key={inv.id} className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-between group">
                      <div>
                        <div className="flex items-center space-x-3 mb-1">
                          <span className="font-bold text-sm">{inv.type} {inv.id}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                            inv.status === 'sent' ? 'bg-blue-500/10 text-blue-400' :
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {inv.statusLabel || 'Brouillon'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {inv.date} • <span className="font-bold text-white">{inv.amount}€</span>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleDownloadPDF(inv)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" title="Télécharger">
                          <Download size={16} />
                        </button>
                        <button onClick={() => handlePreviewPDF(inv)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" title="Aperçu">
                          <Eye size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500 italic">Aucun document Abby trouvé pour ce client.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold">Fiches clients</h2>
        <div className="flex items-center space-x-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer outline-none"
          >
            <option value="alpha" className="bg-[#141414]">Ordre Alphabétique</option>
            <option value="appointments" className="bg-[#141414]">Le plus de Rendez-vous</option>
            <option value="spending" className="bg-[#141414]">Le plus de dépenses</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedClients.map((client: any) => (
          <motion.div 
            key={client.id} 
            whileHover={{ y: -4 }}
            onClick={() => handleSelectClient(client)}
            className="glass-card p-6 cursor-pointer hover:border-lilas/30 transition-all group flex flex-col justify-between relative overflow-hidden"
          >
            {/* Liseré haut si le client a beaucoup dépensé */}
            {client.totalSpent >= 500 && <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500/50" />}

            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-lg group-hover:text-lilas transition-colors truncate pr-2">
                  {client.displayName || `${client.firstName} ${client.lastName}`}
                </h4>
                <div className="flex space-x-2 text-gray-500">
                  {client.phone && <Phone size={14} className="text-gray-400" />}
                  {client.instagram && <Instagram size={14} className="text-gray-400" />}
                </div>
              </div>
              <p className="text-gray-400 text-sm truncate">{client.email}</p>
            </div>
            
            <div className="flex justify-between items-end mt-6 pt-4 border-t border-white/5">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Rendez-vous</span>
                <span className="text-lg font-bold text-white">{client.appointmentCount}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Total dépensé</span>
                <span className="text-lg font-bold text-lilas">{client.totalSpent.toLocaleString()}€</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};