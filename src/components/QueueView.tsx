import React, { useState, useEffect } from 'react';
import { Clock, Instagram, Phone, RefreshCcw, X, Save, Trash2, CreditCard, AlignLeft, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const QueueView = ({ apiFetch }: { apiFetch: any }) => {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState('Non payé');
  const [notes, setNotes] = useState('');

  const loadQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/flashes');
      const data = await res.json();
      
      const reserved = data
        .filter((f: any) => !f.available && f.client_data)
        .map((f: any) => ({ ...f, client: JSON.parse(f.client_data) }))
        .filter((f: any) => f.client.status !== 'completed')
        .sort((a: any, b: any) => (a.client.time || '').localeCompare(b.client.time || ''));
      
      setQueue(reserved);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadQueue(); }, []);

  const openDetail = (item: any) => {
    setSelectedItem(item);
    setPaymentStatus(item.client.paymentStatus || 'Non payé');
    setNotes(item.client.notes || '');
  };

  const handleSaveDetails = async () => {
    try {
      const updatedClientData = { ...selectedItem.client, paymentStatus, notes };
      await fetch(`/api/flashes/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: false, reservationDetails: updatedClientData })
      });
      setSelectedItem(null);
      loadQueue();
    } catch (error) { alert("Erreur lors de la sauvegarde."); }
  };

 const handleCancelReservation = async () => {
    if (!window.confirm("⚠️ Attention : Cela va annuler le RDV, SUPPRIMER LA LIGNE DANS LA BASE, et remettre le dessin dispo. Confirmer ?")) return;
    
    try {
      // 1. SUPPRESSION DANS LA BASE POSTGRESQL
      const apptId = selectedItem.client.appointmentId;
      if (apptId) {
        await apiFetch(`/api/appointments/${apptId}`, { method: 'DELETE' });
        console.log("🗑️ RDV supprimé de la base de données !");
      } else {
        console.warn("⚠️ Pas d'ID de RDV trouvé, suppression du blocage local uniquement.");
      }

      // 2. Libération du flash sur le NAS local
      await fetch(`/api/flashes/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: true, reservationDetails: null })
      });

      setSelectedItem(null);
      loadQueue();
    } catch (error) { 
      alert("Erreur lors de l'annulation complète."); 
    }
  };

  const handleComplete = async () => {
    if (!window.confirm("Le tatouage est terminé ? Ce RDV disparaîtra de la file d'attente.")) return;
    
    try {
      const updatedClientData = { ...selectedItem.client, paymentStatus, notes, status: 'completed' };
      await fetch(`/api/flashes/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: false, reservationDetails: updatedClientData })
      });

      setSelectedItem(null);
      loadQueue();
    } catch (error) {
      alert("Erreur lors de la clôture du RDV.");
    }
  };

  const PaymentBadge = ({ status }: { status: string }) => {
    if (status === 'Payé') return <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase">Payé</span>;
    if (status === 'Acompte') return <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase">Acompte</span>;
    return <span className="bg-rose-500/20 text-rose-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase">Non payé</span>;
  };

  return (
    <div className="p-4 md:p-10 max-w-5xl mx-auto text-white font-sans">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Clock className="text-lilas" size={32} /> File d'attente
          </h1>
        </div>
        <button onClick={loadQueue} className="p-4 bg-zinc-900 rounded-2xl hover:bg-zinc-800 transition">
          <RefreshCcw size={20} className={loading ? 'animate-spin text-lilas' : 'text-zinc-400'} />
        </button>
      </div>

      <div className="space-y-4">
        {queue.length === 0 ? (
          <div className="text-center py-24 bg-zinc-900/50 rounded-[2.5rem] border-2 border-dashed border-zinc-800 text-zinc-500">
            <p className="text-xl font-bold">Aucun rendez-vous en attente.</p>
          </div>
        ) : (
          queue.map((item) => (
            <motion.div 
              key={item.id} 
              onClick={() => openDetail(item)}
              className="bg-zinc-900/80 border border-zinc-800 p-4 md:p-6 rounded-[2rem] flex items-center gap-6 cursor-pointer hover:border-lilas/30 transition-all shadow-lg"
            >
              <div className="text-3xl font-black text-lilas min-w-[100px]">{item.client.time}</div>
              <div className="w-16 h-16 bg-black rounded-2xl overflow-hidden shrink-0">
                <img src={`/api/flashes/images/${item.image_filename}`} className="w-full h-full object-contain p-2" alt={item.title} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold">{item.client.name}</h3>
                  <PaymentBadge status={item.client.paymentStatus || 'Non payé'} />
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-6 md:p-8 w-full max-w-md relative shadow-2xl overflow-y-auto max-h-[95vh]"
            >
              <button onClick={() => setSelectedItem(null)} className="absolute top-6 right-6 p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition"><X size={20}/></button>
              
              <h2 className="text-2xl font-black mb-1">Détails du RDV</h2>
              <p className="text-lilas font-bold mb-8">{selectedItem.client.time} - {selectedItem.client.name}</p>
              
              <div className="space-y-6 mb-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest"><CreditCard size={14} className="inline mr-1 text-lilas"/> Statut du paiement</label>
                  <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white outline-none">
                    <option value="Non payé">❌ Non payé</option>
                    <option value="Acompte">⏳ Acompte reçu</option>
                    <option value="Payé">✅ Entièrement Payé</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest"><AlignLeft size={14} className="inline mr-1 text-lilas"/> Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white outline-none resize-none" />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4 border-t border-zinc-800/50">
                <button onClick={handleComplete} className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-400 transition-all">
                  <CheckCircle2 size={18}/> Terminer & Exporter
                </button>
                <button onClick={handleSaveDetails} className="w-full bg-zinc-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest hover:bg-zinc-700 transition-all">
                  <Save size={18}/> Sauvegarder
                </button>
                <button onClick={handleCancelReservation} className="w-full text-rose-500 font-black py-4 rounded-2xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest hover:bg-rose-500/10 transition-all">
                  <Trash2 size={18}/> Annuler RDV
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};