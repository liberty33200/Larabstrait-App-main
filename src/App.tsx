/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, X, Menu, RefreshCw, AlertCircle } from 'lucide-react';

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

  const apiFetch = async (url: string, options: any = {}) => {
    const token = localStorage.getItem('larabstrait_token');
    const isIframe = window.self !== window.top;
    const headers = { ...options.headers, 'Authorization': token ? `Bearer ${token}` : '', 'X-Dev-Bypass': isIframe ? 'true' : 'false' };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
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

      // 🎯 LE COEUR DE LA MIGRATION : On lit PostgreSQL et on crée un objet propre
      const mappedAppts = (apptsData || []).map((appt: any) => {
        let clientName = appt.client_name || 'Client Inconnu';
        clientName = clientName.split(' ').map((word: string) => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '').join(' ');

        const dateStr = appt.appointment_date;
        const rawDate = dateStr ? new Date(dateStr).getTime() : 0;
        const dateObj = dateStr ? new Date(dateStr) : null;
        const isValid = dateObj instanceof Date && !isNaN(dateObj.getTime());
        
        const depositLabel = appt.deposit_status || 'Non';
        const tattooType = appt.style || 'Tatouage';
        const isTimeOff = (tattooType || '').toLowerCase().includes('congé') || (tattooType || '').toLowerCase().includes('timeoff') || (tattooType || '').toLowerCase().includes('indisponibilité') || (clientName || '').toLowerCase().includes('congé');

        return {
          id: appt.id,
          client: clientName,
          clientEmail: appt.client_email || '',
          phone: appt.client_phone || '',
          instagram: appt.instagram || '',
          date: isValid ? dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date à définir',
          time: (isValid && !isTimeOff) ? dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h') : (isTimeOff ? 'Journée' : ''),
          rawDate, // Utilisé pour le tri
          appointment_date: appt.appointment_date, // Conservé pour les formulaires d'édition
          style: tattooType,
          total: Number(appt.total_price) || 0,
          deposit: depositLabel,
          hasDeposit: depositLabel === 'Oui',
          depositAmount: Number(appt.deposit_amount) || 0,
          location: appt.location || '',
          projectRecap: appt.project_recap || '',
          size: appt.size || '',
          status: depositLabel === 'Oui' ? 'Payé' : 'Confirmé',
          method: 'N/A',
          price: `${Number(appt.total_price) || 0} €`,
          isTimeOff,
          projectStatus: appt.project_status || 'À dessiner',
          // IDs Abby
          abbyBdcId: appt.abby_bdc_id || null,
          abbyAcompteId: appt.abby_deposit_id || null,
          abbyFactureId: appt.abby_final_id || null
        };
      });

      const clientMap = new Map();
      mappedAppts.forEach((appt: any) => {
        if (appt.isTimeOff) return;
        const email = (appt.clientEmail || "").toLowerCase().trim();
        const key = email ? email : appt.client.toLowerCase().trim();
        if (!clientMap.has(key)) {
          clientMap.set(key, { 
            id: key, 
            firstName: appt.client, 
            lastName: '', 
            email: appt.clientEmail, 
            displayName: appt.client 
          });
        }
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
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-dark-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigateTo('dashboard')}>
          <div className="w-8 h-8 bg-lilas rounded-lg flex items-center justify-center"><span className="text-black font-bold text-lg">LA</span></div>
          <h1 className="text-lg font-bold tracking-tight">Larabstrait</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-400 hover:text-white transition-colors">{isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</button>
      </div>

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
        apiFetch={apiFetch}
      />

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
            <ClientsView key="clients" clients={filteredClients} appointments={filteredAppointments} onSelectAppointment={setSelectedAppointment} apiFetch={apiFetch} onUpdate={fetchData} />
          ) : activeTab === 'settings' ? (
            <SettingsView key="settings" rules={accountingRules} setRules={setAccountingRules} apiFetch={apiFetch} isPushSupported={isPushSupported} pushSubscription={pushSubscription} onSubscribe={subscribeToPush} onUnsubscribe={unsubscribeFromPush} onTestNotification={sendTestNotification} />
          ) : activeTab === 'flashes' ? (
            <FlashAdminView key="flashes" />
          ) : activeTab === 'queue' ? (
            <QueueView key="queue" apiFetch={apiFetch} />
          ) : activeTab === 'reports' ? (
            <BugReportView key="reports" apiFetch={apiFetch} />
          ) : (
            <DashboardView key="dashboard" appointments={filteredAppointments} rules={accountingRules} loading={loading} user={user} onSelectAppointment={setSelectedAppointment} apiFetch={apiFetch}/>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showKiosk && <KioskView onClose={() => setShowKiosk(false)} apiFetch={apiFetch} />}
      </AnimatePresence>
    </div>
  );
}