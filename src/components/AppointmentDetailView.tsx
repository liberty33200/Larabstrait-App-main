import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Edit2, Save, RefreshCw, AlertCircle, 
  Calendar, Clock, Wallet, CheckCircle2, Mail, Check, Trash2,
  FileSignature, Download, PenTool, Link, X, Plus
} from 'lucide-react';
import { ConsentFormView } from './ConsentFormView';

export const AppointmentDetailView = ({ appointment, onBack, onUpdate, apiFetch }: any) => {
  const [isEditing, setIsEditing] = useState(false);

  const calculateDefaultDeposit = (total: number) => {
    const t = parseFloat(total.toString());
    if (t === 0) return 0;
    if (t < 200) return 50;
    return t * 0.25;
  };
  
  const [formData, setFormData] = useState({
    date: appointment.appointment_date ? new Date(appointment.appointment_date).toISOString().split('T')[0] : '',
    time: appointment.appointment_date ? new Date(appointment.appointment_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '14:00',
    style: appointment.style || '',
    total: appointment.total || 0,
    deposit: appointment.deposit || 'Non',
    depositAmount: appointment.deposit === 'Dispensé' ? 0 : (appointment.depositAmount || calculateDefaultDeposit(appointment.total || 0)),
    status: appointment.status || 'Confirmé',
    location: appointment.location || '',
    projectRecap: appointment.projectRecap || '',
    size: appointment.size || '',
    projectStatus: appointment.projectStatus || 'À dessiner',
    phone: appointment.phone || '',
    instagram: appointment.instagram || ''
  });

  const [abbyIds, setAbbyIds] = useState({
    bdc: appointment.abbyBdcId || '',
    deposit: appointment.abbyAcompteId || '',
    final: appointment.abbyFactureId || ''
  });

  const [savingAbbyIds, setSavingAbbyIds] = useState(false);
  // ✅ NOUVEAU : état de création par type de document
  const [creating, setCreating] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<{ type: string; status: 'success' | 'error'; message?: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [hasConsent, setHasConsent] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const [allAbbyDocs, setAllAbbyDocs] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      setIsLoadingDocs(true);
      try {
        const resDocs = await apiFetch('/api/abby/documents');
        if (resDocs.ok) {
          const allDocs = await resDocs.json();
          if (isMounted) setAllAbbyDocs(allDocs);
        }
        const resC = await apiFetch(`/api/appointments/${appointment.id}/check-consent`);
        if (resC.ok) {
          const data = await resC.json();
          if (isMounted) setHasConsent(data.exists);
        }
      } catch (err) {}
      if (isMounted) setIsLoadingDocs(false);
    };
    initData();
    return () => { isMounted = false; };
  }, [appointment.id]);

  const handleSendPdf = async () => {
    if (!appointment.clientEmail) { alert("Ce client n'a pas d'adresse email renseignée."); return; }
    setEmailStatus('sending');
    try {
      const res = await apiFetch(`/api/appointments/${appointment.id}/send-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientEmail: appointment.clientEmail, clientName: appointment.client }) });
      setEmailStatus(res.ok ? 'success' : 'error');
    } catch (e) { setEmailStatus('error'); }
    setTimeout(() => setEmailStatus('idle'), 5000);
  };

  const getControlStatus = (appt: any) => {
    const style = (appt.style || "").trim();
    const deposit = appt.deposit || "Non";
    const total = parseFloat((appt.total || 0).toString());
    let baseStatus = "Validé";
    if (!style) baseStatus = "A contrôler";
    else if (style.toLowerCase() === "flash" || style.toLowerCase() === "projet perso") {
      if (total !== 0 && (!(deposit === "Oui" || deposit === "Dispensé") || total <= 0)) baseStatus = "A contrôler";
    }
    if (baseStatus === "A contrôler") return { label: "À contrôler", color: "bg-rose-500/10 text-rose-400 border border-rose-500/20" };
    if (baseStatus === "Validé") return { label: "Validé", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" };
    return { label: baseStatus, color: "bg-gray-500/10 text-gray-400 border border-gray-500/20" };
  };

  const currentControlStatus = isEditing ? getControlStatus({ style: formData.style, deposit: formData.deposit, total: formData.total }) : getControlStatus(appointment);

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      const updatePayload: any = {
        appointment_date: dateTime.toISOString(), 
        total_price: parseFloat(formData.total.toString()),
        deposit_status: formData.deposit, 
        deposit_amount: parseFloat(formData.depositAmount.toString()),
        style: formData.style,
        location: formData.location, 
        project_recap: formData.projectRecap,
        size: formData.size, 
        project_status: formData.projectStatus,
        client_phone: formData.phone,
        instagram: formData.instagram
      };
      const response = await apiFetch(`/api/appointments/${appointment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatePayload) });
      if (!response.ok) throw new Error("Erreur de mise à jour");
      onUpdate();
      setIsEditing(false);
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const handleSaveAbbyIds = async () => {
    setSavingAbbyIds(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/appointments/${appointment.id}`, { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          abby_bdc_id: abbyIds.bdc,
          abby_deposit_id: abbyIds.deposit,
          abby_final_id: abbyIds.final
        }) 
      });
      if (!response.ok) throw new Error("Erreur.");
      alert("Liaisons Abby enregistrées !");
      onUpdate();
    } catch (err: any) { setError(err.message); } finally { setSavingAbbyIds(false); }
  };

  // ✅ NOUVEAU : Création d'un document Abby depuis l'interface
  const handleCreateDocument = async (type: string) => {
    setCreating(type);
    setCreateResult(null);
    try {
      const appointmentPayload = {
        id: appointment.id,
        client_name: appointment.client,
        client_email: appointment.clientEmail,
        total_price: appointment.total,
        appointment_date: appointment.appointment_date,
      };

      const res = await apiFetch('/api/abby/create-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment: appointmentPayload, type })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.error || "Erreur inconnue");
      }

      // Mise à jour locale de l'état pour afficher l'ID immédiatement
      const newId = data.data?.id;
      if (newId) {
        if (type === "Bon de commande") setAbbyIds(prev => ({ ...prev, bdc: newId }));
        if (type === "Facture d'acompte") setAbbyIds(prev => ({ ...prev, deposit: newId }));
        if (type === "Facture finale") setAbbyIds(prev => ({ ...prev, final: newId }));

        // Rafraîchir la liste des docs Abby pour que le select affiche le nouveau doc
        const resDocs = await apiFetch('/api/abby/documents');
        if (resDocs.ok) setAllAbbyDocs(await resDocs.json());
      }

      setCreateResult({ type, status: 'success' });
      setTimeout(() => setCreateResult(null), 4000);

    } catch (err: any) {
      console.error("Erreur création document Abby:", err.message);
      setCreateResult({ type, status: 'error', message: err.message });
      setTimeout(() => setCreateResult(null), 6000);
    } finally {
      setCreating(null);
    }
  };

  const handleDelete = async () => {
    setSaving(true); setError(null); setShowDeleteConfirm(false);
    try {
      await apiFetch(`/api/appointments/${appointment.id}`, { method: 'DELETE' });
      onUpdate(); 
    } catch (err: any) { 
      setError(err.message); 
      setSaving(false); 
    }
  };

  const suggestedDocs = allAbbyDocs.filter(doc => {
    const clientEmail = (appointment.clientEmail || "").toLowerCase().trim();
    const clientName = (appointment.client || "").toLowerCase().trim();
    const docName = (doc.client || '').toLowerCase();
    const docEmail = (doc.email || '').toLowerCase();
    return (clientEmail && docEmail === clientEmail) || (clientName && (docName.includes(clientName) || clientName.includes(docName)));
  });
  const otherDocs = allAbbyDocs.filter(doc => !suggestedDocs.some(sd => sd.internalId === doc.internalId));

  const renderDocSelect = (label: string, value: string, onChange: any, types: string[]) => {
    const isCurrentInDocs = value && !allAbbyDocs.some(d => d.internalId === value);
    const sugg = suggestedDocs.filter(d => types.some(t => d.type.includes(t)));
    const oth = otherDocs.filter(d => types.some(t => d.type.includes(t)));

    return (
      <select 
        value={value} 
        onChange={onChange} 
        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/50 min-w-0"
      >
        <option value="">-- Non lié --</option>
        {isCurrentInDocs && <option value={value}>{value} (ID actuel conservé)</option>}
        {sugg.length > 0 && (
          <optgroup label={`Suggérés pour ${appointment.client}`}>
            {sugg.map(d => <option key={d.internalId} value={d.internalId}>{d.client} : {d.id} - {d.amount}€ ({d.statusLabel})</option>)}
          </optgroup>
        )}
        <optgroup label="Autres documents récents">
          {oth.map(d => <option key={d.internalId} value={d.internalId}>{d.client} : {d.id} - {d.amount}€ ({d.statusLabel})</option>)}
        </optgroup>
      </select>
    );
  };

  // ✅ NOUVEAU : Rendu d'une ligne avec select + bouton Créer
  const renderDocRow = (
    label: string,
    docType: string,
    value: string,
    onChange: any,
    types: string[],
    alreadyExists: boolean
  ) => {
    const isCreating = creating === docType;
    const result = createResult?.type === docType ? createResult : null;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-400">{label}</label>
          {/* Badge de résultat de création */}
          {result && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              result.status === 'success' 
                ? 'bg-emerald-500/10 text-emerald-400' 
                : 'bg-rose-500/10 text-rose-400'
            }`}>
              {result.status === 'success' ? '✓ Créé !' : `✗ ${result.message}`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Select de liaison */}
          {renderDocSelect(label, value, onChange, types)}

          {/* ✅ Bouton Créer */}
          <button
            onClick={() => handleCreateDocument(docType)}
            disabled={isCreating || alreadyExists}
            title={alreadyExists ? "Document déjà créé" : `Créer un(e) ${docType} sur Abby`}
            className={`shrink-0 flex items-center space-x-1.5 px-3 py-3 rounded-xl text-xs font-bold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              alreadyExists
                ? 'bg-white/5 border-white/10 text-gray-500'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-400'
            }`}
          >
            {isCreating 
              ? <RefreshCw size={14} className="animate-spin" />
              : alreadyExists 
                ? <Check size={14} />
                : <Plus size={14} />
            }
            <span className="hidden sm:inline">
              {isCreating ? 'Création...' : alreadyExists ? 'Créé' : 'Créer'}
            </span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
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

        {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex items-center space-x-3"><AlertCircle size={20} /><span>{error}</span></div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-card p-8">
              <div className="flex items-start space-x-6 mb-8">
                <div className="w-20 h-20 rounded-full bg-lilas/10 flex items-center justify-center text-lilas text-3xl font-bold border-2 border-lilas/20 shrink-0">
                  {appointment.client?.charAt(0)}
                </div>
                <div className="w-full">
                  <h2 className="text-3xl font-bold mb-1">{appointment.client}</h2>
                  <p className="text-gray-400 mb-3">{appointment.clientEmail || 'Pas d\'email renseigné'}</p>
                  
                  {isEditing ? (
                    <div className="flex flex-col sm:flex-row gap-3 mt-2">
                      <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="Téléphone (ex: 06...)" className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-lilas/50 text-white w-full sm:w-auto" />
                      <input type="text" value={formData.instagram} onChange={(e) => setFormData({...formData, instagram: e.target.value})} placeholder="Instagram (ex: @pseudo)" className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-lilas/50 text-white w-full sm:w-auto" />
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-4 mt-2">
                      {appointment.phone && <p className="text-sm text-gray-300 flex items-center space-x-2"><span className="opacity-70">📞</span> <span>{appointment.phone}</span></p>}
                      {appointment.instagram && <p className="text-sm text-gray-300 flex items-center space-x-2"><span className="opacity-70">📸</span> <span>{appointment.instagram}</span></p>}
                      {!appointment.phone && !appointment.instagram && <p className="text-sm text-gray-500 italic">Aucun numéro ou Instagram</p>}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Type de projet</label>
                  {isEditing ? (
                    <select value={formData.style} onChange={(e) => setFormData({...formData, style: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all appearance-none">
                      <option value="Flash">Flash</option><option value="Projet perso">Projet perso</option><option value="Retouches">Retouches</option><option value="RDV Préparatoire">RDV Préparatoire</option><option value="Event">Event</option><option value="Cadeau">Cadeau</option>
                    </select>
                  ) : <p className="text-lg font-medium">{appointment.style}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Contrôle</label>
                  <div className="flex items-center"><span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${currentControlStatus.color}`}>{currentControlStatus.label}</span></div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Date</label>
                  {isEditing ? <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all" /> : <p className="text-lg font-medium">{appointment.date}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Heure</label>
                  {isEditing ? <input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all" /> : <p className="text-lg font-medium">{formData.time}</p>}
                </div>
              </div>
            </div>

            <div className="glass-card p-8">
              <h3 className="text-xl font-bold mb-6">Détails du projet</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Emplacement</label>
                  {isEditing ? <input type="text" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all" placeholder="Ex: Avant-bras interne" /> : <p className="text-lg font-medium">{appointment.location || 'Non renseigné'}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Taille</label>
                  {isEditing ? <input type="text" value={formData.size} onChange={(e) => setFormData({...formData, size: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all" placeholder="Ex: 15cm x 10cm" /> : <p className="text-lg font-medium">{appointment.size || 'Non renseignée'}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">État du dessin</label>
                  {isEditing ? (
                    <select value={formData.projectStatus} onChange={(e) => setFormData({...formData, projectStatus: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all appearance-none">
                      <option value="Non nécessaire">Non nécessaire</option><option value="À dessiner">À dessiner</option><option value="Dessiné">Dessiné</option><option value="Envoyé">Envoyé</option><option value="À modifier">À modifier</option><option value="Validé">Validé</option>
                    </select>
                  ) : (
                    <div className="flex items-center mt-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${appointment.projectStatus === 'Validé' || appointment.projectStatus === 'Non nécessaire' ? 'bg-emerald-500/10 text-emerald-400' : appointment.projectStatus === 'À dessiner' || appointment.projectStatus === 'À modifier' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>{appointment.projectStatus}</span>
                    </div>
                  )}
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Récap Projet</label>
                  {isEditing ? <textarea value={formData.projectRecap} onChange={(e) => setFormData({...formData, projectRecap: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all min-h-[100px]" placeholder="Détails du projet..." /> : <p className="text-lg font-medium whitespace-pre-wrap">{appointment.projectRecap || 'Aucun récapitulatif'}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="glass-card p-8 border-t-4 border-lilas">
              <h3 className="text-xl font-bold mb-6 flex items-center space-x-2"><Wallet size={20} className="text-lilas" /><span>Paiement</span></h3>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Tarif Total</span>
                  {isEditing ? (
                    <div className="relative w-32">
                      <input type="number" value={formData.total || ''} onChange={(e) => { const val = e.target.value; const newTotal = val === '' ? 0 : parseFloat(val); setFormData({ ...formData, total: newTotal, depositAmount: formData.deposit === 'Dispensé' ? 0 : calculateDefaultDeposit(newTotal) }); }} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-right focus:outline-none focus:border-lilas/50" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                    </div>
                  ) : <span className="text-2xl font-bold text-lilas">{appointment.total}€</span>}
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Acompte versé</span>
                  {isEditing ? (
                    <select value={formData.deposit} onChange={(e) => { const newDeposit = e.target.value; setFormData({ ...formData, deposit: newDeposit, depositAmount: newDeposit === 'Dispensé' ? 0 : (formData.depositAmount || calculateDefaultDeposit(formData.total)) }); }} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus:outline-none">
                      <option value="Oui">Oui</option><option value="Non">Non</option><option value="Dispensé">Dispensé</option>
                    </select>
                  ) : <span className={`font-bold ${formData.deposit === 'Oui' ? 'text-emerald-400' : formData.deposit === 'Dispensé' ? 'text-purple-400' : 'text-rose-400'}`}>{formData.deposit}</span>}
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Montant Acompte</span>
                  {isEditing ? (
                    <div className="relative w-32">
                      <input type="number" disabled={formData.deposit === 'Dispensé'} value={formData.depositAmount} onChange={(e) => setFormData({...formData, depositAmount: parseFloat(e.target.value) || 0})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-right focus:outline-none focus:border-lilas/50 disabled:opacity-50" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                    </div>
                  ) : <span className="font-medium">{appointment.depositAmount}€</span>}
                </div>

                <div className="pt-6 border-t border-white/5 space-y-3">
                  <div className="flex justify-between items-center text-sm"><span className="text-gray-400">Total</span><span>{formData.total}€</span></div>
                  {formData.deposit !== 'Dispensé' ? (
                    <>
                      <div className="flex justify-between items-center text-sm"><span className="text-gray-400">Acompte</span><span className="text-rose-400">-{formData.depositAmount}€</span></div>
                      <div className="flex justify-between items-center pt-3 border-t border-white/5"><span className="text-base font-bold text-gray-300">Reste à percevoir</span><span className="text-2xl font-black text-lilas">{formData.total - formData.depositAmount}€</span></div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center pt-3 border-t border-white/5"><span className="text-base font-bold text-gray-300">Total à percevoir</span><span className="text-2xl font-black text-lilas">{formData.total}€</span></div>
                  )}
                </div>
              </div>
            </div>

            {/* ✅ SECTION LIAISONS ABBY AVEC BOUTONS CRÉER */}
            <div className="glass-card p-6 border-t-4 border-emerald-500/50">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center space-x-2 mb-4">
                <Link size={12} /><span>Liaisons Abby</span>
              </label>
              
              <div className="space-y-4">
                {isLoadingDocs ? (
                  <div className="text-center py-4 text-emerald-500 flex items-center justify-center space-x-2">
                    <RefreshCw className="animate-spin" size={16} /> <span>Chargement des documents...</span>
                  </div>
                ) : (
                  <>
                    {renderDocRow(
                      "Bon de commande",
                      "Bon de commande",
                      abbyIds.bdc,
                      (e: any) => setAbbyIds({...abbyIds, bdc: e.target.value}),
                      ["Bon de commande", "Devis"],
                      !!abbyIds.bdc
                    )}

                    {renderDocRow(
                      "Facture d'acompte",
                      "Facture d'acompte",
                      abbyIds.deposit,
                      (e: any) => setAbbyIds({...abbyIds, deposit: e.target.value}),
                      ["Facture d'acompte", "Facture"],
                      !!abbyIds.deposit
                    )}

                    {renderDocRow(
                      "Facture finale",
                      "Facture finale",
                      abbyIds.final,
                      (e: any) => setAbbyIds({...abbyIds, final: e.target.value}),
                      ["Facture"],
                      !!abbyIds.final
                    )}
                    
                    <button onClick={handleSaveAbbyIds} disabled={savingAbbyIds} className="w-full mt-2 py-3 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl text-sm font-bold flex items-center justify-center space-x-2">
                      {savingAbbyIds ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                      <span>Enregistrer les liaisons</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="glass-card p-6 border-t-4 border-purple-500/50">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center space-x-2 mb-4">
                <FileSignature size={12} /><span>Décharge & Consentement</span>
              </label>
              
              {hasConsent ? (
                <div className="space-y-3">
                  <div className="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-bold flex items-center justify-center space-x-2">
                    <CheckCircle2 size={16} /><span>Décharge signée</span>
                  </div>
                  <a href={`/api/appointments/${appointment.id}/download-consent`} target="_blank" rel="noopener noreferrer" className="w-full py-3 bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white border border-purple-500/20 rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2">
                    <Download size={16} /><span>Télécharger le PDF</span>
                  </a>
                </div>
              ) : (
                <button onClick={() => setShowConsentModal(true)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2">
                  <PenTool size={16} /><span>Faire signer la décharge</span>
                </button>
              )}
            </div>

            <div className="glass-card p-6 border-t-4 border-blue-500/50">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center space-x-2 mb-4"><Mail size={12} /><span>Communication Client</span></label>
              <button onClick={handleSendPdf} disabled={emailStatus !== 'idle' || !appointment.clientEmail} className={`w-full py-3 border rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 disabled:opacity-80 ${emailStatus === 'idle' ? 'bg-blue-500/10 hover:bg-blue-500 hover:text-white border-blue-500/20 text-blue-400' : ''} ${emailStatus === 'sending' ? 'bg-blue-500/20 border-blue-500/30 text-blue-300 cursor-wait' : ''} ${emailStatus === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : ''} ${emailStatus === 'error' ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' : ''}`}>
                {emailStatus === 'idle' && <Mail size={18} />}{emailStatus === 'sending' && <RefreshCw size={18} className="animate-spin" />}{emailStatus === 'success' && <Check size={18} />}{emailStatus === 'error' && <AlertCircle size={18} />}
                <span>{emailStatus === 'idle' ? 'Envoi fiche de soins' : emailStatus === 'sending' ? 'Envoi en cours...' : emailStatus === 'success' ? 'Email envoyé !' : 'Erreur d\'envoi'}</span>
              </button>
            </div>

            <div className="glass-card p-6 bg-rose-500/5 border border-rose-500/10">
              <button onClick={() => setShowDeleteConfirm(true)} disabled={saving} className="w-full flex items-center justify-center space-x-2 text-rose-400 hover:text-rose-300 transition-colors py-2 disabled:opacity-50">
                <Trash2 size={18} /><span>Annuler le rendez-vous</span>
              </button>
            </div>

            <AnimatePresence>
              {showDeleteConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteConfirm(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md glass-card p-8 border-rose-500/20 bg-[#0A0A0B]">
                    <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto mb-6"><Trash2 size={32} /></div>
                    <h3 className="text-xl font-bold text-center mb-2">Annuler le rendez-vous ?</h3>
                    <p className="text-gray-400 text-center text-sm mb-8">Cette action est irréversible.</p>
                    <div className="flex flex-col space-y-3">
                      <button onClick={handleDelete} disabled={saving} className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50">{saving ? "Suppression..." : "Confirmer la suppression"}</button>
                      <button onClick={() => setShowDeleteConfirm(false)} disabled={saving} className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-2xl transition-all border border-white/5">Garder le rendez-vous</button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showConsentModal && (
          <ConsentFormView 
            appointment={appointment} 
            onClose={() => setShowConsentModal(false)} 
            onSaved={() => { setShowConsentModal(false); setHasConsent(true); }} 
            apiFetch={apiFetch} 
          />
        )}
      </AnimatePresence>
    </>
  );
};