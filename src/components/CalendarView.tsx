import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, Clock, Plane, Plus, ChevronRight, MoreVertical } from 'lucide-react';

export const CalendarView = ({ appointments, timeOffEvents = [], onSelectAppointment, onCreateAppointment, onCreateTimeOff }: any) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // ✅ Palette de couleurs plus contrastée
  const legend = [
    { label: 'Projet perso', color: 'bg-indigo-500' },
    { label: 'Flash', color: 'bg-cyan-500' },
    { label: 'Retouches', color: 'bg-emerald-500' },
    { label: 'RDV Préparatoire', color: 'bg-amber-500' },
    { label: 'Event', color: 'bg-rose-500' },
    { label: 'Cadeau', color: 'bg-pink-400' },
    { label: 'Congé', color: 'bg-red-600' },
  ];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getTypeColor = (type: string, client?: string) => {
    const t = (type || '').toLowerCase();
    const c = (client || '').toLowerCase();
    if (t.includes('timeoff') || t.includes('congé') || t.includes('indisponibilité') || c.includes('congé')) return { bg: 'bg-red-600', text: 'text-red-400', border: 'border-red-600/50' };
    if (t.includes('projet perso')) return { bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500/50' };
    if (t.includes('flash')) return { bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500/50' };
    if (t.includes('retouche')) return { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/50' };
    if (t.includes('préparatoire')) return { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/50' };
    if (t.includes('event')) return { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500/50' };
    if (t.includes('cadeau')) return { bg: 'bg-pink-400', text: 'text-pink-300', border: 'border-pink-400/50' };
    return { bg: 'bg-lilas', text: 'text-lilas', border: 'border-lilas/50' };
  };

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const currentWeekDays = getWeekDays(currentDate);
  const prevMonthDays = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const next = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(currentDate.getDate() + 7);
      setCurrentDate(nextWeek);
    }
  };

  const prev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(currentDate.getDate() - 7);
      setCurrentDate(prevWeek);
    }
  };

  const monthAppointments = appointments.filter((appt: any) => {
    const d = new Date(appt.rawDate);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const monthTimeOff = timeOffEvents.filter((event: any) => {
    const d = new Date(event.start);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const selectedDayAppointments = appointments.filter((appt: any) => {
    if (appt.isTimeOff) return false;
    const d = new Date(appt.rawDate);
    return d.getDate() === selectedDate.getDate() && 
           d.getMonth() === selectedDate.getMonth() && 
           d.getFullYear() === selectedDate.getFullYear();
  }).sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));

  const selectedDayTimeOff = [
    ...timeOffEvents.filter((event: any) => {
      const d = new Date(event.start);
      return d.getDate() === selectedDate.getDate() && 
             d.getMonth() === selectedDate.getMonth() && 
             d.getFullYear() === selectedDate.getFullYear();
    }),
    ...appointments.filter((appt: any) => {
      if (!appt.isTimeOff) return false;
      const d = new Date(appt.rawDate);
      return d.getDate() === selectedDate.getDate() && 
             d.getMonth() === selectedDate.getMonth() && 
             d.getFullYear() === selectedDate.getFullYear();
    })
  ];

  const formatTimeOffTime = (off: any) => {
    if (off.time && off.time !== '00:00') return off.time; // Heure valide trouvée

    const start = new Date(off.start);
    const end = new Date(off.end);
    
    const isValidStart = !isNaN(start.getTime());
    const isValidEnd = !isNaN(end.getTime());
    
    if (isValidStart && isValidEnd) {
      return `${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return 'Journée entière';
  };

  const handleCreateAppointmentForSelectedDate = () => {
    if (onCreateAppointment) {
      // ✅ On envoie la date sélectionnée (ex: '2026-04-15')
      const dateString = new Date(selectedDate.getTime() - (selectedDate.getTimezoneOffset() * 60000))
        .toISOString()
        .split('T')[0];
      onCreateAppointment(dateString);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-full flex flex-col pb-20 md:pb-0">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">
            {viewMode === 'month' ? `${monthNames[month]} ${year}` : `Semaine du ${currentWeekDays[0].getDate()} ${monthNames[currentWeekDays[0].getMonth()]}`}
          </h2>
          <p className="text-gray-400 text-sm md:text-base">Planning de Larabstrait</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 w-full md:w-auto">
          <div className="hidden xl:flex items-center space-x-4 mr-4 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
            {legend.map((item) => (
              <div key={item.label} className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between sm:justify-start space-x-2 bg-card-bg border border-white/5 p-1 rounded-xl">
            <button onClick={prev} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }} className="px-3 py-2 text-gray-400 hover:text-white rounded-lg font-medium text-xs sm:text-sm">
              Aujourd'hui
            </button>
            <button onClick={next} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="flex items-center justify-center space-x-2 bg-card-bg border border-white/5 p-1 rounded-xl">
            <button onClick={() => setViewMode('month')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${viewMode === 'month' ? 'bg-lilas text-black' : 'text-gray-400 hover:text-white'}`}>
              Mois
            </button>
            <button onClick={() => setViewMode('week')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${viewMode === 'week' ? 'bg-lilas text-black' : 'text-gray-400 hover:text-white'}`}>
              Semaine
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 glass-card p-3 md:p-6 flex flex-col">
          <div className="w-full">
            <div className="grid grid-cols-7 mb-2 md:mb-4">
              {weekDays.map(day => (
                <div key={day} className="text-center text-gray-500 text-[10px] sm:text-xs md:text-sm font-bold py-2 uppercase tracking-wider">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.charAt(0)}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 md:gap-2 flex-1">
              {viewMode === 'month' ? (
                <>
                  {Array.from({ length: startDayOfWeek }).map((_, i) => {
                    const dayNum = prevMonthDays - startDayOfWeek + i + 1;
                    return (
                      <div key={`empty-${i}`} className="aspect-square p-1 md:p-2 opacity-10 flex flex-col">
                        <span className="text-gray-400 text-[10px] sm:text-sm">{dayNum}</span>
                      </div>
                    );
                  })}
                  
                  {days.map(day => {
                    const dayAppts = monthAppointments.filter((a: any) => !a.isTimeOff && new Date(a.rawDate).getDate() === day);
                    const dayTimeOff = [
                      ...monthTimeOff.filter((a: any) => new Date(a.start).getDate() === day),
                      ...monthAppointments.filter((a: any) => a.isTimeOff && new Date(a.rawDate).getDate() === day)
                    ];
                    const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                    const isSelected = day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
                    
                    return (
                      <div 
                        key={day} 
                        onClick={() => setSelectedDate(new Date(year, month, day))}
                        className={`aspect-square p-1.5 md:p-3 border border-white/5 rounded-lg md:rounded-2xl hover:bg-white/[0.03] transition-all cursor-pointer group relative flex flex-col ${
                          isSelected ? 'bg-lilas/10 border-lilas/40 shadow-[0_0_15px_rgba(209,179,255,0.1)]' : ''
                        } ${isToday ? 'border-lilas/60' : ''}`}
                      >
                        <div className="flex justify-between items-start">
                          <span className={`text-[10px] sm:text-sm font-bold ${isSelected ? 'text-lilas' : isToday ? 'text-lilas' : 'text-gray-500'}`}>
                            {day}
                          </span>
                          {isToday && <div className="w-1 h-1 rounded-full bg-lilas shadow-[0_0_5px_rgba(209,179,255,1)]" />}
                        </div>
                        
                        <div className="mt-auto flex flex-wrap gap-1 justify-center sm:justify-start">
                          {dayAppts.slice(0, 4).map((appt: any, idx: number) => {
                            const colors = getTypeColor(appt.style, appt.client);
                            return (
                              <div key={`appt-${idx}`} className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${colors.bg} shadow-sm`} title={appt.client}></div>
                            );
                          })}
                          {dayTimeOff.slice(0, 2).map((off: any, idx: number) => (
                            <div key={`off-${idx}`} className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-600/60 shadow-sm`} title={off.title || off.client}></div>
                          ))}
                          {(dayAppts.length + dayTimeOff.length) > 4 && (
                            <div className="text-[7px] md:text-[9px] text-gray-500 font-black leading-none self-center">
                              +{(dayAppts.length + dayTimeOff.length) - 4}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                currentWeekDays.map((date, i) => {
                  const day = date.getDate();
                  const m = date.getMonth();
                  const y = date.getFullYear();
                  const isToday = day === new Date().getDate() && m === new Date().getMonth() && y === new Date().getFullYear();
                  
                  const dayAppts = appointments.filter((a: any) => {
                    if (a.isTimeOff) return false;
                    const d = new Date(a.rawDate);
                    return d.getDate() === day && d.getMonth() === m && d.getFullYear() === y;
                  }).sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));

                  const dayTimeOff = [
                    ...timeOffEvents.filter((a: any) => {
                      const d = new Date(a.start);
                      return d.getDate() === day && d.getMonth() === m && d.getFullYear() === y;
                    }),
                    ...appointments.filter((a: any) => {
                      if (!a.isTimeOff) return false;
                      const d = new Date(a.rawDate);
                      return d.getDate() === day && d.getMonth() === m && d.getFullYear() === y;
                    })
                  ];

                  const isSelected = day === selectedDate.getDate() && m === selectedDate.getMonth() && y === selectedDate.getFullYear();

                  return (
                    <div 
                      key={`week-${i}`}
                      onClick={() => setSelectedDate(new Date(y, m, day))}
                      className={`min-h-[400px] p-2 border border-white/5 rounded-2xl hover:bg-white/[0.02] transition-all cursor-pointer flex flex-col space-y-2 ${
                        isSelected ? 'bg-lilas/5 border-lilas/20' : ''
                      } ${isToday ? 'border-lilas/40' : ''}`}
                    >
                      <div className="flex flex-col items-center pb-2 border-b border-white/5">
                        <span className="text-[10px] uppercase text-gray-500 font-bold">{weekDays[i]}</span>
                        <span className={`text-lg font-black ${isToday ? 'text-lilas' : 'text-white'}`}>{day}</span>
                      </div>
                      
                      <div className="flex-1 space-y-1 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
                        {dayTimeOff.map((off: any, idx: number) => (
                          <div key={`off-${idx}`} className="p-1.5 bg-red-600/5 border border-dashed border-red-600/20 rounded-lg text-[9px] text-red-400/70 font-bold opacity-70">
                            {off.title || off.client || 'Congé'}
                          </div>
                        ))}
                        {dayAppts.map((appt: any, idx: number) => {
                          const colors = getTypeColor(appt.style, appt.client);
                          return (
                            <div 
                              key={`appt-${idx}`}
                              onClick={(e) => { e.stopPropagation(); onSelectAppointment(appt); }}
                              className={`p-2 rounded-xl border ${colors.border} ${colors.bg}/10 hover:${colors.bg}/20 transition-all flex flex-col space-y-1`}
                            >
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] font-black text-white leading-tight truncate">{appt.client}</span>
                                <span className="text-[8px] text-gray-400 font-bold">{appt.time}</span>
                              </div>
                              <span className={`text-[8px] font-bold ${colors.text} truncate`}>{appt.style}</span>
                            </div>
                          );
                        })}
                        {dayAppts.length === 0 && dayTimeOff.length === 0 && (
                          <div className="h-full flex items-center justify-center opacity-10">
                            <span className="text-[10px] font-bold uppercase tracking-widest rotate-90 whitespace-nowrap">Libre</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="glass-card p-5 md:p-6 flex flex-col border-lilas/10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-lilas/10 flex items-center justify-center text-lilas">
                <Calendar size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">{monthNames[selectedDate.getMonth()]}</span>
                <span className="leading-tight">{selectedDate.getDate()}</span>
              </div>
            </h3>
            <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {selectedDayAppointments.length + selectedDayTimeOff.length} ÉVÉNEMENTS
            </div>
          </div>
          
          {/* ✅ BOUTONS D'ACTION EN HAUT */}
          <div className="flex gap-2 mb-6 border-b border-white/5 pb-6">
            <button 
              onClick={handleCreateAppointmentForSelectedDate}
              className="flex-1 py-3 bg-lilas text-black hover:bg-lilas/90 rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-lilas/10"
            >
              <Plus size={16} />
              <span>RDV</span>
            </button>

            <button 
              onClick={() => onCreateTimeOff && onCreateTimeOff()}
              className="flex-1 py-3 bg-white/5 text-gray-300 hover:bg-white/10 rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 border border-white/5"
            >
              <Plane size={16} />
              <span>Congé</span>
            </button>
          </div>

          {/* LISTE DES RENDEZ-VOUS */}
          <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[300px]">
            {selectedDayTimeOff.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-[10px] font-bold text-red-400/70 uppercase tracking-widest px-1">Indisponibilités</p>
                {selectedDayTimeOff.map((off: any, idx: number) => (
                  <div key={off.id || `off-${idx}`} className="p-3 bg-red-600/5 border border-dashed border-red-600/20 rounded-xl flex items-center space-x-3 opacity-80 hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-lg bg-red-600/10 flex items-center justify-center text-red-500">
                      <Plane size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-400/90">{off.title || off.client || 'Congé'}</p>
                      <p className="text-[10px] text-red-400/60 font-medium">
                        {formatTimeOffTime(off)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedDayAppointments.length > 0 ? (
              selectedDayAppointments.map((appt: any, i: number) => {
                const colors = getTypeColor(appt.style, appt.client);
                return (
                  <motion.div 
                    key={appt.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => onSelectAppointment(appt)}
                    className={`group relative p-4 rounded-2xl border border-white/5 hover:border-lilas/30 hover:bg-white/[0.02] transition-all cursor-pointer overflow-hidden`}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.bg}`}></div>
                    
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <Clock size={12} className="text-gray-500" />
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${colors.text}`}>
                          {appt.time || '14:00'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] font-bold text-gray-400">
                          {typeof appt.total === 'number' ? `${appt.total}€` : appt.price}
                        </span>
                      </div>
                    </div>

                    <h4 className="font-bold text-base group-hover:text-lilas transition-colors mb-1">{appt.client}</h4>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium truncate max-w-[120px]">{appt.style}</span>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              selectedDayAppointments.length === 0 && selectedDayTimeOff.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12 opacity-20">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                    <Calendar size={32} />
                  </div>
                  <p className="text-sm font-medium italic">Journée libre</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};