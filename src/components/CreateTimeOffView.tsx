import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Save, RefreshCw, AlertCircle, Plane, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export const CreateTimeOffView = ({ onBack, onCreated, apiFetch }: any) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  // États pour le calendrier de plage de dates
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Utilitaires de calendrier
  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const weekDays = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
  
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Lundi = 0

    const days = [];
    // Jours vides au début
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    // Jours du mois
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const handleDateClick = (date: Date) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setEndDate(null);
    } else if (date < startDate) {
      setEndDate(startDate);
      setStartDate(date);
    } else {
      setEndDate(date);
    }
  };

  const isSelected = (date: Date) => {
    if (!date || !startDate) return false;
    if (endDate) {
      return date >= startDate && date <= endDate;
    }
    return date.getTime() === startDate.getTime();
  };

  const isRangeHover = (date: Date) => {
    if (!date || !startDate || endDate || !hoverDate) return false;
    if (hoverDate > startDate) return date > startDate && date <= hoverDate;
    if (hoverDate < startDate) return date < startDate && date >= hoverDate;
    return false;
  };

  const formatDateDisplay = () => {
    if (startDate && endDate) {
      return `Du ${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')}`;
    }
    if (startDate) {
      return `Le ${startDate.toLocaleDateString('fr-FR')} (cliquez pour la date de fin)`;
    }
    return "Sélectionnez une période";
  };

  const handleSubmit = async () => {
    if (!startDate || !reason) {
      setError("Veuillez remplir le motif et sélectionner au moins une date.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const finalEndDate = endDate || startDate; // Si on a cliqué qu'une fois, c'est juste un jour
      
      const days = [];
      let current = new Date(startDate);
      while (current <= finalEndDate) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }

      const promises = days.map(date => {
        const safeDate = new Date(date);
        safeDate.setHours(12, 0, 0, 0); // Midi pour éviter les bugs de fuseau horaire

        // 🎯 PAYLOAD PROPRE POSTGRESQL
        const payload = {
          client_name: `CONGÉ: ${reason}`,
          client_email: 'conge@larabstrait.fr',
          appointment_date: safeDate.toISOString(),
          total_price: 0,
          deposit_status: "Non",
          deposit_amount: 0,
          style: "Congé",
          project_status: "Validé"
        };
        
        return apiFetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      });

      const results = await Promise.all(promises);
      const failed = results.find(r => !r.ok);
      if (failed) {
        const data = await failed.json();
        throw new Error(data.error || "Erreur création d'un jour");
      }

      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl transition-all"><ArrowLeft size={24} /></button>
          <h2 className="text-2xl font-bold">Poser un congé</h2>
        </div>
        <button onClick={handleSubmit} disabled={saving || !startDate} className="px-6 py-2 bg-lilas text-black hover:bg-lilas/90 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 disabled:opacity-50 shadow-lg shadow-lilas/20">
          {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
          <span>{saving ? "Enregistrement..." : "Enregistrer"}</span>
        </button>
      </div>

      {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex items-center space-x-3"><AlertCircle size={20} /><span>{error}</span></div>}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* COLONNE GAUCHE : LE CALENDRIER */}
        <div className="glass-card p-8 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-6">
            <button 
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h3 className="font-bold text-lg">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
            <button 
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="w-full grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-gray-500 text-xs font-bold py-2">{day}</div>
            ))}
          </div>

          <div className="w-full grid grid-cols-7 gap-1">
            {getDaysInMonth(currentMonth).map((date, i) => {
              if (!date) return <div key={`empty-${i}`} className="aspect-square" />;
              
              const isStart = startDate?.getTime() === date.getTime();
              const isEnd = endDate?.getTime() === date.getTime();
              const selected = isSelected(date);
              const hovered = isRangeHover(date);
              
              return (
                <div 
                  key={date.toISOString()}
                  onClick={() => handleDateClick(date)}
                  onMouseEnter={() => setHoverDate(date)}
                  onMouseLeave={() => setHoverDate(null)}
                  className={`
                    relative aspect-square flex items-center justify-center text-sm cursor-pointer transition-all
                    ${selected ? 'bg-red-500/20 text-red-400 font-bold' : hovered ? 'bg-red-500/10 text-red-300' : 'hover:bg-white/10 text-gray-300'}
                    ${isStart ? 'rounded-l-xl bg-red-500 text-white shadow-lg shadow-red-500/20' : ''}
                    ${isEnd ? 'rounded-r-xl bg-red-500 text-white shadow-lg shadow-red-500/20' : ''}
                    ${isStart && !endDate && !hoverDate ? 'rounded-xl' : ''}
                    ${!selected && !hovered && date < new Date(new Date().setHours(0,0,0,0)) ? 'opacity-30' : ''}
                  `}
                >
                  <span className="relative z-10">{date.getDate()}</span>
                </div>
              );
            })}
          </div>

          {startDate && (
            <button 
              onClick={() => { setStartDate(null); setEndDate(null); }}
              className="mt-6 text-xs text-gray-500 hover:text-white underline"
            >
              Réinitialiser la sélection
            </button>
          )}
        </div>

        {/* COLONNE DROITE : LE MOTIF ET LE RÉCAP */}
        <div className="space-y-6">
          <div className="glass-card p-8">
            <h3 className="font-bold text-lg flex items-center space-x-2 mb-6 text-red-400">
              <CalendarIcon size={20} />
              <span>Période d'absence</span>
            </h3>
            
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-8">
              <p className="text-center font-medium text-red-300">{formatDateDisplay()}</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Motif de l'absence</label>
              <input 
                type="text" 
                placeholder="Ex: Vacances, Maladie, Repos..." 
                value={reason} 
                onChange={(e) => setReason(e.target.value)} 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-lg font-medium focus:outline-none focus:border-red-500/50 transition-all text-white placeholder:text-white/20"
              />
            </div>
          </div>

          <div className="glass-card p-8 flex flex-col items-center justify-center text-center space-y-4 opacity-40 border-red-500/20 bg-red-500/5">
            <div className="w-20 h-20 rounded-3xl bg-red-500/20 flex items-center justify-center text-red-400"><Plane size={40} /></div>
            <div>
              <h3 className="font-bold text-lg text-red-300">Bloquer l'agenda</h3>
              <p className="text-xs text-red-400/60 mt-1">Aucun rendez-vous ne pourra être pris sur cette période.</p>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
};