import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, Calendar, Wallet, FileText, Users, Settings, 
  Sparkles, ChevronDown, LayoutGrid, Image as ImageIcon, ListOrdered, 
  AlertTriangle, RefreshCw, LogOut, X 
} from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, active = false, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
      active ? 'bg-lilas/10 text-lilas border border-lilas/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

export const Sidebar = ({ 
  activeTab, navigateTo, isMobileMenuOpen, setIsMobileMenuOpen, 
  isEventsOpen, setIsEventsOpen, setShowKiosk, loading, fetchData, handleLogout, apiFetch 
}: any) => {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    setIsMobileMenuOpen(false);
    
    // 1. Demande au serveur de vérifier les paiements sur Abby et de MAJ le NAS
    if (apiFetch) {
      try {
        await apiFetch('/api/abby/sync', { method: 'POST' });
      } catch (err) {
        console.error("Erreur de synchronisation Abby:", err);
      }
    }

    // 2. Recharge les rendez-vous avec les données fraîches
    if (fetchData) {
      await fetchData();
    }
    
    setIsSyncing(false);
  };

  return (
    <aside className={`fixed inset-0 z-[60] md:relative md:inset-auto w-full md:w-64 border-r border-white/5 p-6 pt-6 flex flex-col bg-dark-bg transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      <div className="flex items-center justify-between mb-10 md:mb-10 px-2">
        <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigateTo('dashboard')}>
          <div className="w-10 h-10 bg-lilas rounded-lg flex items-center justify-center"><span className="text-black font-bold text-xl">LA</span></div>
          <h1 className="text-xl font-bold tracking-tight">Larabstrait</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
        <SidebarItem icon={LayoutDashboard} label="Tableau de bord" active={activeTab === 'dashboard'} onClick={() => navigateTo('dashboard')} />
        <SidebarItem icon={Calendar} label="Agenda" active={activeTab === 'calendar'} onClick={() => navigateTo('calendar')} />
        <SidebarItem icon={Wallet} label="Comptabilité" active={activeTab === 'accounting'} onClick={() => navigateTo('accounting')} />
        <SidebarItem icon={FileText} label="Facturation" active={activeTab === 'billing'} onClick={() => navigateTo('billing')} />
        <SidebarItem icon={Users} label="Clients" active={activeTab === 'clients'} onClick={() => navigateTo('clients')} />
        <SidebarItem icon={Settings} label="Paramètres" active={activeTab === 'settings'} onClick={() => navigateTo('settings')} />
        
        <div className="space-y-1">
          <button onClick={() => setIsEventsOpen(!isEventsOpen)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-gray-400 hover:bg-white/5 hover:text-white">
            <div className="flex items-center space-x-3"><Sparkles size={20} className={isEventsOpen ? "text-lilas" : ""} /><span className="font-medium">Événements</span></div>
            <motion.div animate={{ rotate: isEventsOpen ? 180 : 0 }}><ChevronDown size={16} /></motion.div>
          </button>
          <AnimatePresence>
            {isEventsOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden flex flex-col space-y-1 ml-4 border-l border-white/10 pl-2 mt-1">
                <SidebarItem icon={LayoutGrid} label="Mode Kiosk" active={false} onClick={() => { setShowKiosk(true); setIsMobileMenuOpen(false); }} />
                <SidebarItem icon={ImageIcon} label="Catalogue Flash" active={activeTab === 'flashes'} onClick={() => navigateTo('flashes')} />
                <SidebarItem icon={ListOrdered} label="File d'attente" active={activeTab === 'queue'} onClick={() => navigateTo('queue')} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <SidebarItem icon={AlertTriangle} label="Bug / Améliorations" active={activeTab === 'reports'} onClick={() => navigateTo('reports')} />
      </nav>

      <div className="pt-6 border-t border-white/5 space-y-2 mt-4">
        <button onClick={handleSync} disabled={isSyncing || loading} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all disabled:opacity-50">
          <RefreshCw size={20} className={(isSyncing || loading) ? "animate-spin text-lilas" : ""} />
          <span className="font-medium">{(isSyncing || loading) ? "Synchro..." : "Synchroniser"}</span>
        </button>
        <SidebarItem icon={LogOut} label="Déconnexion" onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} />
      </div>
    </aside>
  );
};