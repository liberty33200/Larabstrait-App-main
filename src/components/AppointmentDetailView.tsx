import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Edit2, Save, RefreshCw, AlertCircle, 
  Calendar, Clock, Wallet, CheckCircle2, Mail, Check, Trash2,
  FileText, Receipt, Plus, CreditCard
} from 'lucide-react';

export const AppointmentDetailView = ({ appointment, onBack, onUpdate, apiFetch }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    date: appointment.rawDate ? new Date(appointment.rawDate).toISOString().split('T')[0] : '',
    time: appointment.time || '14:00',
    style: appointment.style || '',
    total: appointment.total || 0,
    deposit: appointment.deposit || 'Non',
    depositAmount: appointment.depositAmount || (appointment.deposit === 'Oui' ? 50 : 0),
    status: appointment.status || 'Confirmé',
    orderForm: appointment.orderForm || 'Non édité',
    location: appointment.location || '',
    projectRecap: appointment.projectRecap || '',
    size: appointment.size || '',
    projectStatus: appointment.projectStatus || 'À dessiner'
  });
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const calculateDefaultDeposit = (total: number) => {
    const t = parseFloat(total.toString());
    if (t === 0) return 0;
    if (t < 200) return 50;
    return t * 0.25;
  };

  const [docState, setDocState] = useState({
    bdc: (appointment.orderForm === 'Édité' || appointment.orderForm === 'Dispensé') ? 'created' : 'none',
    depositInvoice: (appointment.deposit === 'Oui' || appointment.deposit === 'Dispensé') ? 'paid' : 'none',
    finalInvoice: appointment.status === 'Payé' ? 'paid' : 'none'
  });

  useEffect(() => {
    const initAbbyAndDocs = async () => {
      setIsLoadingDocs(true);
      try {
        const resKey = await apiFetch('/api/settings/abby');
        if (resKey.ok) {
          const dataKey = await resKey.json();
          const hasKey = !!dataKey.abby_api_key;
          setHasApiKey(hasKey);

          if (hasKey) {
            const resDocs = await apiFetch('/api/abby/documents');
            if (resDocs.ok) {
              const allDocs = await resDocs.json();
              
              // 1. Variables de recherche
              const apptEmail = (appointment.clientEmail || "").toLowerCase().trim();
              const apptClient = (appointment.client || "").toLowerCase().trim();
              const clientWords = apptClient.split(/\s+/).filter((w: string) => w.length > 2);
              
              // 2. On filtre STRICTEMENT les documents
              const matchingDocs = allDocs.filter((d: any) => {
                const docEmail = (d.email || "").toLowerCase().trim();
                const docClient = (d.client || "").toLowerCase();
                
                // MATCH PARFAIT : L'adresse email (Priorité absolue)
                if (apptEmail && docEmail && docEmail === apptEmail) return true;
                
                // FALLBACK : Si l'email est vide d'un côté ou de l'autre, on tente par le nom strict
                if (!docEmail || !apptEmail) {
                  if (docClient === apptClient) return true;
                  if (clientWords.length > 0 && clientWords.every((word: string) => docClient.includes(word))) return true;
                }
                return false;
              });

              setDocState(prev => {
                const newState = { ...prev };
                
                // 3. Extraction de la bonne facture par préfixe de manière chronologique (le document le plus récent prime)
                const bdcDoc = matchingDocs.find((d: any) => d.id?.toUpperCase().startsWith('BDC'));
                const acDoc = matchingDocs.find((d: any) => d.id?.toUpperCase().startsWith('AC'));
                const finalDoc = matchingDocs.find((d: any) => {
                  const id = d.id?.toUpperCase() || "";
                  return id.startsWith('F') && !id.startsWith('FA'); // Ajuste si tes factures finales commencent par 'FA'
                }) || matchingDocs.find((d: any) => d.id?.toUpperCase().startsWith('F'));

                if (bdcDoc) {
                  const isPaid = ['paid', 'signed', 'accepted'].includes(bdcDoc.status);
                  newState.bdc = isPaid ? 'paid' : 'created';
                }
                
                if (acDoc) {
                  newState.depositInvoice = acDoc.status === 'paid' ? 'paid' : 'created';
                }
                
                if (finalDoc) {
                  newState.finalInvoice = finalDoc.status === 'paid' ? 'paid' : 'created';
                }

                return newState;
              });
            }
          }
        }
      } catch (err) {
        console.error("Erreur lors de la vérification Abby:", err);
      } finally {
        setIsLoadingDocs(false);
      }
    };
    initAbbyAndDocs();
  }, [appointment]);

  const silentUpdateDataverse = async (payload: any) => {
    try {
      await apiFetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      onUpdate(); 
    } catch (e) {
      console.error("Erreur lors de la mise à jour silencieuse :", e);
    }
  };

  const handleCreateAbbyDocument = async (type: string) => {
    if (!hasApiKey) {
      alert("Veuillez d'abord configurer votre clé API Abby dans les paramètres.");
      return;
    }
    
    setIsCreating(type);
    try {
      const res = await apiFetch('/api/abby/create-document', {
        method: 'POST',
        body: JSON.stringify({ appointment, type }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      if (res.ok) {
        if (type === 'Bon de commande') {
          setDocState(prev => ({ ...prev, bdc: 'created' }));
          setFormData(prev => ({ ...prev, orderForm: 'Édité' }));
          await silentUpdateDataverse({ cr7e0_boncommande: "129690000" }); 
        } else if (type === "Facture d'acompte") {
          setDocState(prev => ({ ...prev, depositInvoice: 'created' }));
        } else if (type === 'Facture finale') {
          setDocState(prev => ({ ...prev, finalInvoice: 'created' }));
        }
      } else {
        alert(data.error || "Erreur lors de la création du document.");
      }
    } catch (err) {
      alert("Erreur réseau lors de la création du document.");
    } finally {
      setIsCreating(null);
    }
  };

  const handlePayDocument = async (type: string) => {
    setIsCreating(`pay_${type}`);
    try {
      await apiFetch('/api/abby/pay-document', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: appointment.id, type })
      });
      
      if (type === "Facture d'acompte") {
        setDocState(prev => ({ ...prev, depositInvoice: 'paid' }));
        setFormData(prev => ({ ...prev, deposit: 'Oui' }));
        await silentUpdateDataverse({ cr7e0_acompte: "129690000" }); 
      } else if (type === 'Facture finale') {
        setDocState(prev => ({ ...prev, finalInvoice: 'paid' }));
      }
    } catch (err) {
      alert("Erreur lors de l'encaissement.");
    } finally {
      setIsCreating(null);
    }
  };

  const handleSendPdf = async () => {
    if (!appointment.clientEmail) {
      alert("Ce client n'a pas d'adresse email renseignée.");
      return;
    }
    setEmailStatus('sending');
    try {
      const res = await apiFetch(`/api/appointments/${appointment.id}/send-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clientEmail: appointment.clientEmail, 
          clientName: appointment.client 
        })
      });
      setEmailStatus(res.ok ? 'success' : 'error');
    } catch (e) {
      setEmailStatus('error');
    }
    setTimeout(() => setEmailStatus('idle'), 5000);
  };

  const getControlStatus = (appt: any) => {
    const style = (appt.style || "").trim();
    const deposit = appt.deposit || "Non";
    const total = parseFloat((appt.total || 0).toString());
    const orderForm = appt.orderForm || "Non édité";

    let baseStatus = "Validé";
    if (!style) {
      baseStatus = "A contrôler";
    } else if (style.toLowerCase() === "flash" || style.toLowerCase() === "projet perso") {
      const hasDeposit = deposit === "Oui" || deposit === "Dispensé";
      const hasTotal = total > 0;
      const isFree = total === 0;

      if (!isFree && (!hasDeposit || !hasTotal)) {
        baseStatus = "A contrôler";
      }
    }

    if (baseStatus === "A contrôler") {
      if (orderForm === "Non édité") {
        return { label: "A contrôler + BDC", color: "bg-rose-500/10 text-rose-400 border border-rose-500/20" };
      }
      return { label: "À contrôler", color: "bg-rose-500/10 text-rose-400 border border-rose-500/20" };
    }

    if (baseStatus === "Validé") {
      if (orderForm === "Non édité") {
        return { label: "Bon de commande à faire", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20" };
      }
      if (orderForm === "Édité" || orderForm === "Dispensé") {
        return { label: "Complété", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" };
      }
      return { label: "Validé", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" };
    }

    return { label: baseStatus, color: "bg-gray-500/10 text-gray-400 border border-gray-500/20" };
  };

  const currentControlStatus = isEditing 
    ? getControlStatus({ style: formData.style, deposit: formData.deposit, total: formData.total, orderForm: formData.orderForm })
    : getControlStatus(appointment);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      
      const orderFormIds: Record<string, number> = { "Édité": 129690000, "Non édité": 129690001, "Dispensé": 129690002 };
      const depositIds: Record<string, number> = { "Oui": 129690000, "Non": 129690001, "Dispensé": 129690002 };
      const styleIds: Record<string, number> = { "Flash": 129690000, "Projet perso": 129690001, "Retouches": 129690002, "RDV Préparatoire": 129690003, "Event": 129690004, "Cadeau": 129690005 };

      const updatePayload: any = {
        cr7e0_daterdv: dateTime.toISOString(),
        cr7e0_tariftattoo: parseFloat(formData.total.toString()),
        cr7e0_acompte: (depositIds[formData.deposit] || 129690001).toString(),
        cr7e0_montantacompte: parseFloat(formData.depositAmount.toString()),
        cr7e0_typederdv: (styleIds[formData.style] || 129690000).toString(),
        cr7e0_boncommande: (orderFormIds[formData.orderForm] || 129690001).toString(),
        cr7e0_emplacement: formData.location,
        cr7e0_recapitulatifprojet: formData.projectRecap,
        cr7e0_taille: formData.size,
        cr7e0_etatdessin: formData.projectStatus
      };

      const response = await apiFetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la mise à jour");
      }

      onUpdate();
    } catch (err: any) {
      console.error("Erreur sauvegarde:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError(null);
    setShowDeleteConfirm(false);
    try {
      const response = await apiFetch(`/api/appointments/${appointment.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error("Erreur lors de la suppression");
      onUpdate();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Retour</span>
        </button>
        
        <div className="flex items-center space-x-3">
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all flex items-center space-x-2">
              <Edit2 size={16} /><span>Modifier</span>
            </button>
          ) : (
            <>
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium transition-all">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-lilas text-black rounded-xl text-sm font-bold transition-all flex items-center space-x-2 disabled:opacity-50">
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex items-center space-x-3">
          <AlertCircle size={20} /><span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* COLONNE GAUCHE : INFOS CLIENT */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card p-8">
            <div className="flex items-center space-x-6 mb-8">
              <div className="w-20 h-20 rounded-full bg-lilas/10 flex items-center justify-center text-lilas text-3xl font-bold border-2 border-lilas/20">
                {appointment.client.charAt(0)}
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-1">{appointment.client}</h2>
                <p className="text-gray-400">{appointment.clientEmail || 'Pas d\'email renseigné'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Type de projet</label>
                {isEditing ? (
                  <select value={formData.style} onChange={(e) => setFormData({...formData, style: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all appearance-none">
                    <option value="Flash">Flash</option>
                    <option value="Projet perso">Projet perso</option>
                    <option value="Retouches">Retouches</option>
                    <option value="RDV Préparatoire">RDV Préparatoire</option>
                    <option value="Event">Event</option>
                    <option value="Cadeau">Cadeau</option>
                  </select>
                ) : <p className="text-lg font-medium">{appointment.style}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Contrôle</label>
                <div className="flex items-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${currentControlStatus.color}`}>
                    {currentControlStatus.label}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Date</label>
                {isEditing ? (
                  <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all" />
                ) : <p className="text-lg font-medium">{appointment.date}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Heure</label>
                {isEditing ? (
                  <input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all" />
                ) : <p className="text-lg font-medium">{appointment.time}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Bon de commande</label>
                {isEditing ? (
                  <select value={formData.orderForm} onChange={(e) => setFormData({...formData, orderForm: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all appearance-none">
                    <option value="Non édité">Non édité</option>
                    <option value="Édité">Édité</option>
                    <option value="Dispensé">Dispensé</option>
                  </select>
                ) : <p className="text-lg font-medium">{formData.orderForm}</p>}
              </div>
            </div>
          </div>

          <div className="glass-card p-8">
            <h3 className="text-xl font-bold mb-6">Détails du projet</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Emplacement</label>
                {isEditing ? (
                  <input type="text" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all" placeholder="Ex: Avant-bras interne" />
                ) : <p className="text-lg font-medium">{appointment.location || 'Non renseigné'}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Taille</label>
                {isEditing ? (
                  <input type="text" value={formData.size} onChange={(e) => setFormData({...formData, size: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all" placeholder="Ex: 15cm x 10cm" />
                ) : <p className="text-lg font-medium">{appointment.size || 'Non renseignée'}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">État du dessin</label>
                {isEditing ? (
                  <select value={formData.projectStatus} onChange={(e) => setFormData({...formData, projectStatus: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all appearance-none">
                    <option value="Non nécessaire">Non nécessaire</option>
                    <option value="À dessiner">À dessiner</option>
                    <option value="Dessiné">Dessiné</option>
                    <option value="Envoyé">Envoyé</option>
                    <option value="À modifier">À modifier</option>
                    <option value="Validé">Validé</option>
                  </select>
                ) : (
                  <div className="flex items-center mt-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      appointment.projectStatus === 'Validé' || appointment.projectStatus === 'Non nécessaire' ? 'bg-emerald-500/10 text-emerald-400' :
                      appointment.projectStatus === 'À dessiner' || appointment.projectStatus === 'À modifier' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-blue-500/10 text-blue-400'
                    }`}>{appointment.projectStatus}</span>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Récap Projet</label>
                {isEditing ? (
                  <textarea value={formData.projectRecap} onChange={(e) => setFormData({...formData, projectRecap: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all min-h-[100px]" placeholder="Détails du projet..." />
                ) : <p className="text-lg font-medium whitespace-pre-wrap">{appointment.projectRecap || 'Aucun récapitulatif'}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : PAIEMENT & ACTIONS */}
        <div className="space-y-8">
          <div className="glass-card p-8 border-t-4 border-lilas">
            <h3 className="text-xl font-bold mb-6 flex items-center space-x-2">
              <Wallet size={20} className="text-lilas" />
              <span>Paiement</span>
            </h3>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Tarif Total</span>
                {isEditing ? (
                  <div className="relative w-32">
                    <input type="number" value={formData.total || ''} onChange={(e) => { const val = e.target.value; const newTotal = val === '' ? 0 : parseFloat(val); setFormData({ ...formData, total: newTotal, depositAmount: calculateDefaultDeposit(newTotal) }); }} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-right focus:outline-none focus:border-lilas/50" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  </div>
                ) : <span className="text-2xl font-bold text-lilas">{appointment.total}€</span>}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Acompte versé</span>
                {isEditing ? (
                  <select value={formData.deposit} onChange={(e) => { setFormData({ ...formData, deposit: e.target.value, depositAmount: formData.depositAmount || calculateDefaultDeposit(formData.total) }); }} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus:outline-none">
                    <option value="Oui">Oui</option>
                    <option value="Non">Non</option>
                    <option value="Dispensé">Dispensé</option>
                  </select>
                ) : (
                  <span className={`font-bold ${formData.deposit === 'Oui' ? 'text-emerald-400' : formData.deposit === 'Dispensé' ? 'text-purple-400' : 'text-rose-400'}`}>
                    {formData.deposit}
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Montant Acompte</span>
                {isEditing ? (
                  <div className="relative w-32">
                    <input type="number" value={formData.depositAmount} onChange={(e) => setFormData({...formData, depositAmount: parseFloat(e.target.value) || 0})} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-right focus:outline-none focus:border-lilas/50" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  </div>
                ) : <span className="font-medium">{appointment.depositAmount || calculateDefaultDeposit(appointment.total)}€</span>}
              </div>

              <div className="pt-6 border-t border-white/5 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Total</span>
                  <span>{formData.total}€</span>
                </div>
                
                {formData.deposit === 'Oui' ? (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Acompte</span>
                      <span className="text-rose-400">-{formData.depositAmount}€</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                      <span className="text-base font-bold text-gray-300">Reste à percevoir</span>
                      <span className="text-2xl font-black text-lilas">{formData.total - formData.depositAmount}€</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center pt-3 border-t border-white/5">
                    <span className="text-base font-bold text-gray-300">Total à percevoir</span>
                    <span className="text-2xl font-black text-lilas">{formData.total}€</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="glass-card p-6 border-t-4 border-blue-500/50">
            <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center space-x-2 mb-4">
              <Mail size={12} /><span>Communication Client</span>
            </label>
            <button onClick={handleSendPdf} disabled={emailStatus !== 'idle' || !appointment.clientEmail} className={`w-full py-3 border rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 disabled:opacity-80 ${emailStatus === 'idle' ? 'bg-blue-500/10 hover:bg-blue-500 hover:text-white border-blue-500/20 text-blue-400' : ''} ${emailStatus === 'sending' ? 'bg-blue-500/20 border-blue-500/30 text-blue-300 cursor-wait' : ''} ${emailStatus === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : ''} ${emailStatus === 'error' ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' : ''}`}>
              {emailStatus === 'idle' && <Mail size={18} />}
              {emailStatus === 'sending' && <RefreshCw size={18} className="animate-spin" />}
              {emailStatus === 'success' && <Check size={18} />}
              {emailStatus === 'error' && <AlertCircle size={18} />}
              <span>{emailStatus === 'idle' ? 'Envoi fiche de soins' : emailStatus === 'sending' ? 'Envoi en cours...' : emailStatus === 'success' ? 'Email envoyé !' : 'Erreur d\'envoi'}</span>
            </button>
          </div>

          {/* SECTION FACTURATION ABBY INTELLIGENTE : Ne s'affiche QUE si le total est > 0 */}
          {parseFloat(formData.total.toString()) > 0 && (
            <div className="glass-card p-6 border-t-4 border-emerald-500/50 relative">
              {isLoadingDocs && (
                <div className="absolute inset-0 bg-dark-bg/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                  <RefreshCw className="animate-spin text-emerald-500" size={24} />
                </div>
              )}

              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center space-x-2 mb-4">
                <FileText size={12} />
                <span>Facturation (Abby)</span>
              </label>
              
              {hasApiKey === false ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs">
                  Veuillez connecter votre clé API Abby dans les paramètres.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 1. BON DE COMMANDE */}
                  {docState.bdc === 'none' && (
                    <button 
                      onClick={() => handleCreateAbbyDocument('Bon de commande')}
                      disabled={isCreating === 'Bon de commande'}
                      className="w-full py-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/20 rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {isCreating === 'Bon de commande' ? <RefreshCw size={16} className="animate-spin" /> : <FileText size={16} />}
                      <span>Éditer le bon de commande</span>
                    </button>
                  )}

                  {/* 2. ACOMPTE ET FACTURE FINALE */}
                  {docState.bdc !== 'none' && (
                    <>
                      {/* ACOMPTE */}
                      {formData.deposit !== 'Dispensé' && (
                        docState.depositInvoice === 'none' ? (
                          <button 
                            onClick={() => handleCreateAbbyDocument("Facture d'acompte")}
                            disabled={isCreating === "Facture d'acompte"}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all flex items-center justify-between px-4 disabled:opacity-50"
                          >
                            <div className="flex items-center space-x-3"><Receipt size={16} className="text-lilas" /><span>Créer Facture d'acompte</span></div>
                            {isCreating === "Facture d'acompte" ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} className="text-gray-400" />}
                          </button>
                        ) : docState.depositInvoice === 'created' ? (
                          <button 
                            onClick={() => handlePayDocument("Facture d'acompte")}
                            disabled={isCreating === "pay_Facture d'acompte"}
                            className="w-full py-3 bg-amber-500 text-black rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                          >
                            {isCreating === "pay_Facture d'acompte" ? <RefreshCw size={16} className="animate-spin" /> : <CreditCard size={16} />}
                            <span>Encaisser acompte</span>
                          </button>
                        ) : (
                          <div className="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-bold flex items-center justify-center space-x-2">
                            <CheckCircle2 size={16} /><span>Acompte payé</span>
                          </div>
                        )
                      )}

                      {/* FACTURE FINALE */}
                      {docState.finalInvoice === 'none' ? (
                        <button 
                          onClick={() => handleCreateAbbyDocument('Facture finale')}
                          disabled={isCreating === 'Facture finale'}
                          className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all flex items-center justify-between px-4 disabled:opacity-50"
                        >
                          <div className="flex items-center space-x-3"><Receipt size={16} className="text-lilas" /><span>Créer Facture finale</span></div>
                          {isCreating === 'Facture finale' ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} className="text-gray-400" />}
                        </button>
                      ) : docState.finalInvoice === 'created' ? (
                        <button 
                          onClick={() => handlePayDocument('Facture finale')}
                          disabled={isCreating === "pay_Facture finale"}
                          className="w-full py-3 bg-amber-500 text-black rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                        >
                          {isCreating === "pay_Facture finale" ? <RefreshCw size={16} className="animate-spin" /> : <CreditCard size={16} />}
                          <span>Encaisser facture</span>
                        </button>
                      ) : (
                        <div className="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-bold flex items-center justify-center space-x-2">
                          <CheckCircle2 size={16} /><span>Facture payée</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="glass-card p-6 bg-rose-500/5 border border-rose-500/10">
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving}
              className="w-full flex items-center justify-center space-x-2 text-rose-400 hover:text-rose-300 transition-colors py-2 disabled:opacity-50"
            >
              <Trash2 size={18} />
              <span className="font-medium">Annuler le rendez-vous</span>
            </button>
          </div>

          {/* Confirmation Modal */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteConfirm(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md glass-card p-8 border-rose-500/20 bg-[#0A0A0B]">
                  <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto mb-6"><Trash2 size={32} /></div>
                  <h3 className="text-xl font-bold text-center mb-2">Annuler le rendez-vous ?</h3>
                  <p className="text-gray-400 text-center text-sm mb-8">Cette action est irréversible. Toutes les données liées à ce rendez-vous seront définitivement supprimées.</p>
                  <div className="flex flex-col space-y-3">
                    <button onClick={handleDelete} disabled={saving} className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50">
                      {saving ? "Suppression..." : "Confirmer la suppression"}
                    </button>
                    <button onClick={() => setShowDeleteConfirm(false)} disabled={saving} className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-2xl transition-all border border-white/5">
                      Garder le rendez-vous
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};