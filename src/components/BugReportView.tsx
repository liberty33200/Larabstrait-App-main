import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, AlertCircle, Save, CheckCircle2, Trash2, Check } from 'lucide-react';

export const BugReportView = ({ apiFetch }: any) => {
  const [content, setContent] = useState('');
  const [reports, setReports] = useState<any[]>([]);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const fetchReports = async () => {
    try {
      const res = await apiFetch('/api/reports');
      if (res.ok) setReports(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchReports(); }, []);

  const handleSubmit = async () => {
    if (!content.trim() || status === 'sending') return;
    
    console.log("\n--- DEBUG FRONTEND : TENTATIVE D'ENVOI ---");
    console.log("Contenu :", content);
    setStatus('sending');
    
    try {
      const res = await apiFetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() })
      });

      console.log("Code HTTP de la réponse :", res.status);
      
      const textData = await res.text();
      console.log("Réponse brute du serveur :", textData);

      if (res.ok) {
        setStatus('success');
        setContent('');
        fetchReports();
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        console.error("ÉCHEC : Le serveur a renvoyé une erreur.");
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      }
    } catch (e: any) {
      console.error("ERREUR RÉSEAU CRITIQUE (Frontend) :", e.message);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const toggleReport = async (id: number, currentStatus: number) => {
    try {
      const res = await apiFetch(`/api/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: currentStatus === 0 ? 1 : 0 })
      });
      if (res.ok) fetchReports();
    } catch (e) {}
  };

  const purgeCompleted = async () => {
    if (!window.confirm("Supprimer définitivement tous les tickets cochés ?")) return;
    try {
      const res = await apiFetch('/api/reports/completed', { method: 'DELETE' });
      if (res.ok) fetchReports();
    } catch (e) {
      console.error("Erreur lors de la purge", e);
    }
  };

  const hasCompletedReports = reports.some(r => r.completed === 1);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold">Améliorations / bugs</h2>
        <p className="text-gray-400">Suivi des demandes et corrections.</p>
      </div>

      <div className="glass-card p-6 space-y-4">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Décrivez votre demande..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 min-h-[100px]" />
        <button onClick={handleSubmit} disabled={status === 'sending' || !content.trim()} className={`px-6 py-2 rounded-xl font-bold flex items-center space-x-2 disabled:opacity-50 ${status === 'error' ? 'bg-rose-500 text-white' : 'btn-primary'}`}>
          {status === 'sending' ? <RefreshCw className="animate-spin" size={18} /> : status === 'error' ? <AlertCircle size={18} /> : <Save size={18} />}
          <span>{status === 'error' ? 'Erreur (Réessayer)' : status === 'success' ? 'Envoyé !' : 'Envoyer mon retour'}</span>
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold flex items-center space-x-2 text-lilas">
            <CheckCircle2 size={20} />
            <span>Feuille de route</span>
          </h3>
          
          {hasCompletedReports && (
            <button 
              onClick={purgeCompleted}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-all text-xs font-bold"
            >
              <Trash2 size={14} />
              <span>Purger les terminés</span>
            </button>
          )}
        </div>

        <div className="grid gap-3">
          {reports.map((report: any) => (
            <div key={report.id} className={`glass-card p-4 flex items-start space-x-4 transition-all ${report.completed ? 'opacity-40' : ''}`}>
              <button onClick={() => toggleReport(report.id, report.completed)} className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center ${report.completed ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/10 hover:border-lilas'}`}>
                {report.completed ? <Check size={16} /> : null}
              </button>
              <div className="flex-1">
                <p className={`text-sm ${report.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>{report.content}</p>
                <p className="text-[10px] text-gray-500 mt-2 font-mono">Posté le {new Date(report.timestamp).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          ))}
          {reports.length === 0 && <p className="text-center text-gray-500 italic p-6 border border-dashed border-white/10 rounded-2xl">Aucun retour enregistré.</p>}
        </div>
      </div>
    </motion.div>
  );
};