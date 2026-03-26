import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Save, RefreshCw, AlertCircle, Plane } from 'lucide-react';

export const CreateTimeOffView = ({ onBack, onCreated, apiFetch }: any) => {
  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!formData.startDate || !formData.endDate || !formData.reason) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      
      if (end < start) {
        throw new Error("La date de fin doit être après la date de début");
      }

      const days = [];
      let current = new Date(start);
      while (current <= end) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }

      const promises = days.map(date => {
        const safeDate = new Date(date);
        safeDate.setHours(12, 0, 0, 0);

        const payload = {
          cr7e0_nomclient: `CONGÉ: ${formData.reason}`,
          cr7e0_email: 'conge@larabstrait.fr',
          cr7e0_daterdv: safeDate.toISOString(),
          cr7e0_tariftattoo: 0,
          cr7e0_acompte: "129690002",
          cr7e0_montantacompte: 0,
          cr7e0_typederdv: "129690005",
          cr7e0_boncommande: "129690002"
        };
        return apiFetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      });

      const results = await Promise.all(promises);
      const failed = results.find(r => !r.ok);
      if (failed) {
        const data = await failed.json();
        throw new Error(data.error || "Erreur création d'un jour");
      }

      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl transition-all"><ArrowLeft size={24} /></button>
          <h2 className="text-2xl font-bold">Poser un congés</h2>
        </div>
        <button onClick={handleSubmit} disabled={saving} className="btn-primary flex items-center space-x-2">
          {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
          <span>{saving ? "Enregistrement..." : "Enregistrer"}</span>
        </button>
      </div>
      {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex items-center space-x-3"><AlertCircle size={20} /><span>{error}</span></div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-card p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Motif du congé</label>
              <input type="text" placeholder="Ex: Vacances..." value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Date de début</label><input type="date" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50"/></div>
              <div className="space-y-1"><label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Date de fin</label><input type="date" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50"/></div>
            </div>
          </div>
        </div>
        <div className="hidden md:block">
          <div className="glass-card p-8 h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <div className="w-20 h-20 rounded-3xl bg-lilas/10 flex items-center justify-center text-lilas"><Plane size={40} /></div>
            <div><h3 className="font-bold text-lg">Bloquer l'agenda</h3></div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};