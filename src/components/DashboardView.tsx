import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar, Clock, CheckCircle2, Wallet, 
  TrendingUp, ChevronRight, ChevronDown, MoreVertical,
  PenTool, Receipt, AlertCircle 
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

  // 🎯 FONCTION BLINDÉE : On calcule le statut 100% en local
  const getStatusBadge = (appt: any) => {
    const style = (appt.style || appt.cr7e0_typederdv || "").toLowerCase();
    const isTattoo = style === "flash" || style === "projet perso";
    
    const hasBdc = Boolean(appt.abbyBdcId || appt.cr7e0_abby_bdc_id || appt.abby_bdc_id);
    const isDispensed = appt.deposit === "Dispensé" || appt.deposit_status === "Dispensé" || appt.cr7e0_acompte === "129690002" || appt.cr7e0_acompte === "Dispensé";
    const isPaid = appt.deposit === "Oui" || appt.deposit_status === "Oui" || appt.cr7e0_acompte === "129690000" || appt.cr7e0_acompte === "Oui";

    if (isTattoo) {
      if (isPaid || isDispensed) return { label: "Ok", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" };
      if (hasBdc) return { label: "Acompte", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20" };
      return { label: "Acompte + BDC", color: "bg-rose-500/10 text-rose-400 border border-rose-500/20" };
    }
    
    return { label: "Ok", color: "bg-gray-500/10 text-gray-400 border border-gray-500/20" };
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
  
  // Séparation Futur / Passé
  const upcomingAppointments = appointments.filter((appt: any) => (appt.rawDate || 0) >= today).sort((a: any, b: any) => a.rawDate - b.rawDate);
  const pastAppointments = appointments.filter((appt: any) => (appt.rawDate || 0) > 0 && (appt.rawDate || 0) < today).sort((a: any, b: any) => b.rawDate - a.rawDate);
  
  // 🗂️ 1. DESSINS À PRÉPARER
  const drawingsToDo = upcomingAppointments.filter((appt: any) => 
    appt.projectStatus === 'À dessiner' || appt.projectStatus === 'À modifier' || 
    appt.cr7e0_etatdessin === 'À dessiner' || appt.cr7e0_etatdessin === 'À modifier'
  );
  
  // 🗂️ 2. VÉRIFIER FACTURATION (Manque d'ID Abby)
  const toVerifyBilling = upcomingAppointments.filter((appt: any) => {
    const style = (appt.style || appt.cr7e0_typederdv || "").toLowerCase();
    if (style !== "flash" && style !== "projet perso") return false;

    const hasBdc = Boolean(appt.abbyBdcId || appt.cr7e0_abby_bdc_id || appt.abby_bdc_id);
    const hasDeposit = Boolean(appt.abbyAcompteId || appt.cr7e0_abby_acompte_id || appt.abby_deposit_id);
    const hasFinal = Boolean(appt.abbyFactureId || appt.cr7e0_abby_facture_id || appt.abby_final_id);
    const isDispensed = appt.deposit === "Dispensé" || appt.deposit_status === "Dispensé" || appt.cr7e0_acompte === "129690002" || appt.cr7e0_acompte === "Dispensé";

    return !hasBdc || (!hasDeposit && !isDispensed) || !hasFinal;
  });

  // 🗂️ 3. DOSSIERS À FINALISER (Acompte non réglé)
  const toFinalize = upcomingAppointments.filter((appt: any) => {
    const badge = getStatusBadge(appt).label;
    if (badge === "Ok") return false; // S'il est Ok en base, c'est bon.

    // Vérification en direct sur Abby !
    const depositId = appt.abbyAcompteId || appt.cr7e0_abby_acompte_id || appt.abby_deposit_id;
    if (depositId) {
      const acDoc = abbyDocs.find((d: any) => d.internalId === depositId);
      if (acDoc && ['paid', 'signed', 'accepted', 'encaissé'].includes(acDoc.status)) {
        return false; // C'est payé sur Abby, on masque !
      }
    }
    return true; 
  });

  // 🗂️ 4. FACTURES À ENCAISSER
  const toEncash = pastAppointments.filter((appt: any) => {
    const style = (appt.style || appt.cr7e0_typederdv || "").toLowerCase();
    if (style !== "flash" && style !== "projet perso") return false;
    
    const finalId = appt.abbyFactureId || appt.cr7e0_abby_facture_id || appt.abby_final_id;
    const depositId = appt.abbyAcompteId || appt.cr7e0_abby_acompte_id || appt.abby_deposit_id;
    
    if (!finalId && !depositId) return false; // Pas de facturation liée

    // Vérification en direct sur Abby !
    if (finalId) {
      const finalDoc = abbyDocs.find((d: any) => d.internalId === finalId);
      if (finalDoc && ['paid', 'signed', 'accepted', 'encaissé'].includes(finalDoc.status)) {
        return false; // Facture finale payée sur Abby, on masque !
      }
    }
    
    // Sécurité : si en base c'est déjà marqué Payé
    const isPaye = appt.projectStatus === "Payé" || appt.cr7e0_etatdessin === "Payé";
    return !isPaye;
  });

  const firstName = user?.name ? user.name.split(' ')[0] : 'Florent';
  const displayedAppointments = showAllAppointments ? upcomingAppointments : upcomingAppointments.slice(0, 5);
  
  // 💰 CALCULS FINANCIERS
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

      {/* --- SECTION : DESSINS À PRÉPARER --- */}
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

      {/* --- NOUVELLE SECTION : VÉRIFIER FACTURATION --- */}
      {toVerifyBilling.length > 0 && (
        <section className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-1 h-6 bg-orange-500 rounded-full" />
              <h3 className="text-xl md:text-2xl font-bold tracking-tight text-orange-500 flex items-center space-x-2">
                <AlertCircle size={24} />
                <span>Vérifier facturation Abby</span>
              </h3>
            </div>
            <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs px-3 py-1 rounded-full font-bold">
              {toVerifyBilling.length} dossier{toVerifyBilling.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-4">
            {toVerifyBilling.map((appt: any, i: number) => {
              const status = getStatusBadge(appt);
              return (
                <motion.div key={`verify-${appt.id}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} onClick={() => onSelectAppointment(appt)} className="glass-card p-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_200px_120px_40px] items-center gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer group border-l-2 border-orange-500/50 bg-orange-500/5">
                  <div className="flex items-center space-x-5">
                    <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold text-lg border border-orange-500/20 shrink-0">{appt.client.charAt(0)}</div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-lg group-hover:text-orange-500 transition-colors truncate">{appt.client}</h4>
                      <div className="flex items-center space-x-3 text-sm text-gray-400"><span className="flex items-center space-x-1 shrink-0"><Calendar size={14} /><span>{appt.date || 'À définir'}</span></span></div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end text-right"><p className="text-xs md:text-sm font-medium text-gray-400 leading-tight truncate w-full">{appt.style}</p><p className="text-sm md:text-lg font-bold text-orange-500 leading-tight">{appt.price}</p></div>
                  <div className="hidden md:flex justify-center"><div className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${status.color}`}>{status.label}</div></div>
                  <div className="hidden sm:flex justify-end"><button className="p-2 text-gray-500 hover:text-white transition-colors"><ChevronRight size={20} /></button></div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* --- SECTION : DOSSIERS À FINALISER --- */}
      {toFinalize.length > 0 && (
        <section className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3"><div className="w-1 h-6 bg-amber-500 rounded-full" /><h3 className="text-xl md:text-2xl font-bold tracking-tight text-amber-500">Dossiers à finaliser</h3></div>
          </div>
          <div className="space-y-4">
            {toFinalize.map((appt: any, i: number) => {
              const status = getStatusBadge(appt);
              return (
                <motion.div key={`admin-${appt.id}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} onClick={() => onSelectAppointment(appt)} className="glass-card p-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_200px_120px_40px] items-center gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer group border-l-2 border-amber-500/30">
                  <div className="flex items-center space-x-5">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-amber-500 font-bold text-lg border border-white/10 shrink-0">{appt.client.charAt(0)}</div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-lg group-hover:text-amber-500 transition-colors truncate">{appt.client}</h4>
                      <div className="flex items-center space-x-3 text-sm text-gray-400"><span className="flex items-center space-x-1 shrink-0"><Calendar size={14} /><span>{appt.date || 'À définir'}</span></span><span className="flex items-center space-x-1 shrink-0"><Clock size={14} /><span>{appt.time || '14:00'}</span></span></div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end text-right"><p className="text-xs md:text-sm font-medium text-gray-400 leading-tight truncate w-full">{appt.style}</p><p className="text-sm md:text-lg font-bold text-amber-500 leading-tight">{appt.price}</p></div>
                  <div className="hidden md:flex justify-center"><div className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${status.color}`}>{status.label}</div></div>
                  <div className="hidden sm:flex justify-end"><button className="p-2 text-gray-500 hover:text-white transition-colors"><ChevronRight size={20} /></button></div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* --- SECTION : FACTURES À ENCAISSER --- */}
      {toEncash.length > 0 && (
        <section className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3"><div className="w-1 h-6 bg-rose-500 rounded-full" /><h3 className="text-xl md:text-2xl font-bold tracking-tight text-rose-500">Factures à encaisser</h3></div>
          </div>
          <div className="space-y-4">
            {toEncash.map((appt: any, i: number) => (
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

      {/* --- SECTION : PROCHAINS RENDEZ-VOUS --- */}
<section>
  <div className="flex justify-between items-center mb-6">
    <div className="flex items-center space-x-3">
      <div className="w-1 h-6 bg-lilas rounded-full" />
      <h3 className="text-xl md:text-2xl font-bold tracking-tight">Prochains Rendez-vous</h3>
    </div>
    {upcomingAppointments.length > 5 && (
      <button 
        onClick={() => setShowAllAppointments(!showAllAppointments)} 
        className="text-lilas text-sm font-medium hover:underline flex items-center space-x-1"
      >
        <span>{showAllAppointments ? 'Réduire' : 'Voir tout'}</span>
        {showAllAppointments ? <ChevronDown size={14} className="rotate-180" /> : <ChevronRight size={14} />}
      </button>
    )}
  </div>
  <div className="space-y-4">
    {upcomingAppointments.length === 0 ? (
      <div className="glass-card p-12 text-center text-gray-500">Aucun rendez-vous à venir trouvé.</div>
    ) : (
      displayedAppointments.map((appt: any, i: number) => {
        // Suppression du badge de statut ici
        return (
          <motion.div 
            key={appt.id} 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ delay: 0.3 + (i * 0.1) }} 
            onClick={() => onSelectAppointment(appt)} 
            // On passe de 4 colonnes à 3 sur desktop pour un meilleur alignement
            className="glass-card p-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_200px_40px] items-center gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer group"
          >
            <div className="flex items-center space-x-5">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-lilas font-bold text-lg border border-white/10 shrink-0">
                {appt.client.charAt(0)}
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-lg group-hover:text-lilas transition-colors truncate">{appt.client}</h4>
                <div className="flex items-center space-x-3 text-sm text-gray-400">
                  <span className="flex items-center space-x-1 shrink-0"><Calendar size={14} /><span>{appt.date || 'À définir'}</span></span>
                  <span className="flex items-center space-x-1 shrink-0"><Clock size={14} /><span>{appt.time || '14:00'}</span></span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end text-right">
              <p className="text-xs md:text-sm font-medium text-gray-400 leading-tight truncate w-full">{appt.style}</p>
              <p className="text-sm md:text-lg font-bold text-lilas leading-tight">{appt.price}</p>
            </div>

            {/* La colonne du badge statut a été retirée */}

            <div className="hidden sm:flex justify-end">
              <button className="p-2 text-gray-500 hover:text-white transition-colors">
                <MoreVertical size={20} />
              </button>
            </div>
          </motion.div>
        );
      })
    )}
  </div>
</section>
    </motion.div>
  );
};