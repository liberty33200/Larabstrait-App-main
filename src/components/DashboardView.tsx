import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar, Clock, CheckCircle2, Wallet, 
  TrendingUp, ChevronRight, ChevronDown, MoreVertical,
  PenTool, Receipt 
} from 'lucide-react';

export const DashboardView = ({ appointments, rules, loading, user, onSelectAppointment, apiFetch }: any) => {
  const [showAllAppointments, setShowAllAppointments] = useState(false);
  const [abbyDocs, setAbbyDocs] = useState<any[]>([]);

  useEffect(() => {
    if (apiFetch) {
      apiFetch('/api/abby/documents')
        .then((res: any) => res.ok ? res.json() : [])
        .then((data: any) => setAbbyDocs(data))
        .catch((err: any) => console.error("Erreur fetch Abby docs sur le dashboard:", err));
    }
  }, [apiFetch]);

  const getControlStatus = (appt: any) => {
    const style = (appt.style || "").trim();
    const deposit = appt.deposit || "Non";
    const total = parseFloat((appt.total || 0).toString());
    const orderForm = appt.orderForm || "Non édité";
    let baseStatus = "Validé";
    if (!style) baseStatus = "A contrôler";
    else if (style.toLowerCase() === "flash" || style.toLowerCase() === "projet perso") {
      if (total !== 0 && (!(deposit === "Oui" || deposit === "Dispensé") || total <= 0)) baseStatus = "A contrôler";
    }
    if (baseStatus === "A contrôler") return orderForm === "Non édité" ? { label: "A contrôler + BDC", color: "bg-rose-500/10 text-rose-400 border border-rose-500/20" } : { label: "À contrôler", color: "bg-rose-500/10 text-rose-400 border border-rose-500/20" };
    if (baseStatus === "Validé") {
      if (orderForm === "Non édité") return { label: "Bon de commande à faire", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20" };
      return { label: orderForm === "Édité" || orderForm === "Dispensé" ? "Complété" : "Validé", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" };
    }
    return { label: baseStatus, color: "bg-gray-500/10 text-gray-400 border border-gray-500/20" };
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
  
  const upcomingAppointments = appointments.filter((appt: any) => (appt.rawDate || 0) >= today).sort((a: any, b: any) => a.rawDate - b.rawDate);
  const incompleteAppointments = upcomingAppointments.filter((appt: any) => getControlStatus(appt).label !== "Complété");
  const drawingsToDo = upcomingAppointments.filter((appt: any) => appt.projectStatus === 'À dessiner' || appt.projectStatus === 'À modifier');

  // --- FILTRE INTELLIGENT : Factures à encaisser ---
  const pastAppointments = appointments.filter((appt: any) => (appt.rawDate || 0) > 0 && (appt.rawDate || 0) < today);
  const unpaidAppointments = pastAppointments.filter((appt: any) => {
    if (!appt.total || parseFloat(appt.total) === 0) return false;
    if (abbyDocs.length === 0) return false;

    // MAGIE ICI : Si l'ancien RDV n'a jamais été lié à Abby dans Dataverse, on l'ignore (pas de faux positifs !)
    if (!appt.abbyFactureId && !appt.abbyAcompteId) return false;

    const isDocPaid = (status: string) => ['paid', 'signed', 'accepted'].includes(status);

    if (appt.abbyFactureId) {
      const finalDoc = abbyDocs.find((d: any) => d.internalId === appt.abbyFactureId);
      if (finalDoc) return !isDocPaid(finalDoc.status);
    } else if (appt.abbyAcompteId) {
      const acDoc = abbyDocs.find((d: any) => d.internalId === appt.abbyAcompteId);
      if (acDoc) {
        if (!isDocPaid(acDoc.status)) return true;
        const isFullyPaidByAc = parseFloat(acDoc.amount) >= parseFloat(appt.total);
        if (!isFullyPaidByAc) return true; // L'acompte est payé, mais il reste le solde à facturer/payer
      }
    }
    return false;
  }).sort((a: any, b: any) => b.rawDate - a.rawDate);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Florent';
  const displayedAppointments = showAllAppointments ? upcomingAppointments : upcomingAppointments.slice(0, 5);
  const monthEntries = appointments.filter((appt: any) => (appt.rawDate || 0) >= startOfMonth && (appt.rawDate || 0) <= endOfMonth);
  const totalRevenue = monthEntries.reduce((acc: number, curr: any) => acc + (curr.total || 0), 0);
  const collected = monthEntries.filter((e: any) => (e.rawDate || 0) < today).reduce((acc: number, curr: any) => acc + (curr.total || 0), 0);
  const upcoming = monthEntries.filter((e: any) => (e.rawDate || 0) >= today).reduce((acc: number, curr: any) => acc + (curr.total || 0), 0);

  const calculateSalary = () => {
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const applicableRule = [...(rules || [])].sort((a: any, b: any) => b.startMonth.localeCompare(a.startMonth)).find((r: any) => r.startMonth <= monthKey);
    if (applicableRule) return Math.round(totalRevenue - applicableRule.rent - (totalRevenue * applicableRule.rate));
    return 0;
  };
  const salary = calculateSalary();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-1">Bonjour, {firstName}</h2>
          <p className="text-gray-400 text-sm md:text-base">
            {loading ? "Chargement des données..." : `Vous avez ${upcomingAppointments.length} rendez-vous à venir.`}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10">
        {[
          { label: 'CA Prév. (Mois)', value: `${totalRevenue}€`, icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Encaissé', value: `${collected}€`, icon: CheckCircle2, color: 'text-purple-400' },
          { label: 'À venir', value: `${upcoming}€`, icon: Clock, color: 'text-blue-400' },
          { label: 'Salaire Est.', value: `${salary}€`, icon: Wallet, color: 'text-lilas' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-4 md:p-6">
            <div className="flex justify-between items-start mb-4"><div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}><stat.icon size={20} /></div></div>
            <p className="text-gray-400 text-[10px] md:text-xs uppercase tracking-wider mb-1">{stat.label}</p>
            <h3 className="text-lg md:text-2xl font-bold">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {drawingsToDo.length > 0 && (
        <section className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3"><div className="w-1 h-6 bg-blue-500 rounded-full" /><h3 className="text-xl md:text-2xl font-bold tracking-tight text-blue-500">Dessins à préparer</h3></div>
          </div>
          <div className="space-y-4">
            {drawingsToDo.map((appt: any, i: number) => (
              <motion.div key={`draw-${appt.id}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} onClick={() => onSelectAppointment(appt)} className="glass-card p-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_200px_120px_40px] items-center gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer group border-l-2 border-blue-500/30">
                <div className="flex items-center space-x-5">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold text-lg border border-blue-500/20 shrink-0"><PenTool size={20} /></div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-lg group-hover:text-blue-500 transition-colors truncate">{appt.client}</h4>
                    <div className="flex items-center space-x-3 text-sm text-gray-400"><span className="flex items-center space-x-1 shrink-0"><Calendar size={14} /><span>{appt.date || 'À définir'}</span></span><span className="flex items-center space-x-1 shrink-0"><Clock size={14} /><span>{appt.time || '14:00'}</span></span></div>
                  </div>
                </div>
                <div className="flex flex-col items-end text-right"><p className="text-xs md:text-sm font-medium text-gray-400 leading-tight truncate w-full">{appt.style}</p><p className="text-xs text-gray-500 truncate w-full mt-1">{appt.projectRecap || 'Aucun détail'}</p></div>
                <div className="hidden md:flex justify-center"><div className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${appt.projectStatus === 'À modifier' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>{appt.projectStatus}</div></div>
                <div className="hidden sm:flex justify-end"><button className="p-2 text-gray-500 hover:text-white transition-colors"><ChevronRight size={20} /></button></div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {unpaidAppointments.length > 0 && (
        <section className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3"><div className="w-1 h-6 bg-rose-500 rounded-full" /><h3 className="text-xl md:text-2xl font-bold tracking-tight text-rose-500">Factures à encaisser</h3></div>
          </div>
          <div className="space-y-4">
            {unpaidAppointments.map((appt: any, i: number) => (
              <motion.div key={`unpaid-${appt.id}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} onClick={() => onSelectAppointment(appt)} className="glass-card p-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_200px_120px_40px] items-center gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer group border-l-2 border-rose-500/30">
                <div className="flex items-center space-x-5">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 font-bold text-lg border border-rose-500/20 shrink-0"><Receipt size={20} /></div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-lg group-hover:text-rose-500 transition-colors truncate">{appt.client}</h4>
                    <div className="flex items-center space-x-3 text-sm text-gray-400"><span className="flex items-center space-x-1 shrink-0"><Calendar size={14} /><span>{appt.date || 'Date passée'}</span></span></div>
                  </div>
                </div>
                <div className="flex flex-col items-end text-right"><p className="text-xs md:text-sm font-medium text-gray-400 leading-tight truncate w-full">{appt.style}</p><p className="text-sm md:text-lg font-bold text-rose-500 leading-tight">{appt.price}</p></div>
                <div className="hidden md:flex justify-center"><div className="px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap bg-rose-500/10 text-rose-400 border border-rose-500/20">À encaisser</div></div>
                <div className="hidden sm:flex justify-end"><button className="p-2 text-gray-500 hover:text-white transition-colors"><ChevronRight size={20} /></button></div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {incompleteAppointments.length > 0 && (
        <section className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3"><div className="w-1 h-6 bg-amber-500 rounded-full" /><h3 className="text-xl md:text-2xl font-bold tracking-tight text-amber-500">Dossiers à finaliser</h3></div>
          </div>
          <div className="space-y-4">
            {incompleteAppointments.map((appt: any, i: number) => (
                <motion.div key={`admin-${appt.id}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} onClick={() => onSelectAppointment(appt)} className="glass-card p-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_200px_120px_40px] items-center gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer group border-l-2 border-amber-500/30">
                  <div className="flex items-center space-x-5">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-amber-500 font-bold text-lg border border-white/10 shrink-0">{appt.client.charAt(0)}</div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-lg group-hover:text-amber-500 transition-colors truncate">{appt.client}</h4>
                      <div className="flex items-center space-x-3 text-sm text-gray-400"><span className="flex items-center space-x-1 shrink-0"><Calendar size={14} /><span>{appt.date || 'À définir'}</span></span><span className="flex items-center space-x-1 shrink-0"><Clock size={14} /><span>{appt.time || '14:00'}</span></span></div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end text-right"><p className="text-xs md:text-sm font-medium text-gray-400 leading-tight truncate w-full">{appt.style}</p><p className="text-sm md:text-lg font-bold text-amber-500 leading-tight">{appt.price}</p></div>
                  <div className="hidden md:flex justify-center">{(() => { const status = getControlStatus(appt); return (<div className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${status.color}`}>{status.label}</div>); })()}</div>
                  <div className="hidden sm:flex justify-end"><button className="p-2 text-gray-500 hover:text-white transition-colors"><ChevronRight size={20} /></button></div>
                </motion.div>
              ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3"><div className="w-1 h-6 bg-lilas rounded-full" /><h3 className="text-xl md:text-2xl font-bold tracking-tight">Prochains Rendez-vous</h3></div>
          {upcomingAppointments.length > 5 && <button onClick={() => setShowAllAppointments(!showAllAppointments)} className="text-lilas text-sm font-medium hover:underline flex items-center space-x-1"><span>{showAllAppointments ? 'Réduire' : 'Voir tout'}</span>{showAllAppointments ? <ChevronDown size={14} className="rotate-180" /> : <ChevronRight size={14} />}</button>}
        </div>
        <div className="space-y-4">
          {upcomingAppointments.length === 0 ? <div className="glass-card p-12 text-center text-gray-500">Aucun rendez-vous à venir trouvé.</div> : (
            displayedAppointments.map((appt: any, i: number) => (
              <motion.div key={appt.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + (i * 0.1) }} onClick={() => onSelectAppointment(appt)} className="glass-card p-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_200px_120px_40px] items-center gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer group">
                <div className="flex items-center space-x-5">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-lilas font-bold text-lg border border-white/10 shrink-0">{appt.client.charAt(0)}</div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-lg group-hover:text-lilas transition-colors truncate">{appt.client}</h4>
                    <div className="flex items-center space-x-3 text-sm text-gray-400"><span className="flex items-center space-x-1 shrink-0"><Calendar size={14} /><span>{appt.date || 'À définir'}</span></span><span className="flex items-center space-x-1 shrink-0"><Clock size={14} /><span>{appt.time || '14:00'}</span></span></div>
                  </div>
                </div>
                <div className="flex flex-col items-end text-right"><p className="text-xs md:text-sm font-medium text-gray-400 leading-tight truncate w-full">{appt.style}</p><p className="text-sm md:text-lg font-bold text-lilas leading-tight">{appt.price}</p></div>
                <div className="hidden md:flex justify-center">{(() => { const status = getControlStatus(appt); return (<div className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${status.color}`}>{status.label}</div>); })()}</div>
                <div className="hidden sm:flex justify-end"><button className="p-2 text-gray-500 hover:text-white transition-colors"><MoreVertical size={20} /></button></div>
              </motion.div>
            ))
          )}
        </div>
      </section>
    </motion.div>
  );
};