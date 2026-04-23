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
  
  // État pour mémoriser quelle ligne de dessin est déroulée (l'accordéon)
  const [expandedDrawId, setExpandedDrawId] = useState<number | null>(null);
  
  // NOUVEAU : État pour gérer la confirmation in-app du bouton Valider
  const [validatingId, setValidatingId] = useState<number | null>(null);

  useEffect(() => {
    if (apiFetch) {
      apiFetch('/api/abby/documents')
        .then((res: any) => res.ok ? res.json() : [])
        .then((data: any) => setAbbyDocs(data))
        .catch((err: any) => console.error("Erreur fetch Abby docs sur le dashboard:", err));
    }
  }, [apiFetch]);

  // FONCTION DE MISE À JOUR ADAPTÉE POUR LES BOUTONS
  const handleQuickStatusUpdate = async (newStatus: string, apptId: number) => {
    if (!apiFetch) return;

    try {
      const response = await apiFetch(`/api/appointments/${apptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_status: newStatus })
      });

      if (response.ok) {
        window.location.reload(); 
      } else {
        console.error("Erreur lors de la sauvegarde du statut");
      }
    } catch (err) {
      console.error("Erreur réseau lors de la mise à jour rapide du statut:", err);
    }
  };

  // Logique des badges de facturation
  const getStatusBadge = (appt: any) => {
    const style = (appt.style || "").toLowerCase();
    const isTattoo = style === "flash" || style === "projet perso";
    const hasBdc = Boolean(appt.abbyBdcId);
    const isDispensed = appt.deposit === "Dispensé";
    const isPaid = appt.deposit === "Oui";

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
  
  const upcomingAppointments = appointments
    .filter((appt: any) => (appt.rawDate || 0) >= today)
    .sort((a: any, b: any) => (a.rawDate || 0) - (b.rawDate || 0));
    
  const pastAppointments = appointments
    .filter((appt: any) => (appt.rawDate || 0) > 0 && (appt.rawDate || 0) < today)
    .sort((a: any, b: any) => (b.rawDate || 0) - (a.rawDate || 0));
  
  const drawingsToDo = upcomingAppointments.filter((appt: any) => 
    appt.projectStatus !== 'Validé' && appt.projectStatus !== 'Non nécessaire'
  );
  
  const toVerifyBilling = upcomingAppointments.filter((appt: any) => {
    const style = (appt.style || "").toLowerCase();
    if (style !== "flash" && style !== "projet perso") return false;
    const isDispensed = appt.deposit === "Dispensé";
    return !appt.abbyBdcId || (!appt.abbyAcompteId && !isDispensed) || !appt.abbyFactureId;
  });

  const toFinalize = upcomingAppointments.filter((appt: any) => {
    const badge = getStatusBadge(appt).label;
    if (badge === "Ok") return false;
    if (appt.abbyAcompteId) {
      const acDoc = abbyDocs.find((d: any) => d.internalId === appt.abbyAcompteId);
      if (acDoc && ['paid', 'signed', 'accepted', 'encaissé'].includes(acDoc.status)) return false;
    }
    return true; 
  });

  const toEncash = pastAppointments.filter((appt: any) => {
    const style = (appt.style || "").toLowerCase();
    if (style !== "flash" && style !== "projet perso") return false;
    if (!appt.abbyFactureId && !appt.abbyAcompteId) return false;
    if (appt.abbyFactureId) {
      const finalDoc = abbyDocs.find((d: any) => d.internalId === appt.abbyFactureId);
      if (finalDoc && ['paid', 'signed', 'accepted', 'encaissé'].includes(finalDoc.status)) return false;
    }
    return appt.projectStatus !== "Payé";
  });

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

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10">
        {[
          { label: 'CA Prév. (Mois)', value: `${totalRevenue}€`, icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Encaissé', value: `${collected}€`, icon: CheckCircle2, color: 'text-purple-400' },
          { label: 'À venir', value: `${upcoming}€`, icon: Clock, color: 'text-blue-400' },
          { label: 'Salaire Est.', value: `${calculateSalary()}€`, icon: Wallet, color: 'text-lilas' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-4 md:p-6">
            <div className="flex justify-between items-start mb-4"><div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}><stat.icon size={20} /></div></div>
            <p className="text-gray-400 text-[10px] md:text-xs uppercase tracking-wider mb-1">{stat.label}</p>
            <h3 className="text-lg md:text-2xl font-bold">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* SECTION 1 : VÉRIFIER FACTURATION ABBY */}
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
            <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs px-3 py-1 rounded-full font-bold">{toVerifyBilling.length}</span>
          </div>
          <div className="space-y-4">
            {toVerifyBilling.map((appt: any, i: number) => (
              <motion.div key={`verify-${appt.id}`} onClick={() => onSelectAppointment(appt)} className="glass-card p-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_200px_120px_40px] items-center gap-4 hover:bg-white/[0.02] cursor-pointer border-l-2 border-orange-500/50 bg-orange-500/5 transition-all">
                <div className="flex items-center space-x-4 min-w-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold border border-orange-500/20 shrink-0">{appt.client.charAt(0)}</div>
                  <div className="min-w-0"><h4 className="font-semibold truncate">{appt.client}</h4><div className="text-xs text-gray-400">{appt.date}</div></div>
                </div>
                <div className="text-right"><p className="text-xs text-gray-400 truncate">{appt.style}</p><p className="font-bold text-orange-500">{appt.price}</p></div>
                <div className="hidden md:flex justify-center"><div className={`px-3 py-1 rounded-full text-[10px] font-semibold ${getStatusBadge(appt).color}`}>{getStatusBadge(appt).label}</div></div>
                <div className="hidden sm:flex justify-end text-gray-500"><ChevronRight size={20} /></div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 2 : DESSINS À PRÉPARER (NOUVEAU DESIGN ACCORDÉON) */}
      {drawingsToDo.length > 0 && (
        <section className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3"><div className="w-1 h-6 bg-blue-500 rounded-full" /><h3 className="text-xl md:text-2xl font-bold tracking-tight text-blue-500">Dessins à préparer</h3></div>
          </div>
          <div className="space-y-4">
            {drawingsToDo.map((appt: any, i: number) => {
              const isExpanded = expandedDrawId === appt.id;

              return (
                <motion.div 
                  key={`draw-${appt.id}`} 
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  onClick={() => {
                    setExpandedDrawId(isExpanded ? null : appt.id);
                    setValidatingId(null); // On ferme la confirmation si l'accordéon est replié
                  }} 
                  className={`glass-card p-5 cursor-pointer border-l-2 transition-all overflow-hidden
                    ${isExpanded ? 'bg-white/[0.04] border-blue-400 shadow-lg shadow-blue-500/10' : 'hover:bg-white/[0.02] border-blue-500/30'}`}
                >
                  {/* LIGNE PRINCIPALE TOUJOURS VISIBLE */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20"><PenTool size={20} /></div>
                      <div className="min-w-0">
                        <h4 className="font-semibold truncate text-white">{appt.client}</h4>
                        <div className="text-xs text-gray-400">{appt.date} • {appt.time}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {/* Badge Statique (Quand l'accordéon est fermé ou ouvert) */}
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold border
                          ${appt.projectStatus === 'À modifier' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                            appt.projectStatus === 'Envoyé' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                            appt.projectStatus === 'Dessiné' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}
                        >
                          {appt.projectStatus || 'À préparer'}
                        </span>
                      </div>
                      
                      <div className="text-gray-500 flex items-center">
                        <ChevronDown size={20} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-blue-400' : ''}`} />
                      </div>
                    </div>
                  </div>

                  {/* CONTENU DÉROULANT (ACCORDÉON) */}
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }} 
                      animate={{ height: 'auto', opacity: 1 }} 
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-5 pt-5 border-t border-white/5"
                    >
                      <p className="text-sm text-gray-300 italic mb-4">
                        <span className="font-semibold text-gray-500 not-italic mr-2">Détails :</span>
                        "{appt.projectRecap || 'Aucun détail renseigné pour ce projet.'}"
                      </p>

                      {/* Tous les boutons dans le même flux */}
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <button onClick={(e) => { e.stopPropagation(); handleQuickStatusUpdate('À préparer', appt.id); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors border border-white/5">À préparer</button>
                        <button onClick={(e) => { e.stopPropagation(); handleQuickStatusUpdate('Dessiné', appt.id); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20">Dessiné</button>
                        <button onClick={(e) => { e.stopPropagation(); handleQuickStatusUpdate('Envoyé', appt.id); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors border border-purple-500/20">Envoyé</button>
                        <button onClick={(e) => { e.stopPropagation(); handleQuickStatusUpdate('À modifier', appt.id); }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors border border-amber-500/20">À modifier</button>
                        
                        {/* BOUTON VALIDER AVEC CONFIRMATION IN-APP */}
                        {validatingId === appt.id ? (
                          <div className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 transition-all">
                            <span className="text-[10px] text-blue-300 font-medium">Valider le dessin ?</span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setValidatingId(null); }} 
                              className="px-2 py-1.5 rounded-md text-[10px] font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                              Annuler
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleQuickStatusUpdate('Validé', appt.id); }} 
                              className="px-3 py-1.5 rounded-md text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-md"
                            >
                              Oui, valider
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setValidatingId(appt.id); }} 
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-600/30 transition-all flex items-center justify-center gap-1"
                          >
                            <CheckCircle2 size={14} /> Valider
                          </button>
                        )}
                      </div>

                      {/* Lien vers le dossier complet */}
                      <div className="flex justify-center mt-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onSelectAppointment(appt); }}
                          className="text-xs text-gray-500 hover:text-white underline decoration-white/20 hover:decoration-white/50 underline-offset-4 transition-all"
                        >
                          Ouvrir la fiche complète du rendez-vous
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION 3 : DOSSIERS À FINALISER */}
      {toFinalize.length > 0 && (
        <section className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3"><div className="w-1 h-6 bg-amber-500 rounded-full" /><h3 className="text-xl md:text-2xl font-bold tracking-tight text-amber-500">Dossiers à finaliser</h3></div>
          </div>
          <div className="space-y-4">
            {toFinalize.map((appt: any, i: number) => (
              <motion.div key={`admin-${appt.id}`} onClick={() => onSelectAppointment(appt)} className="glass-card p-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_200px_120px_40px] items-center gap-4 hover:bg-white/[0.02] cursor-pointer border-l-2 border-amber-500/30">
                <div className="flex items-center space-x-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-amber-500 font-bold border border-white/10 shrink-0">{appt.client.charAt(0)}</div>
                  <div className="min-w-0"><h4 className="font-semibold truncate">{appt.client}</h4><div className="text-xs text-gray-400">{appt.date} • {appt.time}</div></div>
                </div>
                <div className="text-right"><p className="text-xs text-gray-400 truncate">{appt.style}</p><p className="font-bold text-amber-500">{appt.price}</p></div>
                <div className="hidden md:flex justify-center"><div className={`px-3 py-1 rounded-full text-[10px] font-semibold ${getStatusBadge(appt).color}`}>{getStatusBadge(appt).label}</div></div>
                <div className="hidden sm:flex justify-end text-gray-500"><ChevronRight size={20} /></div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 4 : FACTURES À ENCAISSER */}
      {toEncash.length > 0 && (
        <section className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3"><div className="w-1 h-6 bg-rose-500 rounded-full" /><h3 className="text-xl md:text-2xl font-bold tracking-tight text-rose-500">Factures à encaisser</h3></div>
          </div>
          <div className="space-y-4">
            {toEncash.map((appt: any, i: number) => (
              <motion.div key={`unpaid-${appt.id}`} onClick={() => onSelectAppointment(appt)} className="glass-card p-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_200px_120px_40px] items-center gap-4 hover:bg-white/[0.02] cursor-pointer border-l-2 border-rose-500/30">
                <div className="flex items-center space-x-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20 shrink-0"><Receipt size={20} /></div>
                  <div className="min-w-0"><h4 className="font-semibold truncate">{appt.client}</h4><div className="text-xs text-gray-400">{appt.date}</div></div>
                </div>
                <div className="text-right"><p className="text-xs text-gray-400 truncate">{appt.style}</p><p className="font-bold text-rose-500">{appt.price}</p></div>
                <div className="hidden md:flex justify-center"><div className="px-3 py-1 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">À encaisser</div></div>
                <div className="hidden sm:flex justify-end text-gray-500"><ChevronRight size={20} /></div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* PROCHAINS RENDEZ-VOUS */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3"><div className="w-1 h-6 bg-lilas rounded-full" /><h3 className="text-xl md:text-2xl font-bold tracking-tight">Prochains Rendez-vous</h3></div>
          {upcomingAppointments.length > 5 && (
            <button onClick={() => setShowAllAppointments(!showAllAppointments)} className="text-lilas text-sm font-medium hover:underline flex items-center space-x-1">
              <span>{showAllAppointments ? 'Réduire' : 'Voir tout'}</span>
              {showAllAppointments ? <ChevronDown size={14} className="rotate-180" /> : <ChevronRight size={14} />}
            </button>
          )}
        </div>
        <div className="space-y-4">
          {displayedAppointments.length === 0 ? (
            <div className="glass-card p-12 text-center text-gray-500 italic">Aucun rendez-vous à venir.</div>
          ) : (
            displayedAppointments.map((appt: any, i: number) => (
              <motion.div key={appt.id} onClick={() => onSelectAppointment(appt)} className="glass-card p-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_200px_40px] items-center gap-4 hover:bg-white/[0.02] cursor-pointer transition-all border border-transparent hover:border-white/5">
                <div className="flex items-center space-x-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-lilas font-bold border border-white/10">{appt.client.charAt(0)}</div>
                  <div className="min-w-0"><h4 className="font-semibold truncate">{appt.client}</h4><div className="text-xs text-gray-400">{appt.date} • {appt.time}</div></div>
                </div>
                <div className="text-right"><p className="text-xs text-gray-400">{appt.style}</p><p className="font-bold text-lilas">{appt.price}</p></div>
                <div className="hidden sm:flex justify-end text-gray-500"><MoreVertical size={20} /></div>
              </motion.div>
            ))
          )}
        </div>
      </section>
    </motion.div>
  );
};