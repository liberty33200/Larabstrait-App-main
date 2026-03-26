/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, X, Menu, RefreshCw, AlertCircle } from 'lucide-react';

// --- IMPORTATION DES VUES ---
import { QueueView } from './components/QueueView';
import { FlashAdminView } from './components/FlashAdminView';
import { KioskView } from './components/KioskView';
import { AccountingView } from './components/AccountingView';
import { CalendarView } from './components/CalendarView';
import { ClientsView } from './components/ClientsView';
import { DashboardView } from './components/DashboardView';
import { AppointmentDetailView } from './components/AppointmentDetailView';
import { BillingView } from './components/BillingView';
import { LoginView } from './components/LoginView';
import { CreateAppointmentView } from './components/CreateAppointmentView';
import { CreateTimeOffView } from './components/CreateTimeOffView';
import { BugReportView } from './components/BugReportView';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';

export default function App() {
  // === 1. ETATS ===
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showKiosk, setShowKiosk] = useState(false);
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [timeOffEvents, setTimeOffEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTimeOffForm, setShowTimeOffForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [isPushSupported, setIsPushSupported] = useState(false);
  
  const [accountingRules, setAccountingRules] = useState([
    { startMonth: '2024-02', rent: 300, rate: 0.211 },
    { startMonth: '2024-03', rent: 400, rate: 0.211 },
    { startMonth: '2024-07', rent: 400, rate: 0.231 },
    { startMonth: '2025-01', rent: 400, rate: 0.248 },
    { startMonth: '2025-04', rent: 450, rate: 0.248 },
    { startMonth: '2025-07', rent: 90, rate: 0.248 },
    { startMonth: '2025-08', rent: 450, rate: 0.248 },
    { startMonth: '2025-12', rent: 208.63, rate: 0.248 },
    { startMonth: '2026-01', rent: 450, rate: 0.263 },
  ].sort((a, b) => b.startMonth.localeCompare(a.startMonth)));

  // === 2. NOTIFICATIONS PUSH ===
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  };

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsPushSupported(true);
      navigator.serviceWorker.register('/sw.js')
        .then(registration => registration.pushManager.getSubscription())
        .then(subscription => setPushSubscription(subscription))
        .catch(err => console.error('Erreur SW:', err));
    }
  }, []);

  const subscribeToPush = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { alert("La permission pour les notifications a été refusée."); return false; }
      const response = await apiFetch('/api/notifications/vapid-public-key');
      const { publicKey } = await response.json();
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await apiFetch('/api/notifications/subscribe', { method: 'POST', body: JSON.stringify(subscription), headers: { 'Content-Type': 'application/json' } });
      setPushSubscription(subscription);
      return true;
    } catch (error: any) { alert("Erreur lors de l'activation des notifications."); return false; }
  };

  const unsubscribeFromPush = async () => {
    if (pushSubscription) { await pushSubscription.unsubscribe(); setPushSubscription(null); }
  };

  const sendTestNotification = async () => {
    try {
      const res = await apiFetch('/api/notifications/send-test', { method: 'POST' });
      if (res.ok) alert("Notification de test envoyée !");
    } catch (error: any) { alert("Erreur réseau lors de l'envoi du test."); }
  };

  // === 3. LOGIQUE API & AUTHENTIFICATION ===
  const apiFetch = async (url: string, options: any = {}) => {
    const token = localStorage.getItem('larabstrait_token');
    const isIframe = window.self !== window.top;
    const headers = { ...options.headers, 'Authorization': token ? `Bearer ${token}` : '', 'X-Dev-Bypass': isIframe ? 'true' : 'false' };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (e) { clearTimeout(timeoutId); throw e; }
  };

  const fetchData = async (isBackground = false) => {
    if (!isAuthenticated) return;
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const [apptsRes, timeOffRes] = await Promise.all([
        apiFetch('/api/appointments'),
        apiFetch('/api/bookings/timeoff').catch(() => ({ ok: false, json: () => Promise.resolve([]) }))
      ]);

      if (apptsRes.status === 401) { setIsAuthenticated(false); return; }

      const apptsData = await apptsRes.json();
      const timeOffData = timeOffRes.ok ? await timeOffRes.json() : [];

      if (!apptsRes.ok || apptsData.error) throw new Error(`Rendez-vous: ${apptsData.details || apptsData.error}`);

      const mappedAppts = (apptsData || []).map((appt: any) => {
        const clientObj = appt.cr7e0_ficheclient || {};
        let clientName = clientObj.cr7e0_nomclient || appt.cr7e0_nomclient || clientObj.cr7e0_nomduclient || appt.cr7e0_nomduclient || clientObj.cr7e0_nom || appt.cr7e0_nom || clientObj.cr7e0_name || appt.cr7e0_name || 'Client Inconnu';
        clientName = clientName.split(' ').map((word: string) => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '').join(' ');

        const dateStr = appt.cr7e0_daterdv;
        const rawDate = dateStr ? new Date(dateStr).getTime() : 0;
        const dateObj = dateStr ? new Date(dateStr) : null;
        const isValid = dateObj instanceof Date && !isNaN(dateObj.getTime());
        
        const depositLabel = appt['cr7e0_acompte@OData.Community.Display.V1.FormattedValue'] || { "129690000": "Oui", "129690001": "Non", "129690002": "Dispensé" }[String(appt.cr7e0_acompte)] || 'Non';
        const tattooType = appt['cr7e0_typederdv@OData.Community.Display.V1.FormattedValue'] || { "129690000": "Flash", "129690001": "Projet perso", "129690002": "Retouches", "129690003": "RDV Préparatoire", "129690004": "Event", "129690005": "Cadeau" }[String(appt.cr7e0_typederdv)] || appt.cr7e0_typederdv || 'Tatouage';
        const isTimeOff = (tattooType || '').toLowerCase().includes('congé') || (tattooType || '').toLowerCase().includes('timeoff') || (tattooType || '').toLowerCase().includes('indisponibilité') || (clientName || '').toLowerCase().includes('congé');
        const orderFormLabel = appt['cr7e0_boncommande@OData.Community.Display.V1.FormattedValue'] || { "129690000": "Édité", "129690001": "Non édité", "129690002": "Dispensé" }[String(appt.cr7e0_boncommande)] || 'Non édité';

        return {
          id: appt.cr7e0_gestiontatouageid || appt.id,
          client: clientName,
          clientEmail: appt.cr7e0_email || '',
          date: isValid ? dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date à définir',
          time: (isValid && !isTimeOff) ? dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : (isTimeOff ? 'Journée' : ''),
          rawDate,
          style: tattooType,
          total: appt.cr7e0_tariftattoo || 0,
          deposit: depositLabel,
          hasDeposit: depositLabel === 'Oui',
          depositAmount: appt.cr7e0_montantacompte || 0,
          orderForm: orderFormLabel,
          location: appt.cr7e0_emplacement || '',
          projectRecap: appt.cr7e0_recapitulatifprojet || '',
          size: appt.cr7e0_taille || '',
          status: depositLabel === 'Oui' ? 'Payé' : 'Confirmé',
          method: 'N/A',
          price: `${appt.cr7e0_tariftattoo || 0} €`,
          isTimeOff,
          projectStatus: appt.cr7e0_etatdessin || 'À dessiner'
        };
      });

      const clientMap = new Map();
      mappedAppts.forEach(appt => {
        if (appt.isTimeOff) return;
        const email = (appt.clientEmail || "").toLowerCase().trim();
        const key = email ? email : appt.client.toLowerCase().trim();
        if (!clientMap.has(key)) clientMap.set(key, { id: key, firstName: appt.client, lastName: '', email: appt.clientEmail, displayName: appt.client });
      });

      setAppointments(mappedAppts);
      setClients(Array.from(clientMap.values()) as any);
      
      const mappedTimeOff = (timeOffData || []).map((item: any) => ({
        id: item.id, title: item.serviceName || 'Congé / Indisponibilité', start: item.startDateTime?.dateTime, end: item.endDateTime?.dateTime, isTimeOff: true
      }));
      setTimeOffEvents(mappedTimeOff);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const checkAuth = async () => {
    setLoading(true);
    try {
      const isIframe = window.self !== window.top;
      if (isIframe) {
        setIsAuthenticated(true);
        setUser({ name: "Aperçu AI Studio", username: "preview@aistudio.google", homeAccountId: "bypass-id" });
        setAuthChecking(false);
        setLoading(false);
        return true;
      }
      const res = await apiFetch('/api/auth/status');
      const data = await res.json();
      setIsAuthenticated(data.isAuthenticated);
      setUser(data.user);
      return data.isAuthenticated;
    } catch (err) { setIsAuthenticated(false); return false; } finally { setAuthChecking(false); setLoading(false); }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('larabstrait_token');
      setIsAuthenticated(false);
      setUser(null);
    } catch (err) { console.error("Erreur déconnexion:", err); }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('larabstrait_token', tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      const intervalId = setInterval(() => fetchData(true), 120000);
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticated]);

  // === 4. FILTRES ===
  const filteredAppointments = appointments.filter((appt: any) => {
    if (appt.isTimeOff) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return ((appt.client && appt.client.toLowerCase().includes(query)) || (appt.clientEmail && appt.clientEmail.toLowerCase().includes(query)) || (appt.style && appt.style.toLowerCase().includes(query)));
  });

  const filteredClients = clients.filter((client: any) => {
    if ((client.displayName || "").toLowerCase().includes('congé')) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return ((client.displayName && client.displayName.toLowerCase().includes(query)) || (client.firstName && client.firstName.toLowerCase().includes(query)) || (client.lastName && client.lastName.toLowerCase().includes(query)) || (client.email && client.email.toLowerCase().includes(query)));
  });

  const navigateTo = (tab: string) => {
    setActiveTab(tab);
    setShowCreateForm(false);
    setShowTimeOffForm(false);
    setSelectedAppointment(null);
    setIsMobileMenuOpen(false);
  };

  if (authChecking) return <div className="min-h-screen bg-dark-bg flex items-center justify-center"><RefreshCw className="text-lilas animate-spin" size={48} /></div>;
  if (!isAuthenticated) return <LoginView onLoginSuccess={checkAuth} apiFetch={apiFetch} isAuthenticated={isAuthenticated} />;

  return (
    <div className="flex h-screen bg-dark-bg text-gray-100 overflow-hidden flex-col md:flex-row">
      {/* HEADER MOBILE */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-dark-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigateTo('dashboard')}>
          <div className="w-8 h-8 bg-lilas rounded-lg flex items-center justify-center"><span className="text-black font-bold text-lg">LA</span></div>
          <h1 className="text-lg font-bold tracking-tight">Larabstrait</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-400 hover:text-white transition-colors">{isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</button>
      </div>

      {/* SIDEBAR EXTERNALISÉE */}
      <Sidebar 
        activeTab={activeTab} 
        navigateTo={navigateTo} 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isEventsOpen={isEventsOpen} 
        setIsEventsOpen={setIsEventsOpen} 
        setShowKiosk={setShowKiosk}
        loading={loading} 
        fetchData={fetchData} 
        handleLogout={handleLogout}
      />

      {/* CONTENU PRINCIPAL */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {!selectedAppointment && (
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input type="text" placeholder="Rechercher un client, un email ou un style..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-card-bg border border-white/10 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-lilas/50 transition-all w-full" />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={16} /></button>}
            </div>
            {activeTab === 'dashboard' && !showCreateForm && !selectedAppointment && (
              <button onClick={() => setShowCreateForm(true)} className="btn-primary flex items-center justify-center space-x-2 md:w-auto w-full"><Plus size={20} /><span>Nouveau RDV</span></button>
            )}
          </div>
        )}

        {error && <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex items-center space-x-3"><AlertCircle size={20} /><span>{error}</span></div>}

        {/* ROUTEUR */}
        <AnimatePresence mode="wait">
          {showCreateForm ? (
            <CreateAppointmentView key="create" clients={filteredClients} onBack={() => setShowCreateForm(false)} onCreated={() => { setShowCreateForm(false); fetchData(); }} apiFetch={apiFetch} />
          ) : showTimeOffForm ? (
            <CreateTimeOffView key="timeoff" onBack={() => setShowTimeOffForm(false)} onCreated={() => { setShowTimeOffForm(false); fetchData(); }} apiFetch={apiFetch} />
          ) : selectedAppointment ? (
            <AppointmentDetailView key="detail" appointment={selectedAppointment} onBack={() => setSelectedAppointment(null)} onUpdate={() => { setSelectedAppointment(null); fetchData(); }} apiFetch={apiFetch} />
          ) : activeTab === 'calendar' ? (
            <CalendarView key="calendar" appointments={appointments} timeOffEvents={timeOffEvents} onSelectAppointment={setSelectedAppointment} onCreateAppointment={() => setShowCreateForm(true)} onCreateTimeOff={() => setShowTimeOffForm(true)} />
          ) : activeTab === 'accounting' ? (
            <AccountingView key="accounting" appointments={filteredAppointments} rules={accountingRules} loading={loading} />
          ) : activeTab === 'billing' ? (
            <BillingView key="billing" appointments={filteredAppointments} clients={filteredClients} apiFetch={apiFetch} />
          ) : activeTab === 'clients' ? (
            <ClientsView key="clients" clients={filteredClients} appointments={filteredAppointments} onSelectAppointment={setSelectedAppointment} apiFetch={apiFetch} />
          ) : activeTab === 'settings' ? (
            <SettingsView key="settings" rules={accountingRules} setRules={setAccountingRules} apiFetch={apiFetch} isPushSupported={isPushSupported} pushSubscription={pushSubscription} onSubscribe={subscribeToPush} onUnsubscribe={unsubscribeFromPush} onTestNotification={sendTestNotification} />
          ) : activeTab === 'flashes' ? (
            <FlashAdminView key="flashes" />
          ) : activeTab === 'queue' ? (
            <QueueView key="queue" apiFetch={apiFetch} />
          ) : activeTab === 'reports' ? (
            <BugReportView key="reports" apiFetch={apiFetch} />
          ) : (
            <DashboardView key="dashboard" appointments={filteredAppointments} rules={accountingRules} loading={loading} user={user} onSelectAppointment={setSelectedAppointment} />
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showKiosk && <KioskView onClose={() => setShowKiosk(false)} apiFetch={apiFetch} />}
      </AnimatePresence>
    </div>
  );
}