import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, Send, CheckCircle, AlertCircle, X, Upload } from 'lucide-react';

const API_URL = "http://localhost:3000/api/requests"; 

export const BookingForm = () => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    instagram: '',
    projectType: '', 
    flashNumber: '', 
    projectDescription: '', 
    placement: '',
    estimatedSize: '',
    budget: '', 
    availabilityPrefs: '',
    firstTattoo: '',
    apprehensions: '',
    healthInfo: '',
    preferences: [] as string[],
    otherInfo: ''
  });

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // La fameuse fonction qui est maintenant bien branchée !
  const handleCheckboxChange = (pref: string) => {
    setFormData(prev => {
      const isChecked = prev.preferences.includes(pref);
      if (isChecked) {
        return { ...prev, preferences: prev.preferences.filter(p => p !== pref) };
      } else {
        return { ...prev, preferences: [...prev.preferences, pref] };
      }
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      if (images.length + selectedFiles.length > 3) {
        setError("Maximum 3 images d'inspiration.");
        return;
      }
      setImages([...images, ...selectedFiles]);
      const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
      setImagePreviews([...imagePreviews, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
    const newPreviews = [...imagePreviews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setImagePreviews(newPreviews);
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.clientName || !formData.clientEmail || !formData.projectType) {
        setError("N'oublie pas les champs obligatoires (*) et le type de projet.");
        return;
      }
    }
    if (step === 2) {
      if (formData.projectType === 'Flash' && !formData.flashNumber) {
        setError("Indique-moi le numéro du flash.");
        return;
      }
      if (formData.projectType === 'Projet perso' && !formData.projectDescription) {
        setError("Décris-moi un peu ton projet.");
        return;
      }
    }
    if (step === 3) {
      if (!formData.firstTattoo) {
        setError("Dis-moi si c'est ton premier tatouage ou non.");
        return;
      }
    }
    setError(null);
    setStep(prev => Math.min(prev + 1, 4));
  };
  
  const prevStep = () => {
    setError(null);
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const submitData = new FormData();
      submitData.append('clientName', formData.clientName);
      submitData.append('clientEmail', formData.clientEmail);
      submitData.append('clientPhone', formData.clientPhone);
      submitData.append('instagram', formData.instagram);
      
      let formattedDescription = `✨ TYPE : ${formData.projectType.toUpperCase()} ✨\n`;
      formattedDescription += `--------------------------------\n`;
      if (formData.projectType === 'Flash') {
        formattedDescription += `🆔 NUMÉRO FLASH : ${formData.flashNumber}\n`;
      } else {
        formattedDescription += `💰 BUDGET PRÉVU : ${formData.budget || 'Non précisé'}\n`;
        formattedDescription += `📝 DESCRIPTION : ${formData.projectDescription}\n`;
      }
      formattedDescription += `📍 EMPLACEMENT : ${formData.placement || 'Non précisé'}\n`;
      formattedDescription += `📏 TAILLE : ${formData.estimatedSize || 'Non précisé'}\n`;
      formattedDescription += `📅 DISPOS : ${formData.availabilityPrefs || 'Non précisé'}\n`;
      
      formattedDescription += `\n🌿 SANTÉ & CONFORT 🌿\n`;
      formattedDescription += `--------------------------------\n`;
      formattedDescription += `Premier tatouage : ${formData.firstTattoo}\n`;
      formattedDescription += `Appréhensions : ${formData.apprehensions || 'Aucune'}\n`;
      formattedDescription += `Infos santé : ${formData.healthInfo || 'Rien à signaler'}\n`;
      formattedDescription += `Préférences : ${formData.preferences.length > 0 ? formData.preferences.join(', ') : 'Aucune'}\n`;
      if (formData.otherInfo) {
        formattedDescription += `Autre info : ${formData.otherInfo}\n`;
      }

      submitData.append('projectDescription', formattedDescription);
      submitData.append('placement', formData.placement);
      submitData.append('estimatedSize', formData.estimatedSize);
      submitData.append('availabilityPrefs', formData.availabilityPrefs);
      
      images.forEach((image) => {
        submitData.append('images', image);
      });

      const response = await fetch(API_URL, { method: 'POST', body: submitData });
      const data = await response.json();

      if (response.ok && data.success) {
        setIsSuccess(true);
      } else {
        throw new Error(data.error || "Une erreur est survenue.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full glass-card p-10 text-center space-y-6 rounded-3xl">
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-3xl font-bold">Demande envoyée !</h2>
          <p className="text-gray-400">J'ai bien reçu ton projet. Prends soin de toi, je reviens vers toi par mail très vite ✨</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center pt-12 pb-20 px-4 sm:px-6">
      
      <div className="w-full max-w-2xl mb-8">
        <h1 className="text-3xl font-black text-center mb-6 tracking-tight">Larabstrait</h1>
        <div className="flex justify-between items-center relative px-8">
          <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-white/10 rounded-full z-0"></div>
          <div className="absolute left-8 top-1/2 -translate-y-1/2 h-1 bg-lilas rounded-full z-0 transition-all duration-500" style={{ width: `calc(${((step - 1) / 3) * 100}% - 2rem)` }}></div>
          {[1, 2, 3, 4].map(num => (
            <div key={num} className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${step >= num ? 'bg-lilas text-black shadow-[0_0_15px_rgba(196,181,253,0.3)]' : 'bg-[#1a1a1a] text-gray-500 border border-white/10'}`}>
              {num}
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-2xl glass-card rounded-3xl overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 sm:p-10">
          
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex items-start space-x-3 text-sm">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            
            {/* ETAPE 1 : CONTACT */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="p-5 bg-white/5 border border-white/10 rounded-2xl text-gray-300 text-xs leading-relaxed space-y-3 shadow-inner">
                  <p className="font-bold text-white text-sm">Merci de prendre le temps de remplir ce formulaire 🙏</p>
                  <p>Que tu viennes pour un flash ou un projet sur mesure, ce formulaire me permet de cerner ton idée, tes attentes, ton budget, mais aussi de prendre soin de ton confort pendant toute l'expérience.</p>
                  <p>Toutes les informations resteront confidentielles. Prends ton temps pour répondre, et n’hésite pas à m’écrire s’il te manque quelque chose ✨</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Prénom & Nom *</label>
                    <input type="text" name="clientName" value={formData.clientName} onChange={handleInputChange} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-lilas transition-all outline-none" placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Email *</label>
                    <input type="email" name="clientEmail" value={formData.clientEmail} onChange={handleInputChange} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-lilas transition-all outline-none" placeholder="jane@email.com" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Téléphone</label>
                    <input type="tel" name="clientPhone" value={formData.clientPhone} onChange={handleInputChange} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-lilas transition-all outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Instagram (@)</label>
                    <input type="text" name="instagram" value={formData.instagram} onChange={handleInputChange} placeholder="@pseudo" className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-lilas transition-all outline-none" />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Type de demande *</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button type="button" onClick={() => setFormData({...formData, projectType: 'Flash'})} className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center space-y-2 ${formData.projectType === 'Flash' ? 'bg-lilas/10 border-lilas text-lilas' : 'bg-black/20 border-white/10 text-gray-500 hover:border-white/20'}`}>
                      <span className="font-bold text-lg">Un Flash</span>
                    </button>
                    <button type="button" onClick={() => setFormData({...formData, projectType: 'Projet perso'})} className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center space-y-2 ${formData.projectType === 'Projet perso' ? 'bg-lilas/10 border-lilas text-lilas' : 'bg-black/20 border-white/10 text-gray-500 hover:border-white/20'}`}>
                      <span className="font-bold text-lg">Projet Perso</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ETAPE 2 : DETAILS (CONDITIONNEL) */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                
                {formData.projectType === 'Flash' ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Numéro ou nom du flash *</label>
                       <input type="text" name="flashNumber" value={formData.flashNumber} onChange={handleInputChange} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-lilas transition-all outline-none" placeholder="Ex: F-01" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Description & Inspirations *</label>
                      <textarea name="projectDescription" value={formData.projectDescription} onChange={handleInputChange} rows={3} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-lilas transition-all outline-none resize-none" placeholder="Décris ton idée..." />
                    </div>
                    
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Images d'inspiration (Max 3)</label>
                      <div className="flex flex-wrap gap-4">
                        {imagePreviews.map((preview, index) => (
                          <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10">
                            <img src={preview} className="w-full h-full object-cover" alt="Preview" />
                            <button type="button" onClick={() => removeImage(index)} className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white hover:bg-rose-500 transition-colors"><X size={12} /></button>
                          </div>
                        ))}
                        {images.length < 3 && (
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-gray-500 hover:border-lilas hover:text-lilas transition-all">
                            <Upload size={20} />
                            <span className="text-[8px] mt-1 uppercase font-bold">Ajouter</span>
                          </button>
                        )}
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" multiple />
                      </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Budget prévu</label>
                       <input type="text" name="budget" value={formData.budget} onChange={handleInputChange} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-lilas transition-all outline-none" placeholder="Ex: 200-300€" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Emplacement souhaité</label>
                    <input type="text" name="placement" value={formData.placement} onChange={handleInputChange} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-lilas transition-all outline-none" placeholder="Ex: Bras" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Taille estimée</label>
                    <input type="text" name="estimatedSize" value={formData.estimatedSize} onChange={handleInputChange} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-lilas transition-all outline-none" placeholder="Ex: 10cm" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Tes disponibilités</label>
                  <textarea name="availabilityPrefs" value={formData.availabilityPrefs} onChange={handleInputChange} rows={2} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-lilas transition-all outline-none resize-none" placeholder="Jours, créneaux..." />
                </div>
              </motion.div>
            )}

            {/* ETAPE 3 : SANTÉ ET CONFORT */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Est-ce ton premier tatouage ? *</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button type="button" onClick={() => setFormData({...formData, firstTattoo: 'Oui'})} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${formData.firstTattoo === 'Oui' ? 'bg-lilas/10 border-lilas text-lilas' : 'bg-black/20 border-white/10 text-gray-500 hover:border-white/20'}`}>
                      <span className="font-bold">Oui</span>
                    </button>
                    <button type="button" onClick={() => setFormData({...formData, firstTattoo: 'Non'})} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${formData.firstTattoo === 'Non' ? 'bg-lilas/10 border-lilas text-lilas' : 'bg-black/20 border-white/10 text-gray-500 hover:border-white/20'}`}>
                      <span className="font-bold">Non</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Des appréhensions ou craintes ?</label>
                  <textarea name="apprehensions" value={formData.apprehensions} onChange={handleInputChange} rows={2} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-lilas transition-all outline-none resize-none" placeholder="Peur de la douleur, du déroulement..." />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Problème de santé ou allergies ?</label>
                  <textarea name="healthInfo" value={formData.healthInfo} onChange={handleInputChange} rows={2} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-lilas transition-all outline-none resize-none" placeholder="Ex: Diabète, eczéma, traitement en cours..." />
                </div>

                <div className="space-y-3 pt-4 border-t border-white/5">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black mb-2 block">Préférences & Besoins (Optionnel)</label>
                  {[
                    "Faire des pauses régulières",
                    "Venir accompagné(e) (une personne max dans l'attente)",
                    "Parler pendant que je te tattoo",
                    "Ne pas parler pendant (tu as le droit au silence !)"
                  ].map((pref, i) => (
                    <label key={i} className="flex items-center space-x-3 cursor-pointer group">
                      {/* ✅ LA CORRECTION EST ICI : Le input caché qui écoute le clic */}
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={formData.preferences.includes(pref)}
                        onChange={() => handleCheckboxChange(pref)} 
                      />
                      <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${formData.preferences.includes(pref) ? 'bg-lilas border-lilas' : 'border-white/20 group-hover:border-white/40'}`}>
                         {formData.preferences.includes(pref) && <CheckCircle size={14} className="text-black" />}
                      </div>
                      <span className="text-sm text-gray-300">{pref}</span>
                    </label>
                  ))}
                </div>

                <div className="space-y-2 pt-4 border-t border-white/5">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black">Autre chose que je dois savoir ?</label>
                  <textarea name="otherInfo" value={formData.otherInfo} onChange={handleInputChange} rows={2} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-lilas transition-all outline-none resize-none" placeholder="Toute info utile pour ta séance..." />
                </div>

              </motion.div>
            )}

            {/* ETAPE 4 : RECAPITULATIF */}
            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Prêt(e) à envoyer ?</h2>
                  <p className="text-gray-400 text-sm">Vérifie que tout est bon avant de valider.</p>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-2xl p-6 space-y-6 text-sm">
                  
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-lilas font-bold">Toi</p>
                    <p className="text-white font-bold">{formData.clientName} <span className="text-gray-500 font-normal">({formData.clientEmail})</span></p>
                    {formData.instagram && <p className="text-gray-400">Insta: {formData.instagram}</p>}
                  </div>

                  <div className="space-y-1 pt-4 border-t border-white/10">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-lilas font-bold">Le Projet ({formData.projectType})</p>
                    {formData.projectType === 'Flash' && <p className="text-gray-300"><span className="text-gray-500">Flash :</span> {formData.flashNumber}</p>}
                    {formData.projectType === 'Projet perso' && <p className="text-gray-300"><span className="text-gray-500">Idée :</span> {formData.projectDescription}</p>}
                    {formData.placement && <p className="text-gray-300"><span className="text-gray-500">Placement :</span> {formData.placement}</p>}
                    {formData.estimatedSize && <p className="text-gray-300"><span className="text-gray-500">Taille :</span> {formData.estimatedSize}</p>}
                  </div>

                  <div className="space-y-1 pt-4 border-t border-white/10">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-lilas font-bold">Santé & Confort</p>
                    <p className="text-gray-300"><span className="text-gray-500">1er Tattoo :</span> {formData.firstTattoo}</p>
                    {formData.healthInfo && <p className="text-gray-300"><span className="text-gray-500">Santé :</span> {formData.healthInfo}</p>}
                    {formData.preferences.length > 0 && (
                       <p className="text-gray-300"><span className="text-gray-500">Préférences :</span> {formData.preferences.join(', ')}</p>
                    )}
                  </div>

                </div>
              </motion.div>
            )}

          </AnimatePresence>

          <div className="flex justify-between items-center mt-12 pt-6 border-t border-white/5">
  {/* Bouton Retour : visible uniquement après l'étape 1 */}
  {step > 1 ? (
    <button 
      type="button" 
      onClick={prevStep} 
      className="px-5 py-3 text-gray-400 hover:text-white transition-all flex items-center space-x-2"
    >
      <ChevronLeft size={18} />
      <span>Retour</span>
    </button>
  ) : <div />}

  {/* Bouton Action (Suivant OU Envoyer) */}
  {step < 4 ? (
    <button 
      type="button" // ⚠️ Doit être type "button" pour ne pas déclencher le formulaire
      onClick={(e) => {
        e.preventDefault();
        nextStep();
      }} 
      className="px-8 py-3 bg-white text-black hover:bg-gray-200 rounded-xl font-black transition-all flex items-center space-x-2 shadow-lg"
    >
      <span>Suivant</span>
      <ChevronRight size={18} />
    </button>
  ) : (
    <button 
      type="submit" // ⚠️ Uniquement type "submit" à la dernière étape
      disabled={isSubmitting}
      className="px-8 py-3 bg-lilas text-black hover:bg-lilas/90 rounded-xl font-black transition-all flex items-center space-x-2 shadow-lg shadow-lilas/20 disabled:opacity-50"
    >
      {isSubmitting ? "Envoi en cours..." : "Envoyer ma demande"}
      {!isSubmitting && <Send size={18} />}
    </button>
  )}
</div>

        </form>
      </div>
    </div>
  );
};