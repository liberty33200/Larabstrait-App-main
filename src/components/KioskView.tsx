import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowLeft, CheckCircle2, Image as ImageIcon, Loader2, Calendar as CalendarIcon, Clock } from 'lucide-react';

// 1. ON A BIEN AJOUTÉ apiFetch ICI
export const KioskView = ({ onClose, apiFetch }: { onClose: () => void, apiFetch: any }) => {
  const [step, setStep] = useState<'catalog' | 'datetime' | 'form' | 'success'>('catalog');
  const [selectedFlash, setSelectedFlash] = useState<any>(null);
  const [flashes, setFlashes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [formData, setFormData] = useState({ name: '', email: '', phone: '', insta: '' });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const IDLE_TIME = 60000;
  const EVENT_DATES = ['2026-04-14']; 

  const loadFlashes = async () => {
    try {
      const res = await fetch('/api/flashes');
      const data = await res.json();
      if (Array.isArray(data)) setFlashes(data);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadFlashes(); }, []);

  const fetchSlots = async (date: string) => {
    setSelectedDate(date);
    setLoadingSlots(true);
    try {
      const duration = selectedFlash?.duration || 60;
      const res = await fetch(`/api/availability?date=${date}&duration=${duration}`);
      const slots = await res.json();
      setAvailableSlots(slots);
    } catch (error) { console.error(error); } 
    finally { setLoadingSlots(false); }
  };

  const resetKiosk = () => {
    setStep('catalog');
    setSelectedFlash(null);
    setSelectedDate('');
    setSelectedTime('');
    setFormData({ name: '', email: '', phone: '', insta: '' });
    loadFlashes();
  };

  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(resetKiosk, IDLE_TIME);
  };

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    const handler = () => resetTimer();
    events.forEach(e => document.addEventListener(e, handler));
    resetTimer();
    return () => {
      events.forEach(e => document.removeEventListener(e, handler));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // --- CRÉATION DATAVERSE DEPUIS LE KIOSK ---
      const [year, month, day] = selectedDate.split('-'); 
      const [hour, min] = selectedTime.split(':');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min));

      const rawPrice = selectedFlash.price.toString().replace(/[^0-9.,]/g, '').replace(',', '.');
      const numericPrice = parseFloat(rawPrice) || 0;

      const appointmentData = {
        cr7e0_nomclient: formData.name,
        cr7e0_email: formData.email,
        cr7e0_daterdv: startDate.toISOString(),
        cr7e0_telephone: formData.phone,
        cr7e0_tariftattoo: numericPrice
      };

      // 1. On envoie à Microsoft (déclenche ton mail Power Automate)
      const dvResponse = await apiFetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentData)
      });

      // 2. On récupère la réponse de Dataverse pour avoir l'ID du RDV
      let dataverseId = null;
      if (dvResponse.ok) {
        const dvData = await dvResponse.json();       
        dataverseId = dvData.id || dvData.cr7e0_gestiontatouageid || null;
      }

      // 3. On bloque le flash sur le NAS et on sauvegarde l'ID Dataverse
      await fetch(`/api/flashes/${selectedFlash.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          available: false,
          reservationDetails: { 
            ...formData, 
            date: selectedDate, 
            time: selectedTime, 
            flashTitle: selectedFlash.title,
            dataverseId: dataverseId // 👈 ON SAUVEGARDE L'ID ICI
          }
        })
      });

      setStep('success');
      setTimeout(resetKiosk, 5000);
    } catch (error) { 
      alert("Erreur lors de la réservation"); 
      console.error(error);
    }
  };

  // LE FAMEUX RETURN QUI AVAIT DISPARU EST BIEN LÀ 👇
  return (
    <div className="fixed inset-0 z-[10000] bg-zinc-950 text-white flex flex-col font-sans overflow-hidden">
      {/* HEADER */}
      <div className="pt-8 md:pt-12 pb-6 px-8 text-center relative shrink-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-lilas/10 blur-[100px] rounded-full" />
        <div className="relative z-10 flex flex-col items-center">
          <Sparkles className="text-lilas mb-2" size={32} />
          <h1 className="text-4xl md:text-6xl font-black tracking-tight uppercase mb-2">LARABSTRAIT</h1>
          <p className="text-zinc-400 text-sm md:text-xl font-medium uppercase tracking-widest">
            {step === 'catalog' ? "Catalogue Flash Day" : step === 'datetime' ? "Choisis ton créneau" : "Finalise ta réservation"}
          </p>
        </div>
        <button onDoubleClick={onClose} className="absolute top-6 right-6 text-zinc-800 hover:text-zinc-500 text-xs uppercase tracking-widest transition-colors">Quitter</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-20">
        <AnimatePresence mode="wait">
          {/* 1. CATALOGUE */}
          {step === 'catalog' && (
            <motion.div key="catalog" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-7xl mx-auto">
              {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-lilas" size={48} /></div> : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {flashes.map((flash) => (
                    <motion.div key={flash.id} whileTap={flash.available ? { scale: 0.95 } : {}} onClick={() => { if (flash.available) { setSelectedFlash(flash); setStep('datetime'); } }} className={`relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all ${flash.available ? 'border-zinc-800 bg-zinc-900 cursor-pointer hover:border-lilas' : 'border-zinc-900 bg-black opacity-40'}`}>
                      <img src={`/api/flashes/images/${flash.image_filename}`} className="absolute inset-0 w-full h-full object-contain p-4" alt={flash.title} />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/40 p-4 pt-12">
                        <h3 className="font-bold text-sm md:text-lg leading-tight truncate">{flash.title}</h3>
                        <div className="flex flex-wrap justify-between items-center mt-2 gap-2">
                          <span className="text-lilas font-black text-sm md:text-base">{flash.price} €</span>
                          <div className="flex gap-1.5">
                            <span className="text-zinc-400 text-[9px] md:text-[10px] bg-zinc-800/80 px-2 py-1 rounded flex items-center gap-1">
                              <Clock size={10} /> {flash.duration} min
                            </span>
                            <span className="text-zinc-400 text-[9px] md:text-[10px] bg-zinc-800/80 px-2 py-1 rounded">{flash.size}</span>
                          </div>
                        </div>
                      </div>
                      {!flash.available && <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"><span className="bg-red-500 text-white font-black px-4 py-2 rounded-full uppercase text-[10px] md:text-sm -rotate-12 shadow-2xl">Réservé</span></div>}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* 2. DATE & HEURE */}
          {step === 'datetime' && (
            <motion.div key="datetime" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="max-w-5xl mx-auto w-full">
              <button onClick={() => setStep('catalog')} className="text-zinc-500 hover:text-white mb-8 flex items-center space-x-2 transition-colors"><ArrowLeft size={20}/> <span>Retour au catalogue</span></button>
              <div className="grid md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold flex items-center space-x-3"><CalendarIcon className="text-lilas"/> <span>1. Choisis ton jour</span></h2>
                  {EVENT_DATES.map(date => (
                    <button key={date} onClick={() => fetchSlots(date)} className={`w-full p-6 rounded-2xl border-2 font-bold text-xl transition-all ${selectedDate === date ? 'border-lilas bg-lilas/10 text-lilas' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}>
                      {new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </button>
                  ))}
                </div>
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold flex items-center space-x-3"><Clock className="text-lilas"/> <span>2. Choisis ton heure</span></h2>
                  <div className="grid grid-cols-3 gap-3">
                    {loadingSlots ? <div className="col-span-3 flex justify-center py-10"><Loader2 className="animate-spin text-lilas" /></div> : availableSlots.map(time => (
                      <button key={time} onClick={() => { setSelectedTime(time); setStep('form'); }} className="p-4 rounded-xl bg-zinc-800 hover:bg-lilas hover:text-black font-black transition-all text-center">{time}</button>
                    ))}
                    {!loadingSlots && selectedDate && availableSlots.length === 0 && <p className="col-span-3 text-zinc-500 text-center italic">Plus de créneaux dispo pour ce jour.</p>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 3. FORMULAIRE */}
          {step === 'form' && (
            <motion.div key="form" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="max-w-4xl mx-auto bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-8 shadow-2xl">
              <div className="md:w-1/3 flex flex-col border-b md:border-b-0 md:border-r border-zinc-800 pb-6 md:pb-0 md:pr-8">
                <button onClick={() => setStep('datetime')} className="text-zinc-500 hover:text-white mb-6 flex items-center space-x-2 transition-colors"><ArrowLeft size={20}/> <span>Changer l'heure</span></button>
                <div className="aspect-[3/4] bg-black rounded-2xl overflow-hidden mb-4 border border-zinc-800 shadow-inner">
                    <img src={`/api/flashes/images/${selectedFlash.image_filename}`} className="w-full h-full object-contain p-4" alt={selectedFlash.title} />
                </div>
                <h2 className="text-2xl font-black">{selectedFlash.title}</h2>
                <div className="flex flex-wrap gap-2 mt-3">
                    <span className="text-lilas font-bold bg-lilas/10 px-2 py-1 rounded text-sm">{selectedFlash.price} €</span>
                    <span className="text-zinc-400 bg-zinc-800 px-2 py-1 rounded text-sm flex items-center gap-1"><Clock size={12}/> {selectedFlash.duration} min</span>
                </div>
                <div className="mt-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <p className="text-zinc-500 text-xs uppercase font-bold tracking-widest mb-1">Ton rendez-vous</p>
                  <p className="text-white font-bold">{new Date(selectedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
                  <p className="text-lilas text-3xl font-black mt-1">{selectedTime}</p>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="md:w-2/3 space-y-4 flex flex-col justify-center">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nom & Prénom</label>
                    <input required placeholder="Ex: Jean Dupont" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white text-lg focus:border-lilas outline-none transition-all" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Email</label>
                    <input required type="email" placeholder="nom@mail.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white focus:border-lilas outline-none transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Téléphone</label>
                    <input type="tel" placeholder="06..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white focus:border-lilas outline-none transition-all" />
                  </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Instagram (@)</label>
                    <input placeholder="@toncompte" value={formData.insta} onChange={e => setFormData({...formData, insta: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white focus:border-lilas outline-none transition-all" />
                </div>
                <button type="submit" className="w-full bg-lilas text-black font-black text-xl py-6 rounded-2xl mt-4 shadow-[0_0_20px_rgba(168,85,247,0.3)] active:scale-95 transition-all uppercase tracking-widest">CONFIRMER LA RÉSERVATION</button>
              </form>
            </motion.div>
          )}

          {/* 4. SUCCÈS */}
          {step === 'success' && (
            <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
              <div className="relative mb-8">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
                <CheckCircle2 size={120} className="text-emerald-400 relative z-10" />
              </div>
              <h2 className="text-5xl font-black mb-4 uppercase tracking-tighter italic">C'EST TOUT BON !</h2>
              <p className="text-xl text-zinc-400">On se voit à <span className="text-white font-bold">{selectedTime}</span> pour ton tattoo. ✨</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};