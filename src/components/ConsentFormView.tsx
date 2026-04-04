import React, { useState, useEffect, useRef } from 'react';
import { X, Eraser, Check, RefreshCw, FileSignature, AlertCircle } from 'lucide-react';

export const ConsentFormView = ({ appointment, onClose, onSaved, apiFetch }: any) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🎯 On gère maintenant les 4 champs de manière modifiable
  const [form, setForm] = useState({
    name: appointment.client || '',
    email: appointment.clientEmail || '',
    phone: appointment.phone || '',
    instagram: appointment.instagram || ''
  });

  const [isLuEtApprouve, setIsLuEtApprouve] = useState(false);
  const [medicalAnswers, setMedicalAnswers] = useState({
    enceinte: false,
    anticoagulants: false,
    maladiePeau: false,
    allergies: false,
    virus: false,
    alcoolDrogue: false,
  });

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

    // Séparation du prénom et nom depuis le champ modifiable
    const nameParts = form.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    try {
      const { jsPDF } = jsPDFObj;
      const doc = new jsPDF();
      let y = 20;
      
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("DÉCHARGE & CONSENTEMENT", 105, y, { align: "center" });
      y += 15;
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Nom: ${lastName}`, 20, y);
      doc.text(`Prénom: ${firstName}`, 105, y);
      y += 8;
      doc.text(`Email: ${form.email || '_________________'}`, 20, y);
      doc.text(`Tél: ${form.phone || '_________________'}`, 105, y);
      y += 8;
      doc.text(`Instagram: ${form.instagram || '_________________'}`, 20, y);
      doc.text(`Date du jour: ${new Date().toLocaleDateString('fr-FR')}`, 105, y);
      y += 15;

      doc.setFont("helvetica", "bold");
      doc.text("1. Questionnaire Médical", 20, y);
      doc.setFont("helvetica", "normal");
      y += 8;
      doc.text(`Enceinte ou en cours d'allaitement : ${medicalAnswers.enceinte ? 'OUI' : 'NON'}`, 25, y); y += 6;
      doc.text(`Médicaments fluidifiants (anticoagulants) : ${medicalAnswers.anticoagulants ? 'OUI' : 'NON'}`, 25, y); y += 6;
      doc.text(`Maladies de peau sur la zone à tatouer : ${medicalAnswers.maladiePeau ? 'OUI' : 'NON'}`, 25, y); y += 6;
      doc.text(`Sujet(te) aux allergies graves : ${medicalAnswers.allergies ? 'OUI' : 'NON'}`, 25, y); y += 6;
      doc.text(`Porteur/porteuse d'un virus transmissible : ${medicalAnswers.virus ? 'OUI' : 'NON'}`, 25, y); y += 6;
      doc.text(`Consommation d'alcool/drogues (<24h) : ${medicalAnswers.alcoolDrogue ? 'OUI' : 'NON'}`, 25, y); y += 12;

      doc.setFont("helvetica", "bold");
      doc.text("2. Engagements", 20, y);
      doc.setFont("helvetica", "normal");
      y += 8;
      doc.text("- Je confirme être majeur(e) (ou présenter une autorisation parentale).", 25, y); y += 6;
      doc.text("- Je suis conscient(e) du caractère permanent du tatouage.", 25, y); y += 6;
      doc.text("- Je m'engage à respecter les consignes de soins post-tatouage.", 25, y); y += 15;

      doc.setFont("helvetica", "bold");
      doc.text("Je certifie l'exactitude des informations et coche la mention 'Lu et approuvé'.", 20, y);
      y += 15;
      doc.text("Signature du client", 120, y);
      
      const sigData = canvas.toDataURL("image/png");
      doc.addImage(sigData, 'PNG', 120, y + 5, 60, 30);
      const pdfBase64 = doc.output('datauristring');

      // 🎯 Sauvegarde si le client a modifié ses infos (Nom, email, tel, insta)
      const hasChanges = form.name !== appointment.client || form.email !== appointment.clientEmail || form.phone !== appointment.phone || form.instagram !== appointment.instagram;
      
      if (hasChanges) {
         try {
           await apiFetch(`/api/appointments/${appointment.id}`, {
             method: 'PATCH',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
               client_name: form.name,
               client_email: form.email,
               client_phone: form.phone, 
               instagram: form.instagram 
             })
           });
         } catch (e) {}
      }

      const res = await apiFetch(`/api/appointments/${appointment.id}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfData: pdfBase64, clientName: form.name, appointmentDate: appointment.appointment_date })
      });

      if (!res.ok) throw new Error("Erreur lors de l'enregistrement.");
      onSaved();
    } catch (err: any) { setError(err.message || "Une erreur est survenue."); } finally { setIsGenerating(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-dark-bg/95 backdrop-blur-md overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-3xl mx-auto my-0 md:my-8 bg-[#0A0A0B] border border-white/10 md:rounded-3xl shadow-2xl min-h-screen md:min-h-0 flex flex-col text-gray-300">
        <div className="flex justify-between items-center p-6 border-b border-white/5 sticky top-0 z-50 bg-[#0A0A0B]/90 backdrop-blur-sm md:rounded-t-3xl">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2"><FileSignature className="text-lilas" /><span>Décharge & Consentement</span></h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 md:p-8 flex-1 space-y-8">
          
          <p className="mb-4 text-zinc-400">
            Bonjour <strong className="text-white">{form.name}</strong>, avant de procéder au tatouage, merci de vérifier vos informations et de remplir ce formulaire.
          </p>

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-lilas">Informations de contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase block mb-1 ml-1">Nom / Prénom</label>
                <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase block mb-1 ml-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase block mb-1 ml-1">Téléphone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase block mb-1 ml-1">Instagram</label>
                <input type="text" value={form.instagram} onChange={(e) => setForm({...form, instagram: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all text-white" />
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4 border-b border-zinc-800 pb-2 mt-8">1. Questionnaire Médical</h2>
            <p className="text-sm text-amber-400/80 mb-4">Cochez la case si la réponse est OUI :</p>
            
            <div className="space-y-3">
              {[
                { id: 'enceinte', label: "Êtes-vous enceinte ou en cours d'allaitement ?" },
                { id: 'anticoagulants', label: "Prenez-vous des médicaments fluidifiants sanguins (anticoagulants) ?" },
                { id: 'maladiePeau', label: "Avez-vous des maladies de peau sur la zone à tatouer ?" },
                { id: 'allergies', label: "Êtes-vous sujet(te) aux allergies graves ?" },
                { id: 'virus', label: "Êtes-vous porteur/porteuse d'un virus transmissible par le sang ?" },
                { id: 'alcoolDrogue', label: "Avez-vous consommé de l'alcool ou des drogues dans les dernières 24h ?" },
              ].map((q) => (
                <label key={q.id} className="flex items-start space-x-4 p-3 md:p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="mt-1 w-6 h-6 shrink-0 accent-lilas rounded bg-zinc-900 border-zinc-700"
                    checked={(medicalAnswers as any)[q.id]}
                    onChange={(e) => setMedicalAnswers({...medicalAnswers, [q.id]: e.target.checked})}
                  />
                  <span className="text-zinc-300 text-sm md:text-base leading-snug">{q.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4 border-b border-zinc-800 pb-2">2. Engagements</h2>
            <ul className="list-disc pl-5 space-y-3 text-zinc-300 text-sm md:text-base">
              <li>Je confirme être majeur(e) (ou présenter une autorisation parentale).</li>
              <li>Je suis conscient(e) du caractère permanent du tatouage.</li>
              <li>Je m'engage à respecter les consignes de soins post-tatouage.</li>
            </ul>
          </div>

          <div className="bg-white/5 p-4 md:p-6 rounded-xl border border-white/10 mb-8">
            <label className="flex items-start space-x-3 cursor-pointer mb-6">
              <input 
                type="checkbox" 
                className="mt-1 w-6 h-6 shrink-0 accent-lilas rounded bg-zinc-900 border-zinc-600"
                checked={isLuEtApprouve}
                onChange={(e) => setIsLuEtApprouve(e.target.checked)}
              />
              <span className="text-base md:text-lg font-bold text-white leading-tight">
                Je certifie l'exactitude des informations et coche la mention "Lu et approuvé"
              </span>
            </label>

            <div className="mb-2 flex justify-between items-end">
              <span className="text-zinc-400 text-sm font-medium">Signature :</span>
            </div>
            
            <div className="border border-white/20 rounded-2xl bg-white/5 relative overflow-hidden" style={{ touchAction: 'none' }}>
              {!isDrawing && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20"><span className="text-2xl font-bold uppercase tracking-widest">Signer ici</span></div>}
              <canvas ref={canvasRef} className="w-full h-64 cursor-crosshair relative z-10" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
              <button onClick={clearCanvas} className="absolute bottom-3 right-3 p-3 bg-white/10 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl text-gray-400 transition-all z-20"><Eraser size={20} /></button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 bg-white/5 border-t border-white/10 md:rounded-b-3xl mt-auto">
          {error && <div className="mb-4 p-3 bg-rose-500/10 text-rose-400 rounded-xl text-sm text-center font-medium border border-rose-500/20"><AlertCircle size={16} /><span>{error}</span></div>}
          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={onClose} disabled={isGenerating} className="flex-1 py-4 text-gray-400 bg-white/5 border border-white/10 font-bold rounded-2xl hover:bg-white/10 transition-colors">Annuler</button>
            
            <button 
              onClick={handleSave} 
              disabled={isGenerating || !isLuEtApprouve} 
              className={`flex-1 py-4 font-bold rounded-2xl transition-all flex justify-center items-center space-x-2 
                ${!isLuEtApprouve ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50' : 'bg-lilas text-black shadow-[0_0_20px_rgba(192,132,252,0.3)] hover:bg-purple-400'}
              `}
            >
              {isGenerating ? <RefreshCw size={20} className="animate-spin" /> : <Check size={20} />}
              <span>{isGenerating ? 'Génération...' : 'Valider la décharge'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};