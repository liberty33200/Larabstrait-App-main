import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LabelList 
} from 'recharts';

export const AccountingView = ({ appointments, rules, loading }: any) => {
  const [filterMode, setFilterMode] = useState('this_month'); 
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  
  // Par défaut, le graphique s'ouvre sur le détail de ce mois-ci
  const [chartFilter, setChartFilter] = useState('this_month');
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
  
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime();
  
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
  const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59).getTime();
  
  const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1).getTime();
  const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59).getTime();

  const startOfActivity = new Date('2024-02-01').getTime();

  // --- CALCUL DYNAMIQUE DU GRAPHIQUE ---
  const chartData = useMemo(() => {
    const dataPoints = [];
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // ==========================================
    // 1. VUE "CE MOIS-CI" (Détail jour par jour)
    // ==========================================
    if (chartFilter === 'this_month') {
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      
      const applicableRule = [...(rules || [])]
        .sort((a: any, b: any) => b.startMonth.localeCompare(a.startMonth))
        .find((r: any) => r.startMonth <= monthKey);
      
      // On divise le loyer par le nombre de jours pour être précis
      const dailyRent = applicableRule ? applicableRule.rent / daysInMonth : 0;
      const rate = applicableRule ? applicableRule.rate : 0;

      for (let i = 1; i <= daysInMonth; i++) {
        const dayRevenue = appointments
          .filter((appt: any) => {
            if (!appt.rawDate) return false;
            const d = new Date(appt.rawDate);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth && d.getDate() === i;
          })
          .reduce((sum: number, appt: any) => sum + (appt.total || 0), 0);

        let expenses = 0;
        let netSalary = dayRevenue;
        
        if (applicableRule) {
          expenses = dailyRent + (dayRevenue * rate);
          netSalary = dayRevenue - expenses;
        }

        dataPoints.push({
          label: `${i} ${monthNames[currentMonth]}`,
          revenue: dayRevenue,
          expenses: Math.round(expenses),
          net: Math.round(netSalary)
        });
      }
      return dataPoints;
    }

    // ==========================================
    // 2. VUE "À VENIR" (Mois actifs > 0€)
    // ==========================================
    if (chartFilter === 'upcoming_active') {
      // On regroupe tous les mois futurs qui ont un rendez-vous
      const futureAppts = appointments.filter((a:any) => a.rawDate && a.rawDate >= startOfMonth);
      const uniqueMonths = new Set<string>();
      
      futureAppts.forEach((a:any) => {
        const d = new Date(a.rawDate);
        uniqueMonths.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      });
      
      const sortedMonths = Array.from(uniqueMonths).sort(); 
      
      sortedMonths.forEach((m: string) => {
        const [y, mo] = m.split('-');
        const monthNum = parseInt(mo) - 1;
        const monthName = `${monthNames[monthNum]} ${y.slice(-2)}`;

        const monthRevenue = appointments
          .filter((appt: any) => {
            if (!appt.rawDate) return false;
            const apptDate = new Date(appt.rawDate);
            return `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, '0')}` === m;
          })
          .reduce((sum: number, appt: any) => sum + (appt.total || 0), 0);

        // On ne garde que les mois où le CA n'est pas à 0
        if (monthRevenue > 0) {
          const applicableRule = [...(rules || [])]
            .sort((a: any, b: any) => b.startMonth.localeCompare(a.startMonth))
            .find((r: any) => r.startMonth <= m);
          
          let expenses = 0;
          let netSalary = monthRevenue;

          if (applicableRule) {
            expenses = applicableRule.rent + (monthRevenue * applicableRule.rate);
            netSalary = monthRevenue - expenses;
          }

          dataPoints.push({
            label: monthName,
            revenue: monthRevenue,
            expenses: Math.round(expenses),
            net: Math.round(netSalary)
          });
        }
      });
      return dataPoints;
    }

    // ==========================================
    // 3. VUES CLASSIQUES (6 mois, 12 mois, Année)
    // ==========================================
    let periods: Date[] = [];
    if (chartFilter === '6_months') {
      for (let i = 5; i >= 0; i--) periods.push(new Date(currentYear, currentMonth - i, 1));
    } else if (chartFilter === '12_months') {
      for (let i = 11; i >= 0; i--) periods.push(new Date(currentYear, currentMonth - i, 1));
    } else if (chartFilter === 'this_year') {
      for (let i = 0; i <= currentMonth; i++) periods.push(new Date(currentYear, i, 1));
    }

    periods.forEach(d => {
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      
      const monthRevenue = appointments
        .filter((appt: any) => {
          if (!appt.rawDate) return false;
          const apptDate = new Date(appt.rawDate);
          const apptMonthKey = `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, '0')}`;
          return apptMonthKey === monthKey;
        })
        .reduce((sum: number, appt: any) => sum + (appt.total || 0), 0);

      const applicableRule = [...(rules || [])]
        .sort((a: any, b: any) => b.startMonth.localeCompare(a.startMonth))
        .find((r: any) => r.startMonth <= monthKey);
      
      let expenses = 0;
      let netSalary = monthRevenue;

      if (applicableRule) {
        expenses = applicableRule.rent + (monthRevenue * applicableRule.rate);
        netSalary = monthRevenue - expenses;
      }

      dataPoints.push({
        label: monthName,
        revenue: monthRevenue,
        expenses: Math.round(expenses),
        net: Math.round(netSalary)
      });
    });

    return dataPoints;
  }, [appointments, chartFilter, rules]);
  // --- FIN DU CALCUL GRAPHIQUE ---

  const allEntries = appointments
    .filter((appt: any) => (appt.rawDate || 0) >= startOfActivity)
    .map((appt: any) => ({
      id: appt.id,
      date: appt.date || 'À définir',
      rawDate: appt.rawDate || 0,
      client: appt.client,
      style: appt.style,
      total: appt.total || 0,
      deposit: appt.deposit || 0,
      hasDeposit: appt.hasDeposit,
      remaining: (appt.total || 0) - (appt.deposit || 0),
      status: appt.status,
      method: appt.method || 'N/A'
    })).sort((a: any, b: any) => b.rawDate - a.rawDate);

  const filteredEntries = allEntries.filter((entry: any) => {
    if (filterMode === 'custom_range' && dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start).getTime();
      const end = new Date(dateRange.end).setHours(23, 59, 59, 999);
      return entry.rawDate >= start && entry.rawDate <= end;
    }
    
    switch (filterMode) {
      case 'this_month_past': return entry.rawDate >= startOfMonth && entry.rawDate < today;
      case 'this_month': return entry.rawDate >= startOfMonth && entry.rawDate <= endOfMonth;
      case 'last_month': return entry.rawDate >= startOfLastMonth && entry.rawDate <= endOfLastMonth;
      case 'upcoming': return entry.rawDate >= today;
      case 'last_3_months': return entry.rawDate >= threeMonthsAgo && entry.rawDate <= now.getTime();
      case 'this_year': return entry.rawDate >= startOfYear && entry.rawDate <= endOfYear;
      case 'last_year': return entry.rawDate >= startOfLastYear && entry.rawDate <= endOfLastYear;
      case 'all': return true;
      default: return true;
    }
  });

  const finalEntries = filteredEntries.filter((entry: any) => entry.total > 0);

  const totalRevenue = finalEntries.reduce((acc: number, curr: any) => acc + curr.total, 0);
  const collected = finalEntries.filter((e: any) => e.rawDate < today).reduce((acc: number, curr: any) => acc + curr.total, 0);
  const upcoming = finalEntries.filter((e: any) => e.rawDate >= today).reduce((acc: number, curr: any) => acc + curr.total, 0);

  const calculateSalary = () => {
    const entriesByMonth: { [key: string]: number } = {};
    finalEntries.forEach((entry: any) => {
      const d = new Date(entry.rawDate);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      entriesByMonth[monthKey] = (entriesByMonth[monthKey] || 0) + entry.total;
    });

    if (filterMode === 'this_month' || filterMode === 'this_month_past') {
      const d = new Date();
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!entriesByMonth[monthKey]) entriesByMonth[monthKey] = 0;
    }

    let totalSalary = 0;
    Object.entries(entriesByMonth).forEach(([monthKey, revenue]) => {
      const applicableRule = [...rules]
        .sort((a, b) => b.startMonth.localeCompare(a.startMonth))
        .find(r => r.startMonth <= monthKey);
      
      if (applicableRule) {
        const salary = revenue - applicableRule.rent - (revenue * applicableRule.rate);
        totalSalary += salary;
      }
    });

    return Math.round(totalSalary);
  };

  const salary = calculateSalary();

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">Comptabilité</h2>
          <p className="text-gray-400 text-sm md:text-base">Analyse financière de Larabstrait</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 w-full md:w-auto">
          <select 
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-lilas/50 text-gray-300 cursor-pointer w-full sm:w-auto"
          >
            <option value="this_month_past">Passés (Ce mois-ci)</option>
            <option value="this_month">Tout le mois</option>
            <option value="last_month">Le mois dernier</option>
            <option value="upcoming">À venir</option>
            <option value="last_3_months">3 derniers mois</option>
            <option value="this_year">Cette année</option>
            <option value="last_year">L'année dernière</option>
            <option value="custom_range">Fourchette de dates</option>
            <option value="all">Tout l'historique</option>
          </select>
          <button className="px-4 py-2 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/5 transition-all w-full sm:w-auto">
            Exporter PDF
          </button>
        </div>
      </header>

      {filterMode === 'custom_range' && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex flex-col space-y-1 w-full sm:w-auto">
            <label className="text-[10px] uppercase text-gray-500 font-bold">Date de début</label>
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none text-gray-300 w-full"/>
          </div>
          <div className="flex flex-col space-y-1 w-full sm:w-auto">
            <label className="text-[10px] uppercase text-gray-500 font-bold">Date de fin</label>
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none text-gray-300 w-full"/>
          </div>
          <button onClick={() => setDateRange({ start: '', end: '' })} className="sm:mt-5 text-xs text-gray-500 hover:text-white">Réinitialiser</button>
        </motion.div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'CA Prévisionnel', value: `${totalRevenue}€`, color: 'text-emerald-400' },
          { label: 'Encaissé', value: `${collected}€`, color: 'text-purple-400' },
          { label: 'À venir', value: `${upcoming}€`, color: 'text-blue-400' },
          { label: 'Salaire', value: `${salary}€`, color: 'text-lilas' },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-4 md:p-6">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-[10px] md:text-xs uppercase tracking-wider">{stat.label}</p>
            </div>
            <h3 className={`text-lg md:text-2xl font-bold ${stat.color}`}>{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="glass-card p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg">Évolution des Revenus</h3>
            <select 
              value={chartFilter}
              onChange={(e) => setChartFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-gray-300 focus:ring-0 cursor-pointer outline-none"
            >
              <option value="this_month">Ce mois-ci (Jour par jour)</option>
              <option value="upcoming_active">À venir (Mois actifs)</option>
              <option value="6_months">6 derniers mois</option>
              <option value="12_months">12 derniers mois</option>
              <option value="this_year">Cette année</option>
            </select>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 40, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d1b3ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#d1b3ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={true} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(value) => `${value}€`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} 
                  itemStyle={{ color: '#fff' }} 
                  formatter={(value: number, name: string) => [`${value}€`, name === 'revenue' ? "Chiffre d'Affaires" : "Salaire Net"]}
                />
                
                {/* Courbe du Salaire Net (devant/en bas) */}
                <Area 
                  type="monotone" 
                  dataKey="net" 
                  name="net" 
                  stroke="#d1b3ff" 
                  fillOpacity={1} 
                  fill="url(#colorNet)" 
                  strokeWidth={3} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                >
                </Area>
                
                {/* Courbe du Chiffre d'Affaires (derrière/en haut) */}
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  name="revenue" 
                  stroke="#d4af37" 
                  fillOpacity={0.5} 
                  fill="url(#colorRev)" 
                  strokeWidth={3} 
                  activeDot={{ r: 6, strokeWidth: 0 }} 
                >
                  <LabelList dataKey="revenue" position="top" offset={10} fill="#d4af37" fontSize={10} formatter={(value: number) => value > 0 ? `${value}€` : ''} />
                </Area>
                
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 md:p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <h3 className="font-bold text-lg">Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              <th className="p-4 text-xs font-bold uppercase text-gray-500">Date</th>
              <th className="p-4 text-xs font-bold uppercase text-gray-500">Client</th>
              <th className="p-4 text-xs font-bold uppercase text-gray-500">Type de Rendez-Vous</th>
              <th className="p-4 text-xs font-bold uppercase text-gray-500">Montant</th>
            </tr>
          </thead>
          <tbody>
            {finalEntries.map((entry: any) => (
              <tr key={entry.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                <td className="p-4 text-sm">{entry.date}</td>
                <td className="p-4 text-sm font-medium">{entry.client}</td>
                <td className="p-4 text-sm text-gray-400">{entry.style}</td>
                <td className="p-4 text-sm font-bold text-lilas">{entry.total}€</td>
              </tr>
            ))}
            {finalEntries.length === 0 && (
              <tr>
                <td colSpan={4} className="p-12 text-center text-gray-500 italic">
                  Aucune transaction trouvée pour cette période.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </motion.div>
  );
};