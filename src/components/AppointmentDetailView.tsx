import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Edit2, Save, RefreshCw, AlertCircle, 
  Calendar, Clock, Wallet, CheckCircle2, Mail, Check, Trash2,
  FileText, Receipt, Plus, CreditCard, FileSignature, Download, PenTool, X, Eraser, Link
} from 'lucide-react';

// ==========================================
// COMPOSANT : FENÊTRE DE CONSENTEMENT
// ==========================================
const ConsentModal = ({ appointment, onClose, onSaved, apiFetch }: any) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    phone: appointment.phone || '',
    instagram: appointment.instagram || '',
    hasDisease: 'Non',
    hasTreatment: 'Non',
    isPregnant: 'Non',
    hasAllergies: 'Non',
    needleRef: '',
    inkRef: ''
  });

  const nameParts = (appointment.client || '').trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  useEffect(() => {
    if (!(window as any).jspdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      document.body.appendChild(script);
    }
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); 
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#c084fc'; 
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
  }, []);

  const handleSave = async () => {
    const jsPDFObj = (window as any).jspdf;
    if (!jsPDFObj) {
      setError("Le module PDF charge... Réessayez dans 2 secondes.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      setError("Veuillez signer la décharge avant de valider.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const { jsPDF } = jsPDFObj;
      const doc = new jsPDF();
      let y = 20;

      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("FEUILLE DE CONSENTEMENT", 105, y, { align: "center" });
      y += 15;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Nom: ${lastName}`, 20, y);
      doc.text(`Prénom: ${firstName}`, 105, y);
      y += 8;
      doc.text(`Email: ${appointment.clientEmail || '_________________'}`, 20, y);
      doc.text(`Tél: ${form.phone || '_________________'}`, 105, y);
      y += 8;
      doc.text(`Instagram: ${form.instagram || '_________________'}`, 20, y);
      doc.text(`Date du jour: ${new Date().toLocaleDateString('fr-FR')}`, 105, y);
      y += 15;

      const location = appointment.location || '_________________';
      const style = appointment.style || '_________________';
      const total = appointment.total || '_____';
      
      const intro = `Suite à nos échanges, nous aurons convenu que le tatouage sera situé ${location}, que le motif sera ${style}. Le prix sera donc de ${total}€.`;
      const splitIntro = doc.splitTextToSize(intro, 170);
      doc.text(splitIntro, 20, y);
      y += splitIntro.length * 6 + 5;

      const rule1 = "Le client arrivera propre et douché, n'ayant pas consommé d'alcool ou de stupéfiants depuis 48h.";
      doc.text(doc.splitTextToSize(rule1, 170), 20, y);
      y += 10;
      doc.text("Le tatoueur agit selon le décret du 19 février 2008.", 20, y);
      y += 8;
      
      const rule2 = "Il est nécessaire de rappeler que le tatouage sera permanent, qu'il peut y avoir de potentiels risques infectieux ou allergiques et que l'acte provoque de la douleur.";
      doc.text(doc.splitTextToSize(rule2, 170), 20, y);
      y += 15;

      doc.setFont("helvetica", "bold");
      doc.text("Questionnaire de santé :", 20, y);
      doc.setFont("helvetica", "normal");
      y += 8;
      
      doc.text(`Avez-vous une maladie ?  ${form.hasDisease}`, 25, y);
      doc.text(`Prenez-vous un traitement ?  ${form.hasTreatment}`, 105, y);
      y += 8;
      doc.text(`Êtes-vous enceinte ou allaitante ?  ${form.isPregnant}`, 25, y);
      doc.text(`Avez-vous des allergies ?  ${form.hasAllergies}`, 105, y);
      y += 15;

      const rule3 = "Lors des soins généraux suite au tatouage et ce jusqu'à la cicatrisation totale (1 mois), le client ne devra pas :";
      doc.text(doc.splitTextToSize(rule3, 170), 20, y);
      y += 8;
      doc.text("- Prendre l'avion", 25, y); y += 6;
      doc.text("- Aller à la piscine, au sauna, au hammam, prendre un bain, faire du sport", 25, y); y += 6;
      doc.text("- Être en contact avec des animaux au niveau de la zone tatouée", 25, y); y += 12;

      doc.text("Je soussigné que les infos ci-dessus ont été lues et comprises :", 20, y);
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.text("Signature du client", 120, y);
      doc.setFont("helvetica", "normal");
      y += 5;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0);
        tempCtx.globalCompositeOperation = 'source-in';
        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.globalCompositeOperation = 'destination-over';
        tempCtx.drawImage(canvas, 0, 0);
      }

      const sigData = tempCanvas.toDataURL("image/png");
      doc.addImage(sigData, 'PNG', 120, y, 60, 30);

      const pdfBase64 = doc.output('datauristring');

      // 🎯 MODIFICATION : Sauvegarde Postgres sans Dataverse
      if (form.phone !== appointment.phone || form.instagram !== appointment.instagram) {
         try {
           await apiFetch(`/api/appointments/${appointment.id}`, {
             method: 'PATCH',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               client_phone: form.phone,
               instagram: form.instagram
             })
           });
         } catch (e) {}
      }

      const res = await apiFetch(`/api/appointments/${appointment.id}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfData: pdfBase64,
          clientName: appointment.client,
          appointmentDate: appointment.appointment_date
        })
      });

      if (!res.ok) throw new Error("Erreur lors de l'enregistrement.");
      onSaved();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRadioChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-[200] bg-dark-bg/95 backdrop-blur-md overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-3xl mx-auto my-0 md:my-8 bg-[#0A0A0B] border border-white/10 md:rounded-3xl shadow-2xl min-h-screen md:min-h-0 flex flex-col text-gray-300">
        <div className="flex justify-between items-center p-6 border-b border-white/5 sticky top-0 z-50 bg-[#0A0A0B]/90 backdrop-blur-sm md:rounded-t-3xl">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <FileSignature className="text-lilas" />
            <span>Feuille de consentement</span>
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 md:p-8 flex-1 space-y-8">
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-lilas">Informations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                <span className="text-xs text-gray-500 uppercase block mb-1">Nom / Prénom</span>
                <span className="font-medium text-white">{appointment.client}</span>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                <span className="text-xs text-gray-500 uppercase block mb-1">Email</span>
                <span className="font-medium text-white">{appointment.clientEmail || 'Non renseigné'}</span>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase block mb-1 ml-1">Téléphone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all text-white" placeholder="06 12 34 56 78" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase block mb-1 ml-1">Instagram</label>
                <input type="text" value={form.instagram} onChange={(e) => setForm({...form, instagram: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all text-white" placeholder="@pseudo" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-lilas">Projet convenu</h3>
            <div className="p-5 bg-white/5 border border-white/5 rounded-xl text-sm leading-relaxed">
              Suite à nos échanges, nous avons convenu que le tatouage sera situé sur <strong className="text-white">{appointment.location || '...'}</strong>, que le motif sera <strong className="text-white">{appointment.style || '...'}</strong>. Le prix sera donc de <strong className="text-white">{appointment.total}€</strong>.
            </div>
            <p className="text-xs text-gray-400 px-2 leading-relaxed">
              Le client arrivera propre et douché, n'ayant pas consommé d'alcool ou de stupéfiants depuis 48h. Le tatoueur agit selon le décret du 19 février 2008. Il est nécessaire de rappeler que le tatouage sera permanent, qu'il peut y avoir de potentiels risques infectieux ou allergiques et que l'acte provoque de la douleur.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-amber-400">Questionnaire de santé</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex justify-between items-center">
                <span className="text-sm text-gray-300">Avez-vous une maladie ?</span>
                <div className="flex space-x-2">
                  <button onClick={() => handleRadioChange('hasDisease', 'Oui')} className={`px-4 py-1 rounded-lg text-sm font-bold transition-all ${form.hasDisease === 'Oui' ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>Oui</button>
                  <button onClick={() => handleRadioChange('hasDisease', 'Non')} className={`px-4 py-1 rounded-lg text-sm font-bold transition-all ${form.hasDisease === 'Non' ? 'bg-lilas text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>Non</button>
                </div>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex justify-between items-center">
                <span className="text-sm text-gray-300">Prenez-vous un traitement ?</span>
                <div className="flex space-x-2">
                  <button onClick={() => handleRadioChange('hasTreatment', 'Oui')} className={`px-4 py-1 rounded-lg text-sm font-bold transition-all ${form.hasTreatment === 'Oui' ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>Oui</button>
                  <button onClick={() => handleRadioChange('hasTreatment', 'Non')} className={`px-4 py-1 rounded-lg text-sm font-bold transition-all ${form.hasTreatment === 'Non' ? 'bg-lilas text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>Non</button>
                </div>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex justify-between items-center">
                <span className="text-sm text-gray-300">Enceinte ou allaitante ?</span>
                <div className="flex space-x-2">
                  <button onClick={() => handleRadioChange('isPregnant', 'Oui')} className={`px-4 py-1 rounded-lg text-sm font-bold transition-all ${form.isPregnant === 'Oui' ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>Oui</button>
                  <button onClick={() => handleRadioChange('isPregnant', 'Non')} className={`px-4 py-1 rounded-lg text-sm font-bold transition-all ${form.isPregnant === 'Non' ? 'bg-lilas text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>Non</button>
                </div>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex justify-between items-center">
                <span className="text-sm text-gray-300">Avez-vous des allergies ?</span>
                <div className="flex space-x-2">
                  <button onClick={() => handleRadioChange('hasAllergies', 'Oui')} className={`px-4 py-1 rounded-lg text-sm font-bold transition-all ${form.hasAllergies === 'Oui' ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>Oui</button>
                  <button onClick={() => handleRadioChange('hasAllergies', 'Non')} className={`px-4 py-1 rounded-lg text-sm font-bold transition-all ${form.hasAllergies === 'Non' ? 'bg-lilas text-black' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>Non</button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5">
            <h3 className="text-sm font-bold uppercase tracking-widest text-lilas">Validation & Signature</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Je m'engage à respecter scrupuleusement les consignes de soins post-tatouage. Je décharge <strong>Larabstrait</strong> de toute responsabilité en cas de complications liées à un mauvais entretien de ma part.
            </p>
            
            <div className="border border-white/20 rounded-2xl bg-white/5 relative overflow-hidden" style={{ touchAction: 'none' }}>
              {!isDrawing && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20"><span className="text-2xl font-bold uppercase tracking-widest">Signer ici</span></div>}
              
              <canvas 
                ref={canvasRef}
                className="w-full h-64 cursor-crosshair relative z-10"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <button 
                onClick={clearCanvas}
                className="absolute bottom-3 right-3 p-3 bg-white/10 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl border border-white/10 text-gray-400 transition-all z-20"
                title="Effacer la signature"
              >
                <Eraser size={20} />
              </button>
            </div>
          </div>

        </div>

        <div className="p-4 md:p-6 bg-white/5 border-t border-white/10 md:rounded-b-3xl mt-auto">
          {error && <div className="mb-4 p-3 bg-rose-500/10 text-rose-400 rounded-xl text-sm text-center font-medium flex justify-center items-center space-x-2 border border-rose-500/20"><AlertCircle size={16} /><span>{error}</span></div>}
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={onClose} disabled={isGenerating} className="flex-1 py-4 text-gray-400 bg-white/5 border border-white/10 font-bold rounded-2xl hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50">
              Annuler
            </button>
            <button onClick={handleSave} disabled={isGenerating} className="flex-1 py-4 bg-lilas text-black font-bold rounded-2xl shadow-[0_0_20px_rgba(192,132,252,0.3)] hover:bg-purple-400 hover:shadow-[0_0_30px_rgba(192,132,252,0.5)] transition-all flex justify-center items-center space-x-2 disabled:opacity-50">
              {isGenerating ? <RefreshCw size={20} className="animate-spin" /> : <Check size={20} />}
              <span>{isGenerating ? 'Génération du PDF...' : 'Valider la décharge'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// COMPOSANT PRINCIPAL : FICHE RENDEZ-VOUS
// ==========================================
export const AppointmentDetailView = ({ appointment, onBack, onUpdate, apiFetch }: any) => {
  const [isEditing, setIsEditing] = useState(false);

  const calculateDefaultDeposit = (total: number) => {
    const t = parseFloat(total.toString());
    if (t === 0) return 0;
    if (t < 200) return 50;
    return t * 0.25;
  };
  
  // 🎯 DONNÉES SÉCURISÉES : On lit les propriétés générées par App.tsx
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const [hasConsent, setHasConsent] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  const abbyAc = appointment.abbyAcompteId;
  const abbyFact = appointment.abbyFactureId;

  const [docState, setDocState] = useState({
    depositInvoice: 'none',
    finalInvoice: 'none'
  });

  const fetchAbbyDocuments = async () => {
    try {
      const resDocs = await apiFetch('/api/abby/documents');
      if (resDocs.ok) {
        const allDocs = await resDocs.json();
        setDocState(prev => {
          const newState = { ...prev };
          const isPaid = (status: string) => ['paid', 'signed', 'accepted'].includes(status);
          
          if (abbyAc) {
            const acDoc = allDocs.find((d: any) => d.internalId === abbyAc);
            if (acDoc) newState.depositInvoice = isPaid(acDoc.status) ? 'paid' : 'created';
          }
          
          if (abbyFact) {
            const finalDoc = allDocs.find((d: any) => d.internalId === abbyFact);
            if (finalDoc) newState.finalInvoice = isPaid(finalDoc.status) ? 'paid' : 'created';
          }
          return newState;
        });
      }
    } catch (err) {
      console.error("Erreur maj documents:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const initAbbyAndDocs = async () => {
      if (!isMounted) return;
      setIsLoadingDocs(true);
      try {
        const resKey = await apiFetch('/api/settings/abby');
        if (resKey.ok) {
          const dataKey = await resKey.json();
          if (!isMounted) return;
          setHasApiKey(!!dataKey.abby_api_key);
          if (dataKey.abby_api_key) {
            await fetchAbbyDocuments();
          }
        }
      } catch (err) {
        console.error("Erreur vérification Abby:", err);
      } finally {
        if (isMounted) setIsLoadingDocs(false);
      }
    };

    const checkConsent = async () => {
      try {
        const res = await apiFetch(`/api/appointments/${appointment.id}/check-consent`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setHasConsent(data.exists);
        }
      } catch (err) {}
    };

    initAbbyAndDocs();
    checkConsent();

    return () => { isMounted = false; };
  }, [appointment.id, abbyAc, abbyFact]);

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

  // 🎯 SAUVEGARDE SILENCIEUSE
  const silentUpdateDataverse = async (payload: any) => {
    try {
      await apiFetch(`/api/appointments/${appointment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      onUpdate(); 
    } catch (e) {}
  };

  const handleCreateAbbyDocument = async (type: string) => {
    if (!hasApiKey) {
      alert("Configurez votre clé API Abby.");
      return;
    }

    setIsCreating(type);
    setError(null);

    try {
      const res = await apiFetch('/api/abby/create-document', {
        method: 'POST',
        body: JSON.stringify({ appointment: { ...appointment, depositAmount: formData.depositAmount, total: formData.total }, type }),
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erreur création ${type}.`);

      const newAbbyId = data?.data?.id || data?.id;
      if (!newAbbyId) throw new Error("Réponse Abby invalide.");

      if (type === "Facture d'acompte") {
        setDocState((prev) => ({ ...prev, depositInvoice: 'created' }));
        await silentUpdateDataverse({ abby_deposit_id: newAbbyId, deposit_amount: formData.depositAmount });
      } else if (type === 'Facture finale') {
        setDocState((prev) => ({ ...prev, finalInvoice: 'created' }));
        await silentUpdateDataverse({ abby_final_id: newAbbyId });
      }
    } catch (err: any) {
      setError(err.message);
      alert(err.message);
    } finally {
      setIsCreating(null);
    }
  };

  const handlePayDocument = async (type: string) => {
    setIsCreating(`pay_${type}`);
    try {
      const docIdToPay = type === "Facture d'acompte" ? abbyAc : abbyFact;
      const res = await apiFetch('/api/abby/pay-document', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ appointmentId: appointment.id, type, abbyDocId: docIdToPay, appointment: appointment }) 
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'encaissement.");
      
      if (type === "Facture d'acompte") {
        setDocState(prev => ({ ...prev, depositInvoice: 'paid' }));
        setFormData(prev => ({ ...prev, deposit: 'Oui' }));
        await silentUpdateDataverse({ deposit_status: 'Oui' }); 
      } else if (type === 'Facture finale') {
        setDocState(prev => ({ ...prev, finalInvoice: 'paid' }));
      }
      alert("Encaissé avec succès !");
    } catch (err: any) { 
      alert(err.message || "Erreur lors de l'encaissement."); 
    } finally { 
      setIsCreating(null); 
    }
  };

  // 🎯 SAUVEGARDE PRINCIPALE AVEC NOMS POSTGRESQL
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
      const payload = {
        abby_bdc_id: abbyIds.bdc,
        abby_deposit_id: abbyIds.deposit,
        abby_final_id: abbyIds.final
      };
      const response = await apiFetch(`/api/appointments/${appointment.id}`, { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      if (!response.ok) throw new Error("Erreur.");
      alert("Liaisons Abby enregistrées !");
      onUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingAbbyIds(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true); setError(null); setShowDeleteConfirm(false);
    try {
      const response = await apiFetch(`/api/appointments/${appointment.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("Erreur suppression");
      onBack();
    } catch (err: any) { setError(err.message); setSaving(false); }
  };

  const isBillableStyle = formData.style.toLowerCase() === 'flash' || formData.style.toLowerCase() === 'projet perso';

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
                      <input 
                        type="number" 
                        value={formData.total || ''} 
                        onChange={(e) => { 
                          const val = e.target.value; 
                          const newTotal = val === '' ? 0 : parseFloat(val); 
                          setFormData({ 
                            ...formData, 
                            total: newTotal, 
                            depositAmount: formData.deposit === 'Dispensé' ? 0 : calculateDefaultDeposit(newTotal) 
                          }); 
                        }} 
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-right focus:outline-none focus:border-lilas/50" 
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                    </div>
                  ) : <span className="text-2xl font-bold text-lilas">{appointment.total}€</span>}
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Acompte versé</span>
                  {isEditing ? (
                    <select 
                      value={formData.deposit} 
                      onChange={(e) => { 
                        const newDeposit = e.target.value;
                        setFormData({ 
                          ...formData, 
                          deposit: newDeposit, 
                          depositAmount: newDeposit === 'Dispensé' ? 0 : (formData.depositAmount || calculateDefaultDeposit(formData.total)) 
                        }); 
                      }} 
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus:outline-none"
                    >
                      <option value="Oui">Oui</option><option value="Non">Non</option><option value="Dispensé">Dispensé</option>
                    </select>
                  ) : <span className={`font-bold ${formData.deposit === 'Oui' ? 'text-emerald-400' : formData.deposit === 'Dispensé' ? 'text-purple-400' : 'text-rose-400'}`}>{formData.deposit}</span>}
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Montant Acompte</span>
                  {isEditing ? (
                    <div className="relative w-32">
                      <input 
                        type="number" 
                        disabled={formData.deposit === 'Dispensé'}
                        value={formData.depositAmount} 
                        onChange={(e) => setFormData({...formData, depositAmount: parseFloat(e.target.value) || 0})} 
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-right focus:outline-none focus:border-lilas/50 disabled:opacity-50" 
                      />
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

            <div className="glass-card p-6 border-t-4 border-purple-500/50">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center space-x-2 mb-4">
                <FileSignature size={12} /><span>Décharge & Consentement</span>
              </label>
              
              {hasConsent ? (
                <div className="space-y-3">
                  <div className="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-bold flex items-center justify-center space-x-2">
                    <CheckCircle2 size={16} /><span>Décharge signée</span>
                  </div>
                  <a 
                    href={`/api/appointments/${appointment.id}/download-consent`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white border border-purple-500/20 rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2"
                  >
                    <Download size={16} /><span>Télécharger le PDF</span>
                  </a>
                </div>
              ) : (
                <button 
                  onClick={() => setShowConsentModal(true)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2"
                >
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

            {/* --- 🎯 ZONE FACTURATION AUTOMATIQUE ABBY --- */}
            {isBillableStyle && parseFloat(formData.total.toString()) > 0 && (
              <div className="glass-card p-6 border-t-4 border-emerald-500/50 relative">
                {isLoadingDocs && <div className="absolute inset-0 bg-dark-bg/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl"><RefreshCw className="animate-spin text-emerald-500" size={24} /></div>}
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center space-x-2 mb-4"><FileText size={12} /><span>Facturation (Abby)</span></label>
                
                {hasApiKey === false ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs">Veuillez connecter votre clé API Abby dans les paramètres.</div>
                ) : (
                  <div className="space-y-3">
                    
                    {formData.deposit !== 'Dispensé' && parseFloat(formData.depositAmount.toString()) > 0 && (
                      docState.depositInvoice === 'none' ? (
                        <button onClick={() => handleCreateAbbyDocument("Facture d'acompte")} disabled={isCreating === "Facture d'acompte"} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all flex items-center justify-between px-4 disabled:opacity-50">
                          <div className="flex items-center space-x-3"><Receipt size={16} className="text-lilas" /><span>Créer Facture d'acompte</span></div>{isCreating === "Facture d'acompte" ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} className="text-gray-400" />}
                        </button>
                      ) : docState.depositInvoice === 'created' ? (
                        <button onClick={() => handlePayDocument("Facture d'acompte")} disabled={isCreating === "pay_Facture d'acompte"} className="w-full py-3 bg-amber-500 text-black rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 disabled:opacity-50">
                          {isCreating === "pay_Facture d'acompte" ? <RefreshCw size={16} className="animate-spin" /> : <CreditCard size={16} />}<span>Encaisser acompte</span>
                        </button>
                      ) : (
                        <div className="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-bold flex items-center justify-center space-x-2"><CheckCircle2 size={16} /><span>Acompte payé</span></div>
                      )
                    )}

                    {docState.finalInvoice === 'none' ? (
                      <button onClick={() => handleCreateAbbyDocument('Facture finale')} disabled={isCreating === 'Facture finale'} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all flex items-center justify-between px-4 disabled:opacity-50">
                        <div className="flex items-center space-x-3"><Receipt size={16} className="text-lilas" /><span>Créer Facture finale</span></div>{isCreating === 'Facture finale' ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} className="text-gray-400" />}
                      </button>
                    ) : docState.finalInvoice === 'created' ? (
                      <button onClick={() => handlePayDocument('Facture finale')} disabled={isCreating === "pay_Facture finale"} className="w-full py-3 bg-amber-500 text-black rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 disabled:opacity-50">
                        {isCreating === "pay_Facture finale" ? <RefreshCw size={16} className="animate-spin" /> : <CreditCard size={16} />}<span>Encaisser facture finale</span>
                      </button>
                    ) : (
                      <div className="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-bold flex items-center justify-center space-x-2"><CheckCircle2 size={16} /><span>Facture payée</span></div>
                    )}
                    
                  </div>
                )}
              </div>
            )}

            {/* --- 🎯 ZONE LIAISON MANUELLE --- */}
            <div className="glass-card p-6 border-t-4 border-emerald-500/50">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center space-x-2 mb-4">
                <Link size={12} /><span>Liaisons Abby (Manuelles)</span>
              </label>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">ID Bon de commande (Devis)</label>
                  <input type="text" value={abbyIds.bdc} onChange={(e) => setAbbyIds({...abbyIds, bdc: e.target.value})} placeholder="ex: 123e4..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">ID Facture d'acompte</label>
                  <input type="text" value={abbyIds.deposit} onChange={(e) => setAbbyIds({...abbyIds, deposit: e.target.value})} placeholder="ex: 987f..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">ID Facture finale</label>
                  <input type="text" value={abbyIds.final} onChange={(e) => setAbbyIds({...abbyIds, final: e.target.value})} placeholder="ex: 456a..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono" />
                </div>
                <button onClick={handleSaveAbbyIds} disabled={savingAbbyIds} className="w-full mt-2 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-bold flex items-center justify-center space-x-2">
                  {savingAbbyIds ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>Sauvegarder les ID Abby</span>
                </button>
              </div>
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

      {/* --- MODAL DE CONSENTEMENT --- */}
      <AnimatePresence>
        {showConsentModal && (
          <ConsentModal 
            appointment={appointment} 
            onClose={() => setShowConsentModal(false)} 
            onSaved={() => {
              setShowConsentModal(false);
              setHasConsent(true);
            }} 
            apiFetch={apiFetch} 
          />
        )}
      </AnimatePresence>
    </>
  );
};