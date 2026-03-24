import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { ShieldAlert, X, Eraser, Check, SmartphoneNfc } from 'lucide-react';

interface ConsentFormViewProps {
  clientName?: string;
  onClose: () => void;
  onSave: (signatureDataUrl: string, formData: any) => void;
}

export const ConsentFormView: React.FC<ConsentFormViewProps> = ({ clientName = "Client", onClose, onSave }) => {
  const sigCanvas = useRef<any>(null);
  const [isLuEtApprouve, setIsLuEtApprouve] = useState(false);

  const [medicalAnswers, setMedicalAnswers] = useState({
    enceinte: false,
    anticoagulants: false,
    maladiePeau: false,
    allergies: false,
    virus: false,
    alcoolDrogue: false,
  });

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const handleSave = () => {
    if (sigCanvas.current?.isEmpty()) {
      alert("Veuillez signer dans l'encadré avant de valider.");
      return;
    }
    if (!isLuEtApprouve) {
      alert("Veuillez cocher la case 'Lu et approuvé'.");
      return;
    }
    
    const signatureData = sigCanvas.current.getCanvas().toDataURL('image/png');
    onSave(signatureData, medicalAnswers);
  };

  return (
    <>
      {/* ÉCRAN DE BLOCAGE PAYSAGE (Uniquement pour écrans tactiles)
        L'astuce est ici : [@media(pointer:coarse)_and_(orientation:landscape)]
        Ça cible les écrans tactiles (pointer:coarse) qui sont à l'horizontale.
      */}
      <div className="fixed inset-0 z-[10000] bg-zinc-950 flex-col items-center justify-center text-center p-8 hidden [@media(pointer:coarse)_and_(orientation:landscape)]:flex">
        <SmartphoneNfc size={64} className="text-lilas mb-6 animate-pulse" />
        <h2 className="text-3xl font-bold text-white mb-4">Veuillez tourner l'appareil</h2>
        <p className="text-zinc-400 text-lg max-w-md">
          Pour des raisons de lisibilité et pour faciliter votre signature, cette fiche doit être remplie en mode portrait (à la verticale).
        </p>
      </div>

      {/* FENÊTRE PRINCIPALE
        Elle se cache UNIQUEMENT sur les écrans tactiles en mode paysage.
      */}
      <div className="fixed inset-0 z-[9999] bg-zinc-950 overflow-y-auto flex flex-col items-center justify-start p-4 md:p-8 [@media(pointer:coarse)_and_(orientation:landscape)]:hidden">
        
        <div className="w-full max-w-2xl bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 p-6 md:p-10 relative shrink-0 my-auto">
          
          <button onClick={onClose} className="absolute top-4 right-4 md:top-6 md:right-6 text-zinc-500 hover:text-white p-2">
            <X size={28} />
          </button>

          <div className="flex items-center space-x-3 mb-8 text-lilas mt-4 md:mt-0">
            <ShieldAlert size={32} />
            <h1 className="text-2xl md:text-3xl font-bold text-white">Décharge & Consentement</h1>
          </div>

          <p className="mb-8 text-zinc-400">
            Bonjour <strong className="text-white">{clientName}</strong>, avant de procéder au tatouage, merci de lire attentivement et de remplir ce formulaire.
          </p>

          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4 border-b border-zinc-800 pb-2">1. Questionnaire Médical</h2>
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
                <label key={q.id} className="flex items-start space-x-4 p-3 md:p-4 rounded-xl bg-zinc-800/50 border border-zinc-800 active:bg-zinc-800 transition cursor-pointer">
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

          <div className="bg-zinc-800/30 p-4 md:p-6 rounded-xl border border-zinc-700 mb-8">
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
              <button onClick={clearSignature} className="text-sm flex items-center space-x-1 text-zinc-400 hover:text-red-400 transition p-1">
                <Eraser size={16} /> <span>Effacer</span>
              </button>
            </div>
            
            <div className="bg-zinc-100 rounded-lg overflow-hidden border-4 border-zinc-600 shadow-inner">
              <SignatureCanvas 
                ref={sigCanvas} 
                penColor="black"
                canvasProps={{
                  className: 'w-full h-48 md:h-64 cursor-crosshair touch-none' 
                }} 
              />
            </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={!isLuEtApprouve}
            className={`w-full py-4 rounded-xl flex justify-center items-center space-x-2 font-bold text-lg transition-all ${
              isLuEtApprouve 
                ? 'bg-lilas text-white hover:bg-lilas/80 shadow-[0_0_20px_rgba(168,85,247,0.3)]' 
                : 'bg-zinc-800 text-zinc-500 opacity-50 cursor-not-allowed'
            }`}
          >
            <Check size={24} />
            <span>Soumettre la fiche de consentement</span>
          </button>

        </div>
      </div>
    </>
  );
};