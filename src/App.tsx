/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 

  Calendar,
  Users, 
  Download,
  Clock, 
  Plus, 
  Search, 
  LayoutDashboard, 
  Settings, 
  LogOut,
  Eye,
  Mail,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Wallet,
  TrendingUp,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Edit2,
  Trash2,
  Copy,
  Check,
  ArrowLeft,
  Save,
  Menu,
  X,
  ExternalLink,
  AlertTriangle,
  Filter,
  Plane,
  FileText,
  Receipt,
  FilePlus,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BillingView } from './components/BillingView';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LabelList
} from 'recharts';

// Mock Data - Simulant ce qui viendra de Dataverse
const MOCK_APPOINTMENTS = [
  {
    id: '1',
    client: 'Alice Dubois',
    time: '14:00',
    date: 'Aujourd\'hui',
    style: 'Réalisme Noir & Gris',
    status: 'Confirmé',
    price: '350€',
    duration: '4h'
  },
  {
    id: '2',
    client: 'Marc Lefebvre',
    time: '10:30',
    date: 'Demain',
    style: 'Traditionnel Américain',
    status: 'En attente',
    price: '200€',
    duration: '2h'
  },
  {
    id: '3',
    client: 'Sophie Martin',
    time: '16:00',
    date: '14 Mars',
    style: 'Fine Line / Floral',
    status: 'Confirmé',
    price: '150€',
    duration: '1.5h'
  }
];

const SidebarItem = ({ icon: Icon, label, active = false, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
      active 
        ? 'bg-lilas/10 text-lilas border border-lilas/20' 
        : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const CollapsibleSection = ({ title, icon: Icon, children, defaultOpen = true }: any) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="glass-card overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center space-x-3">
          {Icon && <Icon size={20} className="text-lilas" />}
          <h3 className="text-xl font-bold">{title}</h3>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={20} className="text-gray-500" />
        </motion.div>
      </button>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="p-6 pt-0 border-t border-white/5">
              <div className="mt-6">
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BookingBusinessFinder = ({ apiFetch }: { apiFetch: any }) => {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchBusinesses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/bookings/businesses');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la récupération');
      setBusinesses(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Utilisez cet outil pour trouver l'identifiant technique de votre entreprise Microsoft Bookings.
        </p>
        <button 
          onClick={fetchBusinesses}
          disabled={loading}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 disabled:opacity-50"
        >
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
          <span>{businesses.length > 0 ? "Actualiser" : "Lister mes entreprises"}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {businesses.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {businesses.map((biz: any) => (
            <div key={biz.id} className="p-4 bg-white/5 border border-white/5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm">{biz.displayName}</h4>
                <p className="text-[10px] text-gray-500 font-mono mt-1">{biz.id}</p>
              </div>
              <button 
                onClick={() => copyToClipboard(biz.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${
                  copiedId === biz.id ? 'bg-emerald-500 text-black' : 'bg-lilas/10 text-lilas hover:bg-lilas/20'
                }`}
              >
                {copiedId === biz.id ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedId === biz.id ? "Copié !" : "Copier l'ID"}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {businesses.length === 0 && !loading && !error && (
        <div className="p-8 border border-dashed border-white/10 rounded-xl text-center">
          <p className="text-xs text-gray-500 italic">Cliquez sur le bouton pour charger vos entreprises Bookings.</p>
        </div>
      )}
      
      <div className="p-4 bg-lilas/5 border border-lilas/10 rounded-xl">
        <p className="text-[10px] text-lilas/70 leading-relaxed">
          <strong>Note :</strong> Une fois l'ID copié, vous devez le renseigner dans la variable d'environnement <code>MICROSOFT_BOOKING_BUSINESS_ID</code> de votre projet AI Studio pour que la synchronisation des congés s'active.
        </p>
      </div>
    </div>
  );
};

const SettingsView = ({ 
  rules, 
  setRules, 
  apiFetch, 
  isPushSupported, 
  pushSubscription, 
  onSubscribe, 
  onUnsubscribe,
  onTestNotification
}: any) => {
  const [newRule, setNewRule] = useState({ startMonth: '', rent: '', rate: '' });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [abbyKey, setAbbyKey] = useState('');
  const [abbySaving, setAbbySaving] = useState(false);
  const [abbyStatus, setAbbyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const fetchAbbySettings = async () => {
      try {
        const res = await apiFetch('/api/settings/abby');
        if (res.ok) {
          const data = await res.json();
          setAbbyKey(data.abby_api_key || '');
        }
      } catch (err) {
        console.error("Erreur chargement Abby:", err);
      }
    };
    fetchAbbySettings();
  }, []);

  const handleSaveAbby = async () => {
    setAbbySaving(true);
    setAbbyStatus('idle');
    try {
      const res = await apiFetch('/api/settings/abby', {
        method: 'POST',
        body: JSON.stringify({ abby_api_key: abbyKey }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setAbbyStatus('success');
        setTimeout(() => setAbbyStatus('idle'), 3000);
      } else {
        setAbbyStatus('error');
      }
    } catch (err) {
      console.error("Erreur sauvegarde Abby:", err);
      setAbbyStatus('error');
    } finally {
      setAbbySaving(false);
    }
  };

  const handleTogglePush = async () => {
    setNotifLoading(true);
    if (pushSubscription) {
      await onUnsubscribe();
    } else {
      await onSubscribe();
    }
    setNotifLoading(false);
  };

  const addRule = () => {
    if (!newRule.startMonth || !newRule.rent || !newRule.rate) return;
    
    let updatedRules;
    if (editingIndex !== null) {
      updatedRules = rules.map((rule: any, i: number) => 
        i === editingIndex 
          ? { 
              startMonth: newRule.startMonth, 
              rent: parseFloat(newRule.rent), 
              rate: parseFloat(newRule.rate) / 100 
            } 
          : rule
      );
      setEditingIndex(null);
    } else {
      updatedRules = [...rules, { 
        startMonth: newRule.startMonth, 
        rent: parseFloat(newRule.rent), 
        rate: parseFloat(newRule.rate) / 100 
      }];
    }
    
    setRules(updatedRules.sort((a: any, b: any) => b.startMonth.localeCompare(a.startMonth)));
    setNewRule({ startMonth: '', rent: '', rate: '' });
  };

  const startEdit = (index: number) => {
    const rule = rules[index];
    setNewRule({
      startMonth: rule.startMonth,
      rent: rule.rent.toString(),
      rate: (rule.rate * 100).toString()
    });
    setEditingIndex(index);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setNewRule({ startMonth: '', rent: '', rate: '' });
  };

  const removeRule = (index: number) => {
    if (editingIndex === index) cancelEdit();
    setRules(rules.filter((_: any, i: number) => i !== index));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-3xl font-bold">Paramètres</h2>
        <p className="text-gray-400">Gérez vos préférences et configurations comptables</p>
      </div>

      <CollapsibleSection title="Profil & Studio" icon={Users} defaultOpen={true}>
        <div className="p-12 text-center text-gray-500 italic">
          Options de profil bientôt disponibles...
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Notifications" icon={Bell} defaultOpen={true}>
        <div className="p-8 space-y-6">
          {!isPushSupported ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
              Votre navigateur ne semble pas supporter les notifications Web Push.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="font-bold">Notifications Push</h4>
                  <p className="text-sm text-gray-400">Recevez des alertes directement sur votre téléphone ou ordinateur.</p>
                </div>
                <button 
                  onClick={handleTogglePush}
                  disabled={notifLoading}
                  className={`px-6 py-2 rounded-xl font-bold transition-all ${
                    pushSubscription 
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20' 
                      : 'bg-lilas text-black hover:bg-lilas/80'
                  }`}
                >
                  {notifLoading ? 'Action...' : pushSubscription ? 'Désactiver' : 'Activer'}
                </button>
              </div>

              {pushSubscription && (
                <div className="pt-6 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm">Tester la connexion</h4>
                      <p className="text-xs text-gray-500">Envoyez une notification de test pour vérifier que tout fonctionne.</p>
                    </div>
                    <button 
                      onClick={onTestNotification}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold transition-all"
                    >
                      Envoyer un test
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-gray-400">Problème de réception ?</h4>
                      <p className="text-xs text-gray-500">Si vous ne recevez rien, essayez de ré-enregistrer votre appareil.</p>
                    </div>
                    <button 
                      onClick={async () => {
                        setNotifLoading(true);
                        await onUnsubscribe();
                        await onSubscribe();
                        setNotifLoading(false);
                      }}
                      disabled={notifLoading}
                      className="px-4 py-2 text-lilas hover:underline text-xs font-bold transition-all"
                    >
                      Ré-enregistrer
                    </button>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start space-x-3">
                <AlertCircle size={18} className="text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-400/80 space-y-2">
                  <p><strong>Note sur l'aperçu :</strong> Si la fenêtre de demande d'autorisation ne s'affiche pas, c'est probablement parce que l'application est ouverte dans un cadre (iframe). Cliquez sur le bouton <strong>"Ouvrir dans un nouvel onglet"</strong> en haut à droite de votre écran pour activer les notifications.</p>
                  <p><strong>Note pour iPhone/iPad :</strong> Pour recevoir des notifications sur iOS, vous devez d'abord ajouter cette application à votre écran d'accueil (Partager {'>'} Sur l'écran d'accueil).</p>
                </div>
              </div>
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Intégration Microsoft Bookings" icon={Calendar} defaultOpen={false}>
        <BookingBusinessFinder apiFetch={apiFetch} />
      </CollapsibleSection>

      <CollapsibleSection title="Intégration Abby" icon={Receipt} defaultOpen={false}>
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="font-bold">Clé API Abby</h4>
              <p className="text-sm text-gray-400">Connectez votre compte Abby pour automatiser votre facturation.</p>
            </div>
            <div className="flex items-center space-x-2">
              {abbyStatus === 'success' && <span className="text-emerald-400 text-xs font-bold flex items-center"><Check size={14} className="mr-1" /> Enregistré</span>}
              {abbyStatus === 'error' && <span className="text-rose-400 text-xs font-bold flex items-center"><AlertCircle size={14} className="mr-1" /> Erreur</span>}
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase font-bold">Clé API</label>
              <div className="flex space-x-2">
                <input 
                  type="password" 
                  placeholder="Saisissez votre clé API Abby..."
                  value={abbyKey}
                  onChange={(e) => setAbbyKey(e.target.value)}
                  className="flex-1 bg-dark-bg border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-lilas/50 outline-none"
                />
                <button 
                  onClick={handleSaveAbby}
                  disabled={abbySaving}
                  className="px-6 py-2 bg-lilas text-black font-bold rounded-xl hover:bg-lilas/80 transition-all disabled:opacity-50"
                >
                  {abbySaving ? '...' : 'Enregistrer'}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Vous pouvez trouver votre clé API dans les paramètres de votre compte Abby. 
              Cette clé est stockée de manière sécurisée dans votre base de données privée.
            </p>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Configuration Comptable (Loyer & URSSAF)" icon={Wallet} defaultOpen={false}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end bg-white/5 p-4 rounded-xl border border-white/10">
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase font-bold">Mois de début</label>
              <input 
                type="month" 
                value={newRule.startMonth}
                onChange={(e) => setNewRule({ ...newRule, startMonth: e.target.value })}
                className="w-full bg-dark-bg border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-lilas/50 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase font-bold">Loyer (€)</label>
              <input 
                type="number" 
                placeholder="ex: 450"
                value={newRule.rent}
                onChange={(e) => setNewRule({ ...newRule, rent: e.target.value })}
                className="w-full bg-dark-bg border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-lilas/50 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase font-bold">Taux URSSAF (%)</label>
              <input 
                type="number" 
                step="0.1"
                placeholder="ex: 24.8"
                value={newRule.rate}
                onChange={(e) => setNewRule({ ...newRule, rate: e.target.value })}
                className="w-full bg-dark-bg border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-lilas/50 outline-none"
              />
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={addRule}
                className="flex-1 btn-primary py-2 flex items-center justify-center space-x-2"
              >
                {editingIndex !== null ? <RefreshCw size={18} /> : <Plus size={18} />}
                <span>{editingIndex !== null ? 'Mettre à jour' : 'Ajouter'}</span>
              </button>
              {editingIndex !== null && (
                <button 
                  onClick={cancelEdit}
                  className="px-4 py-2 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/5 transition-all"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/5">
                  <th className="p-4 text-xs font-bold uppercase text-gray-500">À partir de</th>
                  <th className="p-4 text-xs font-bold uppercase text-gray-500">Loyer</th>
                  <th className="p-4 text-xs font-bold uppercase text-gray-500">Taux URSSAF</th>
                  <th className="p-4 text-xs font-bold uppercase text-gray-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule: any, i: number) => (
                  <tr key={i} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${editingIndex === i ? 'bg-lilas/5' : ''}`}>
                    <td className="p-4 text-sm font-medium">{rule.startMonth}</td>
                    <td className="p-4 text-sm">{rule.rent}€</td>
                    <td className="p-4 text-sm">{(rule.rate * 100).toFixed(1)}%</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => startEdit(i)}
                          className="p-2 text-gray-400 hover:text-lilas hover:bg-lilas/10 rounded-lg transition-all"
                          title="Modifier"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => removeRule(i)}
                          className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CollapsibleSection>
    </motion.div>
  );
};

// ... (imports and mock data remain same)

const AppointmentDetailView = ({ appointment, onBack, onUpdate, apiFetch }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    date: appointment.rawDate ? new Date(appointment.rawDate).toISOString().split('T')[0] : '',
    time: appointment.time || '14:00',
    style: appointment.style || '',
    total: appointment.total || 0,
    deposit: appointment.deposit || 'Non',
    depositAmount: appointment.depositAmount || (appointment.deposit === 'Oui' ? 50 : 0),
    status: appointment.status || 'Confirmé',
    orderForm: appointment.orderForm || 'Non édité',
    location: appointment.location || '',
    projectRecap: appointment.projectRecap || '',
    size: appointment.size || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  
  // NOUVEL ÉTAT POUR L'EMAIL
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      try {
        const res = await apiFetch('/api/settings/abby');
        if (res.ok) {
          const data = await res.json();
          setHasApiKey(!!data.abby_api_key);
        }
      } catch (err) {
        console.error("Erreur check clé Abby:", err);
      }
    };
    checkKey();
  }, []);

  const handleCreateAbbyDocument = async (type: string) => {
    if (!hasApiKey) {
      alert("Veuillez d'abord configurer votre clé API Abby dans les paramètres.");
      return;
    }
    
    setIsCreating(type);
    try {
      const res = await apiFetch('/api/abby/create-document', {
        method: 'POST',
        body: JSON.stringify({ appointment, type }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      if (res.ok) {
        const successMsg = type === 'Recette' 
          ? "La recette a été enregistrée avec succès dans votre livre Abby."
          : `Le document "${type}" a été créé avec succès dans Abby.`;
        alert(successMsg);
      } else {
        alert(data.error || "Erreur lors de la création du document.");
      }
    } catch (err) {
      alert("Erreur réseau lors de la création du document.");
    } finally {
      setIsCreating(null);
    }
  };

  // NOUVELLE FONCTION POUR ENVOYER L'EMAIL
  // On remplace l'ancien état par celui-ci qui gère les 3 phases : idle, success, error
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSendPdf = async () => {
    if (!appointment.clientEmail) {
      alert("Ce client n'a pas d'adresse email renseignée.");
      return;
    }
    setEmailStatus('sending');
    try {
      const res = await apiFetch(`/api/appointments/${appointment.id}/send-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clientEmail: appointment.clientEmail, 
          clientName: appointment.client 
        })
      });
      setEmailStatus(res.ok ? 'success' : 'error');
    } catch (e) {
      setEmailStatus('error');
    }
    setTimeout(() => setEmailStatus('idle'), 5000);
  };

  const calculateDefaultDeposit = (total: number) => {
    const t = parseFloat(total.toString());
    if (t === 0) return 0;
    if (t < 200) return 50;
    return t * 0.25;
  };

  const getControlStatus = (appt: any) => {
    const style = (appt.style || "").trim();
    const deposit = appt.deposit || "Non";
    const total = parseFloat((appt.total || 0).toString());
    const orderForm = appt.orderForm || "Non édité";

    let baseStatus = "Validé";
    if (!style) {
      baseStatus = "A contrôler";
    } else if (style.toLowerCase() === "flash" || style.toLowerCase() === "projet perso") {
      const hasDeposit = deposit === "Oui" || deposit === "Dispensé";
      const hasTotal = total > 0;
      const isFree = total === 0;

      if (!isFree && (!hasDeposit || !hasTotal)) {
        baseStatus = "A contrôler";
      }
    }

    if (baseStatus === "A contrôler") {
      if (orderForm === "Non édité") {
        return { label: "A contrôler + BDC", color: "bg-rose-500/10 text-rose-400 border border-rose-500/20" };
      }
      return { label: "À contrôler", color: "bg-rose-500/10 text-rose-400 border border-rose-500/20" };
    }

    if (baseStatus === "Validé") {
      if (orderForm === "Non édité") {
        return { label: "Bon de commande à faire", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20" };
      }
      if (orderForm === "Édité" || orderForm === "Dispensé") {
        return { label: "Complété", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" };
      }
      return { label: "Validé", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" };
    }

    return { label: baseStatus, color: "bg-gray-500/10 text-gray-400 border border-gray-500/20" };
  };

  const currentControlStatus = isEditing 
    ? getControlStatus({ style: formData.style, deposit: formData.deposit, total: formData.total, orderForm: formData.orderForm })
    : getControlStatus(appointment);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      
      const orderFormIds: Record<string, number> = {
        "Édité": 129690000,
        "Non édité": 129690001,
        "Dispensé": 129690002
      };

      const depositIds: Record<string, number> = {
        "Oui": 129690000,
        "Non": 129690001,
        "Dispensé": 129690002
      };

      const styleIds: Record<string, number> = {
        "Flash": 129690000,
        "Projet perso": 129690001,
        "Retouches": 129690002,
        "RDV Préparatoire": 129690003,
        "Event": 129690004,
        "Cadeau": 129690005
      };

      const updatePayload: any = {
        cr7e0_daterdv: dateTime.toISOString(),
        cr7e0_tariftattoo: parseFloat(formData.total.toString()),
        cr7e0_acompte: (depositIds[formData.deposit] || 129690001).toString(),
        cr7e0_montantacompte: parseFloat(formData.depositAmount.toString()),
        cr7e0_typederdv: (styleIds[formData.style] || 129690000).toString(),
        cr7e0_boncommande: (orderFormIds[formData.orderForm] || 129690001).toString(),
        cr7e0_emplacement: formData.location,
        cr7e0_recapitulatifprojet: formData.projectRecap,
        cr7e0_taille: formData.size
      };

      const response = await apiFetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la mise à jour");
      }

      onUpdate();
    } catch (err: any) {
      console.error("Erreur sauvegarde:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError(null);
    setShowDeleteConfirm(false);
    try {
      const response = await apiFetch(`/api/appointments/${appointment.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la suppression");
      }

      onUpdate();
    } catch (err: any) {
      console.error("Erreur suppression:", err);
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Retour</span>
        </button>
        
        <div className="flex items-center space-x-3">
          {!isEditing ? (
            <>
              <button 
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all flex items-center space-x-2"
              >
                <Edit2 size={16} />
                <span>Modifier</span>
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium transition-all"
              >
                Annuler
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-lilas text-black rounded-xl text-sm font-bold transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex items-center space-x-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card p-8">
            <div className="flex items-center space-x-6 mb-8">
              <div className="w-20 h-20 rounded-full bg-lilas/10 flex items-center justify-center text-lilas text-3xl font-bold border-2 border-lilas/20">
                {appointment.client.charAt(0)}
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-1">{appointment.client}</h2>
                <p className="text-gray-400">{appointment.clientEmail || 'Pas d\'email renseigné'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Type de projet</label>
                {isEditing ? (
                  <select 
                    value={formData.style}
                    onChange={(e) => setFormData({...formData, style: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all appearance-none"
                  >
                    <option value="Flash">Flash</option>
                    <option value="Projet perso">Projet perso</option>
                    <option value="Retouches">Retouches</option>
                    <option value="RDV Préparatoire">RDV Préparatoire</option>
                    <option value="Event">Event</option>
                    <option value="Cadeau">Cadeau</option>
                  </select>
                ) : (
                  <p className="text-lg font-medium">{appointment.style}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Contrôle</label>
                <div className="flex items-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${currentControlStatus.color}`}>
                    {currentControlStatus.label}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Date</label>
                {isEditing ? (
                  <input 
                    type="date" 
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
                  />
                ) : (
                  <p className="text-lg font-medium">{appointment.date}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Heure</label>
                {isEditing ? (
                  <input 
                    type="time" 
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
                  />
                ) : (
                  <p className="text-lg font-medium">{appointment.time}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Bon de commande</label>
                {isEditing ? (
                  <select 
                    value={formData.orderForm}
                    onChange={(e) => setFormData({...formData, orderForm: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all appearance-none"
                  >
                    <option value="Non édité">Non édité</option>
                    <option value="Édité">Édité</option>
                    <option value="Dispensé">Dispensé</option>
                  </select>
                ) : (
                  <p className="text-lg font-medium">{appointment.orderForm || 'Non édité'}</p>
                )}
              </div>
            </div>
          </div>

          <div className="glass-card p-8">
            <h3 className="text-xl font-bold mb-6">Détails du projet</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Emplacement</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
                    placeholder="Ex: Avant-bras interne"
                  />
                ) : (
                  <p className="text-lg font-medium">{appointment.location || 'Non renseigné'}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Taille</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.size}
                    onChange={(e) => setFormData({...formData, size: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
                    placeholder="Ex: 15cm x 10cm"
                  />
                ) : (
                  <p className="text-lg font-medium">{appointment.size || 'Non renseignée'}</p>
                )}
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Récap Projet</label>
                {isEditing ? (
                  <textarea 
                    value={formData.projectRecap}
                    onChange={(e) => setFormData({...formData, projectRecap: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all min-h-[100px]"
                    placeholder="Détails du projet..."
                  />
                ) : (
                  <p className="text-lg font-medium whitespace-pre-wrap">{appointment.projectRecap || 'Aucun récapitulatif'}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Financial Info & Actions */}
        <div className="space-y-8">
          <div className="glass-card p-8 border-t-4 border-lilas">
            <h3 className="text-xl font-bold mb-6 flex items-center space-x-2">
              <Wallet size={20} className="text-lilas" />
              <span>Paiement</span>
            </h3>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Tarif Total</span>
                {isEditing ? (
                  <div className="relative w-32">
                    <input 
                      type="number" 
                      value={formData.total || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newTotal = val === '' ? 0 : parseFloat(val);
                        setFormData({
                          ...formData, 
                          total: newTotal,
                          depositAmount: calculateDefaultDeposit(newTotal)
                        });
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-right focus:outline-none focus:border-lilas/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  </div>
                ) : (
                  <span className="text-2xl font-bold text-lilas">{appointment.total}€</span>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Acompte versé</span>
                {isEditing ? (
                  <select 
                    value={formData.deposit}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData, 
                        deposit: val,
                        depositAmount: formData.depositAmount || calculateDefaultDeposit(formData.total)
                      });
                    }}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus:outline-none"
                  >
                    <option value="Oui">Oui</option>
                    <option value="Non">Non</option>
                    <option value="Dispensé">Dispensé</option>
                  </select>
                ) : (
                  <span className={`font-bold ${
                    appointment.deposit === 'Oui' ? 'text-emerald-400' : 
                    appointment.deposit === 'Dispensé' ? 'text-purple-400' : 'text-rose-400'
                  }`}>
                    {appointment.deposit || 'Non'}
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Montant Acompte</span>
                {isEditing ? (
                  <div className="relative w-32">
                    <input 
                      type="number" 
                      value={formData.depositAmount}
                      onChange={(e) => setFormData({...formData, depositAmount: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-right focus:outline-none focus:border-lilas/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  </div>
                ) : (
                  <span className="font-medium">{appointment.depositAmount || calculateDefaultDeposit(appointment.total)}€</span>
                )}
              </div>

              <div className="pt-6 border-t border-white/5 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Total</span>
                  <span>{formData.total}€</span>
                </div>
                
                {formData.deposit === 'Oui' ? (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Acompte</span>
                      <span className="text-rose-400">-{formData.depositAmount}€</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                      <span className="text-base font-bold text-gray-300">Reste à percevoir</span>
                      <span className="text-2xl font-black text-lilas">
                        {formData.total - formData.depositAmount}€
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center pt-3 border-t border-white/5">
                    <span className="text-base font-bold text-gray-300">Total à percevoir</span>
                    <span className="text-2xl font-black text-lilas">
                      {formData.total}€
                    </span>
                  </div>
                )}
                
                <p className="text-[10px] text-gray-500 italic text-right">
                  {formData.deposit === 'Oui' 
                    ? "* Calculé sur le tarif total moins l'acompte" 
                    : "* Aucun acompte versé pour ce rendez-vous"}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 border-t-4 border-blue-500/50">
            <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center space-x-2 mb-4">
              <Mail size={12} />
              <span>Communication Client</span>
            </label>
            <button 
              onClick={handleSendPdf}
              disabled={emailStatus !== 'idle' || !appointment.clientEmail}
              className={`w-full py-3 border rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 disabled:opacity-80
                ${emailStatus === 'idle' ? 'bg-blue-500/10 hover:bg-blue-500 hover:text-white border-blue-500/20 text-blue-400' : ''}
                ${emailStatus === 'sending' ? 'bg-blue-500/20 border-blue-500/30 text-blue-300 cursor-wait' : ''}
                ${emailStatus === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : ''}
                ${emailStatus === 'error' ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' : ''}
              `}
            >
              {emailStatus === 'idle' && <Mail size={18} />}
              {emailStatus === 'sending' && <RefreshCw size={18} className="animate-spin" />}
              {emailStatus === 'success' && <Check size={18} />}
              {emailStatus === 'error' && <AlertCircle size={18} />}
              <span>
                {emailStatus === 'idle' && 'Envoi fiche de soins'}
                {emailStatus === 'sending' && 'Envoi en cours...'}
                {emailStatus === 'success' && 'Email envoyé !'}
                {emailStatus === 'error' && 'Erreur d\'envoi'}
              </span>
            </button>
          </div>

          

          <div className="glass-card p-6 bg-rose-500/5 border border-rose-500/10">
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving}
              className="w-full flex items-center justify-center space-x-2 text-rose-400 hover:text-rose-300 transition-colors py-2 disabled:opacity-50"
            >
              <Trash2 size={18} />
              <span className="font-medium">Annuler le rendez-vous</span>
            </button>
          </div>

          {/* Confirmation Modal */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative w-full max-w-md glass-card p-8 border-rose-500/20 bg-[#0A0A0B]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto mb-6">
                    <Trash2 size={32} />
                  </div>
                  
                  <h3 className="text-xl font-bold text-center mb-2">Annuler le rendez-vous ?</h3>
                  <p className="text-gray-400 text-center text-sm mb-8">
                    Cette action est irréversible. Toutes les données liées à ce rendez-vous seront définitivement supprimées.
                  </p>
                  
                  <div className="flex flex-col space-y-3">
                    <button
                      onClick={handleDelete}
                      disabled={saving}
                      className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50"
                    >
                      {saving ? "Suppression..." : "Confirmer la suppression"}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={saving}
                      className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-2xl transition-all border border-white/5"
                    >
                      Garder le rendez-vous
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

const DashboardView = ({ appointments, rules, loading, user, onSelectAppointment }: any) => {
  const [showAllAppointments, setShowAllAppointments] = useState(false);

  const getControlStatus = (appt: any) => {
    const style = (appt.style || "").trim();
    const deposit = appt.deposit || "Non";
    const total = parseFloat((appt.total || 0).toString());
    const orderForm = appt.orderForm || "Non édité";

    let baseStatus = "Validé";
    if (!style) {
      baseStatus = "A contrôler";
    } else if (style.toLowerCase() === "flash" || style.toLowerCase() === "projet perso") {
      const hasDeposit = deposit === "Oui" || deposit === "Dispensé";
      const hasTotal = total > 0;
      const isFree = total === 0;

      // Un dossier est "A contrôler" si ce n'est pas gratuit ET (pas d'acompte OU tarif <= 0)
      if (!isFree && (!hasDeposit || !hasTotal)) {
        baseStatus = "A contrôler";
      }
    }

    // Final mapping based on Order Form
    if (baseStatus === "A contrôler") {
      if (orderForm === "Non édité") {
        return { label: "A contrôler + BDC", color: "bg-rose-500/10 text-rose-400 border border-rose-500/20" };
      }
      return { label: "À contrôler", color: "bg-rose-500/10 text-rose-400 border border-rose-500/20" };
    }

    if (baseStatus === "Validé") {
      if (orderForm === "Non édité") {
        return { label: "Bon de commande à faire", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20" };
      }
      if (orderForm === "Édité" || orderForm === "Dispensé") {
        return { label: "Complété", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" };
      }
      return { label: "Validé", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" };
    }

    return { label: baseStatus, color: "bg-gray-500/10 text-gray-400 border border-gray-500/20" };
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
  
  const upcomingAppointments = appointments
    .filter((appt: any) => (appt.rawDate || 0) >= today)
    .sort((a: any, b: any) => a.rawDate - b.rawDate);

  const incompleteAppointments = upcomingAppointments.filter((appt: any) => 
    getControlStatus(appt).label !== "Complété"
  );

  // Extraire le prénom pour le message de bienvenue
  const firstName = user?.name ? user.name.split(' ')[0] : 'Florent';

  const displayedAppointments = showAllAppointments 
    ? upcomingAppointments 
    : upcomingAppointments.slice(0, 5);

  // Accounting stats for current month
  const monthEntries = appointments.filter((appt: any) => 
    (appt.rawDate || 0) >= startOfMonth && (appt.rawDate || 0) <= endOfMonth
  );

  const totalRevenue = monthEntries.reduce((acc: number, curr: any) => acc + (curr.total || 0), 0);
  const collected = monthEntries
    .filter((e: any) => (e.rawDate || 0) < today)
    .reduce((acc: number, curr: any) => acc + (curr.total || 0), 0);
  const upcoming = monthEntries
    .filter((e: any) => (e.rawDate || 0) >= today)
    .reduce((acc: number, curr: any) => acc + (curr.total || 0), 0);

  const calculateSalary = () => {
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const applicableRule = [...(rules || [])]
      .sort((a, b) => b.startMonth.localeCompare(a.startMonth))
      .find(r => r.startMonth <= monthKey);
    
    if (applicableRule) {
      return Math.round(totalRevenue - applicableRule.rent - (totalRevenue * applicableRule.rate));
    }
    return 0;
  };

  const salary = calculateSalary();

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-1">Bonjour, {firstName}</h2>
          <p className="text-gray-400 text-sm md:text-base">
            {loading ? "Chargement des données..." : `Vous avez ${upcomingAppointments.length} rendez-vous à venir.`}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10">
        {[
          { label: 'CA Prév. (Mois)', value: `${totalRevenue}€`, icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Encaissé', value: `${collected}€`, icon: CheckCircle2, color: 'text-purple-400' },
          { label: 'À venir', value: `${upcoming}€`, icon: Clock, color: 'text-blue-400' },
          { label: 'Salaire Est.', value: `${salary}€`, icon: Wallet, color: 'text-lilas' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-4 md:p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
                <stat.icon size={20} />
              </div>
            </div>
            <p className="text-gray-400 text-[10px] md:text-xs uppercase tracking-wider mb-1">{stat.label}</p>
            <h3 className="text-lg md:text-2xl font-bold">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {incompleteAppointments.length > 0 && (
        <section className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-1 h-6 bg-amber-500 rounded-full" />
              <h3 className="text-xl md:text-2xl font-bold tracking-tight text-amber-500">Dossiers à finaliser</h3>
            </div>
          </div>

          <div className="space-y-4">
            {incompleteAppointments.length > 0 ? (
              incompleteAppointments.map((appt: any, i: number) => (
                <motion.div 
                  key={appt.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => onSelectAppointment(appt)}
                  className="glass-card p-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_200px_120px_40px] items-center gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer group border-l-2 border-amber-500/30"
                >
                  <div className="flex items-center space-x-5">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-amber-500 font-bold text-lg border border-white/10 shrink-0">
                      {appt.client.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-lg group-hover:text-amber-500 transition-colors truncate">{appt.client}</h4>
                      <div className="flex items-center space-x-3 text-sm text-gray-400">
                        <span className="flex items-center space-x-1 shrink-0">
                          <Calendar size={14} />
                          <span>{appt.date || 'À définir'}</span>
                        </span>
                        <span className="flex items-center space-x-1 shrink-0">
                          <Clock size={14} />
                          <span>{appt.time || '14:00'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end text-right">
                    <p className="text-xs md:text-sm font-medium text-gray-400 leading-tight truncate w-full">{appt.style}</p>
                    <p className="text-sm md:text-lg font-bold text-amber-500 leading-tight">{appt.price}</p>
                  </div>
                  
                  <div className="hidden md:flex justify-center">
                    {(() => {
                      const status = getControlStatus(appt);
                      return (
                        <div className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${status.color}`}>
                          {status.label}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="hidden sm:flex justify-end">
                    <button className="p-2 text-gray-500 hover:text-white transition-colors">
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="glass-card p-8 text-center border-dashed border-white/5">
                <div className="flex flex-col items-center space-y-2 opacity-40">
                  <CheckCircle2 size={32} className="text-emerald-400" />
                  <p className="text-sm font-medium">Tous vos dossiers sont complétés !</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-1 h-6 bg-lilas rounded-full" />
            <h3 className="text-xl md:text-2xl font-bold tracking-tight">Prochains Rendez-vous</h3>
          </div>
          {upcomingAppointments.length > 5 && (
            <button 
              onClick={() => setShowAllAppointments(!showAllAppointments)}
              className="text-lilas text-sm font-medium hover:underline flex items-center space-x-1"
            >
              <span>{showAllAppointments ? 'Réduire' : 'Voir tout'}</span>
              {showAllAppointments ? <ChevronDown size={14} className="rotate-180" /> : <ChevronRight size={14} />}
            </button>
          )}
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-gray-500">
              <RefreshCw className="animate-spin mr-2" /> Chargement...
            </div>
          ) : upcomingAppointments.length === 0 ? (
            <div className="glass-card p-12 text-center text-gray-500">
              Aucun rendez-vous à venir trouvé.
            </div>
          ) : (
            displayedAppointments.map((appt: any, i: number) => (
              <motion.div 
                key={appt.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + (i * 0.1) }}
                onClick={() => onSelectAppointment(appt)}
                className="glass-card p-5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_200px_120px_40px] items-center gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-center space-x-5">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-lilas font-bold text-lg border border-white/10 shrink-0">
                    {appt.client.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-lg group-hover:text-lilas transition-colors truncate">{appt.client}</h4>
                    <div className="flex items-center space-x-3 text-sm text-gray-400">
                      <span className="flex items-center space-x-1 shrink-0">
                        <Calendar size={14} />
                        <span>{appt.date || 'À définir'}</span>
                      </span>
                      <span className="flex items-center space-x-1 shrink-0">
                        <Clock size={14} />
                        <span>{appt.time || '14:00'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end text-right">
                  <p className="text-xs md:text-sm font-medium text-gray-400 leading-tight truncate w-full">{appt.style}</p>
                  <p className="text-sm md:text-lg font-bold text-lilas leading-tight">{appt.price}</p>
                </div>
                
                <div className="hidden md:flex justify-center">
                  {(() => {
                    const status = getControlStatus(appt);
                    return (
                      <div className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${status.color}`}>
                        {status.label}
                      </div>
                    );
                  })()}
                </div>

                <div className="hidden sm:flex justify-end">
                  <button className="p-2 text-gray-500 hover:text-white transition-colors">
                    <MoreVertical size={20} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>
    </motion.div>
  );
};

const CalendarView = ({ appointments, timeOffEvents = [], onSelectAppointment, onCreateAppointment, onCreateTimeOff }: any) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const legend = [
    { label: 'Projet perso', color: 'bg-purple-500' },
    { label: 'Flash', color: 'bg-blue-500' },
    { label: 'Retouches', color: 'bg-emerald-500' },
    { label: 'RDV Préparatoire', color: 'bg-amber-500' },
    { label: 'Event', color: 'bg-fuchsia-500' },
    { label: 'Cadeau', color: 'bg-rose-500' },
    { label: 'Congé', color: 'bg-red-500' },
  ];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Helper to get color based on appointment type
  const getTypeColor = (type: string, client?: string) => {
    const t = (type || '').toLowerCase();
    const c = (client || '').toLowerCase();
    if (t.includes('timeoff') || t.includes('congé') || t.includes('indisponibilité') || c.includes('congé')) return { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/50' };
    if (t.includes('projet perso')) return { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500/50' };
    if (t.includes('flash')) return { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/50' };
    if (t.includes('retouche')) return { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/50' };
    if (t.includes('préparatoire')) return { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/50' };
    if (t.includes('event')) return { bg: 'bg-fuchsia-500', text: 'text-fuchsia-400', border: 'border-fuchsia-500/50' };
    if (t.includes('cadeau')) return { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500/50' };
    return { bg: 'bg-lilas', text: 'text-lilas', border: 'border-lilas/50' };
  };

  // Premier jour du mois
  const firstDayOfMonth = new Date(year, month, 1);
  // Nombre de jours dans le mois
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Jour de la semaine du premier jour (0=Dim, 1=Lun...)
  // On ajuste pour que Lun=0, Dim=6
  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  // Calculer les jours de la semaine en cours
  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Ajuster pour que la semaine commence le lundi
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

  // Filtrer les rendez-vous pour le mois en cours
  const monthAppointments = appointments.filter((appt: any) => {
    const d = new Date(appt.rawDate);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const monthTimeOff = timeOffEvents.filter((event: any) => {
    const d = new Date(event.start);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Rendez-vous pour le jour sélectionné
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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      className="min-h-full flex flex-col pb-20 md:pb-0"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">
            {viewMode === 'month' ? (
              `${monthNames[month]} ${year}`
            ) : (
              `Semaine du ${currentWeekDays[0].getDate()} ${monthNames[currentWeekDays[0].getMonth()]}`
            )}
          </h2>
          <p className="text-gray-400 text-sm md:text-base">Planning de Larabstrait</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 w-full md:w-auto">
          {/* Legend - Desktop only */}
          <div className="hidden xl:flex items-center space-x-4 mr-4 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
            {legend.map((item) => (
              <div key={item.label} className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between sm:justify-start space-x-2 bg-card-bg border border-white/5 p-1 rounded-xl">
            <button 
              onClick={prev}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-2 text-gray-400 hover:text-white rounded-lg font-medium text-xs sm:text-sm"
            >
              Aujourd'hui
            </button>
            <button 
              onClick={next}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="flex items-center justify-center space-x-2 bg-card-bg border border-white/5 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('month')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${viewMode === 'month' ? 'bg-lilas text-black' : 'text-gray-400 hover:text-white'}`}
            >
              Mois
            </button>
            <button 
              onClick={() => setViewMode('week')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${viewMode === 'week' ? 'bg-lilas text-black' : 'text-gray-400 hover:text-white'}`}
            >
              Semaine
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
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
                  {/* Empty cells for padding */}
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
                          {isToday && (
                            <div className="w-1 h-1 rounded-full bg-lilas shadow-[0_0_5px_rgba(209,179,255,1)]" />
                          )}
                        </div>
                        
                        <div className="mt-auto flex flex-wrap gap-1 justify-center sm:justify-start">
                          {dayAppts.slice(0, 4).map((appt: any, idx: number) => {
                            const colors = getTypeColor(appt.style, appt.client);
                            return (
                              <div 
                                key={`appt-${idx}`} 
                                className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${colors.bg} shadow-sm`}
                                title={appt.client}
                              ></div>
                            );
                          })}
                          {dayTimeOff.slice(0, 2).map((off: any, idx: number) => (
                            <div 
                              key={`off-${idx}`} 
                              className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500 shadow-sm`}
                              title={off.title}
                            ></div>
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
                          <div key={`off-${idx}`} className="p-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[9px] text-red-400 font-bold">
                            {off.title}
                          </div>
                        ))}
                        {dayAppts.map((appt: any, idx: number) => {
                          const colors = getTypeColor(appt.style, appt.client);
                          return (
                            <div 
                              key={`appt-${idx}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectAppointment(appt);
                              }}
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

        {/* Day Details Side Panel */}
        <div className="glass-card p-5 md:p-6 flex flex-col border-lilas/10">
          <div className="flex items-center justify-between mb-8">
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
          
          <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[300px]">
            {selectedDayTimeOff.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest px-1">Indisponibilités</p>
                {selectedDayTimeOff.map((off: any) => (
                  <div key={off.id} className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-400">{off.title}</p>
                      <p className="text-[10px] text-red-400/60 font-medium">
                        {new Date(off.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {new Date(off.end).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
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
                      <div className="flex -space-x-1">
                        {appt.hasDeposit && (
                          <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30" title="Acompte payé">
                            <CheckCircle2 size={10} className="text-emerald-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12 opacity-20">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                  <Calendar size={32} />
                </div>
                <p className="text-sm font-medium italic">Journée libre</p>
              </div>
            )}
          </div>

          <button 
            onClick={() => onCreateTimeOff && onCreateTimeOff()}
            className="w-full mt-8 py-4 bg-white/5 text-gray-300 hover:bg-white/10 rounded-2xl text-sm font-bold transition-all flex items-center justify-center space-x-2 border border-white/5"
          >
            <Plane size={20} />
            <span>Poser un congé</span>
          </button>

          <button 
            onClick={() => onCreateAppointment && onCreateAppointment()}
            className="w-full mt-4 py-4 bg-lilas text-black hover:bg-lilas/90 rounded-2xl text-sm font-bold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-lilas/10"
          >
            <Plus size={20} />
            <span>Nouveau rendez-vous</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};


const AccountingView = ({ appointments, rules, loading }: any) => {
  const [filterMode, setFilterMode] = useState('this_month'); 
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  
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

  // Dynamic Chart Data
  const chartData = useMemo(() => {
    const months = [];
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = monthNames[d.getMonth()];
      
      const monthRevenue = appointments
        .filter((appt: any) => {
          const apptDate = new Date(appt.rawDate);
          const apptMonthKey = `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, '0')}`;
          return apptMonthKey === monthKey;
        })
        .reduce((sum: number, appt: any) => sum + (appt.total || 0), 0);

      months.push({
        month: monthName,
        revenue: monthRevenue,
        expenses: Math.round(monthRevenue * 0.25) // Estimated expenses for visual
      });
    }
    return months;
  }, [appointments]);

  // On transforme les rendez-vous en entrées comptables
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
      case 'this_month_past':
        return entry.rawDate >= startOfMonth && entry.rawDate < today;
      case 'this_month':
        return entry.rawDate >= startOfMonth && entry.rawDate <= endOfMonth;
      case 'last_month':
        return entry.rawDate >= startOfLastMonth && entry.rawDate <= endOfLastMonth;
      case 'upcoming':
        return entry.rawDate >= today;
      case 'last_3_months':
        return entry.rawDate >= threeMonthsAgo && entry.rawDate <= now.getTime();
      case 'this_year':
        return entry.rawDate >= startOfYear && entry.rawDate <= endOfYear;
      case 'last_year':
        return entry.rawDate >= startOfLastYear && entry.rawDate <= endOfLastYear;
      case 'all':
        return true;
      default:
        return true;
    }
  });

  const finalEntries = filteredEntries.filter((entry: any) => 
    entry.total > 0
  );

  const totalRevenue = finalEntries.reduce((acc: number, curr: any) => acc + curr.total, 0);
  const collected = finalEntries
    .filter((e: any) => e.rawDate < today)
    .reduce((acc: number, curr: any) => acc + curr.total, 0);
  const upcoming = finalEntries
    .filter((e: any) => e.rawDate >= today)
    .reduce((acc: number, curr: any) => acc + curr.total, 0);

  // Calcul du Salaire
  const calculateSalary = () => {
    // On groupe les entrées par mois
    const entriesByMonth: { [key: string]: number } = {};
    finalEntries.forEach(entry => {
      const d = new Date(entry.rawDate);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      entriesByMonth[monthKey] = (entriesByMonth[monthKey] || 0) + entry.total;
    });

    // Si on est en mode "Tout le mois" ou "Passés" et qu'il n'y a pas d'entrées, 
    // on doit quand même considérer le mois en cours pour le loyer
    if (filterMode === 'this_month' || filterMode === 'this_month_past') {
      const d = new Date();
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!entriesByMonth[monthKey]) entriesByMonth[monthKey] = 0;
    }

    let totalSalary = 0;
    Object.entries(entriesByMonth).forEach(([monthKey, revenue]) => {
      // Trouver la règle applicable (la plus récente qui est <= monthKey)
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
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
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4"
        >
          <div className="flex flex-col space-y-1 w-full sm:w-auto">
            <label className="text-[10px] uppercase text-gray-500 font-bold">Date de début</label>
            <input 
              type="date" 
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none text-gray-300 w-full"
            />
          </div>
          <div className="flex flex-col space-y-1 w-full sm:w-auto">
            <label className="text-[10px] uppercase text-gray-500 font-bold">Date de fin</label>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none text-gray-300 w-full"
            />
          </div>
          <button 
            onClick={() => setDateRange({ start: '', end: '' })}
            className="sm:mt-5 text-xs text-gray-500 hover:text-white"
          >
            Réinitialiser
          </button>
        </motion.div>
      )}

      {/* Stats Grid */}
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

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6">
        <div className="glass-card p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg">Évolution des Revenus</h3>
            <select className="bg-transparent border-none text-sm text-gray-400 focus:ring-0 cursor-pointer">
              <option>6 derniers mois</option>
              <option>Cette année</option>
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
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={true} />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => `${value}€`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#d4af37' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#d4af37" 
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#d4af37', strokeWidth: 2, stroke: '#141414' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                >
                  <LabelList 
                    dataKey="revenue" 
                    position="top" 
                    offset={15} 
                    fill="#d4af37" 
                    fontSize={10} 
                    formatter={(value: number) => `${value}€`}
                  />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table Section */}
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

const ClientsView = ({ clients, appointments, onSelectAppointment, apiFetch }: any) => {
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [sortBy, setSortBy] = useState('alpha');

  // --- LOGIQUE ABBY ---
  const [clientDocuments, setClientDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (!apiFetch) return;
      try {
        const res = await apiFetch('/api/settings/abby');
        if (res.ok) {
          const data = await res.json();
          setHasApiKey(!!data.abby_api_key);
        }
      } catch (err) {
        console.error("Erreur check clé Abby:", err);
      }
    };
    checkKey();
  }, [apiFetch]);

  useEffect(() => {
    const fetchClientDocuments = async () => {
      if (!hasApiKey || !selectedClient || !apiFetch) return;
      setLoadingDocs(true);
      try {
        const res = await apiFetch('/api/abby/documents');
        if (res.ok) {
          const allDocs = await res.json();
          // On reconstruit le nom complet du client pour faire la recherche
          const clientName = (selectedClient.displayName || `${selectedClient.firstName || ''} ${selectedClient.lastName || ''}`).toLowerCase().trim();
          
          const matchingDocs = allDocs.filter((doc: any) => {
            if (!doc || !doc.client) return false;
            // On vérifie si le nom du client est inclus, c'est plus souple
            return doc.client.toLowerCase().includes(clientName) || clientName.includes(doc.client.toLowerCase());
          });
          setClientDocuments(matchingDocs);
        }
      } catch (err) {
        console.error("Erreur fetch documents:", err);
      } finally {
        setLoadingDocs(false);
      }
    };
    fetchClientDocuments();
  }, [hasApiKey, selectedClient, apiFetch]);

  const handleDownloadPDF = async (inv: any) => {
    if (!apiFetch) return;
    try {
      const res = await apiFetch(`/api/abby/documents/${inv.internalId}/pdf`);
      if (!res.ok) throw new Error("Erreur");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.type}_${inv.id}.pdf`; 
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) { alert("Impossible de télécharger le PDF."); }
  };

  const handlePreviewPDF = async (inv: any) => {
    if (!apiFetch) return;
    try {
      const res = await apiFetch(`/api/abby/documents/${inv.internalId}/pdf?inline=true`);
      if (!res.ok) throw new Error("Erreur");
      const blob = await res.blob();
      const file = new Blob([blob], { type: 'application/pdf' });
      const url = URL.createObjectURL(file);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) { alert("Impossible de prévisualiser le PDF."); }
  };
  // --- FIN LOGIQUE ABBY ---

  const clientsWithStats = useMemo(() => {
    return clients.map((client: any) => {
      const clientAppts = appointments.filter((appt: any) => {
        if (appt.isTimeOff) return false;
        const apptEmail = (appt.clientEmail || "").toLowerCase().trim();
        const clientEmail = (client.email || "").toLowerCase().trim();
        if (clientEmail && apptEmail && apptEmail === clientEmail) return true;
        if (!clientEmail && !apptEmail) {
          const apptName = (appt.client || "").toLowerCase().trim();
          const clientName = (client.displayName || client.firstName || "").toLowerCase().trim();
          return apptName && apptName === clientName;
        }
        return false;
      });

      const totalSpent = clientAppts.reduce((sum: number, appt: any) => {
        const amount = typeof appt.total === 'number' ? appt.total : parseFloat(String(appt.total || appt.price || 0).replace(/[^\d.-]/g, '')) || 0;
        return sum + amount;
      }, 0);
      
      return { ...client, appointmentCount: clientAppts.length, totalSpent };
    });
  }, [clients, appointments]);

  const sortedClients = useMemo(() => {
    const list = [...clientsWithStats];
    if (sortBy === 'alpha') return list.sort((a, b) => (a.displayName || a.firstName || "").localeCompare(b.displayName || b.firstName || ""));
    if (sortBy === 'appointments') return list.sort((a, b) => b.appointmentCount - a.appointmentCount);
    if (sortBy === 'spending') return list.sort((a, b) => b.totalSpent - a.totalSpent);
    return list;
  }, [clientsWithStats, sortBy]);

  if (selectedClient) {
    const clientAppointments = appointments.filter((appt: any) => {
      if (appt.isTimeOff) return false;
      const apptEmail = (appt.clientEmail || "").toLowerCase().trim();
      const clientEmail = (selectedClient.email || "").toLowerCase().trim();
      if (clientEmail && apptEmail && apptEmail === clientEmail) return true;
      if (!clientEmail && !apptEmail) {
        const apptName = (appt.client || "").toLowerCase().trim();
        const clientName = (selectedClient.displayName || selectedClient.firstName || "").toLowerCase().trim();
        return apptName && apptName === clientName;
      }
      return false;
    });

    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }} 
        animate={{ opacity: 1, x: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setSelectedClient(null)}
            className="p-2 hover:bg-white/5 rounded-xl transition-all text-gray-400 hover:text-white"
          >
            <ChevronRight size={24} className="rotate-180" />
          </button>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">{selectedClient.firstName} {selectedClient.lastName}</h2>
            <p className="text-gray-400 text-sm md:text-base">{selectedClient.email}</p>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-white/5">
            <h3 className="font-bold text-lg">Historique des rendez-vous</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="p-4 text-xs font-bold uppercase text-gray-500">Date</th>
                  <th className="p-4 text-xs font-bold uppercase text-gray-500">Style / Projet</th>
                  <th className="p-4 text-xs font-bold uppercase text-gray-500">Statut</th>
                  <th className="p-4 text-xs font-bold uppercase text-gray-500 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {clientAppointments.length > 0 ? (
                  clientAppointments.map((appt: any) => (
                    <tr 
                      key={appt.id} 
                      onClick={() => onSelectAppointment(appt)}
                      className="border-b border-white/5 hover:bg-white/[0.05] transition-colors cursor-pointer group"
                    >
                      <td className="p-4 text-sm group-hover:text-lilas transition-colors">{appt.date}</td>
                      <td className="p-4 text-sm">{appt.style}</td>
                      <td className="p-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          appt.status === 'Confirmé' || appt.status === 'Payé'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-purple-500/10 text-purple-400'
                        }`}>
                          {appt.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-bold text-right text-lilas">
                        {typeof appt.total === 'number' ? `${appt.total}€` : appt.price}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-gray-500 italic">
                      Aucun rendez-vous trouvé pour ce client.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* NOUVELLE ZONE : DOCUMENTS ABBY */}
        {hasApiKey && (
          <div className="glass-card overflow-hidden mt-6">
            <div className="p-6 border-b border-white/5 flex items-center space-x-2">
              <FileText size={20} className="text-lilas" />
              <h3 className="font-bold text-lg">Documents comptables (Abby)</h3>
            </div>
            
            <div className="p-6">
              {loadingDocs ? (
                <div className="text-sm text-gray-400 flex items-center justify-center py-4">
                  <RefreshCw size={16} className="animate-spin mr-2" /> Chargement des documents...
                </div>
              ) : clientDocuments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clientDocuments.map((inv: any) => (
                    <div key={inv.id} className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-between group">
                      <div>
                        <div className="flex items-center space-x-3 mb-1">
                          <span className="font-bold text-sm">{inv.type} {inv.id}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                            inv.status === 'sent' ? 'bg-blue-500/10 text-blue-400' :
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {inv.statusLabel || 'Brouillon'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {inv.date} • <span className="font-bold text-white">{inv.amount}€</span>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleDownloadPDF(inv)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" title="Télécharger">
                          <Download size={16} />
                        </button>
                        <button onClick={() => handlePreviewPDF(inv)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" title="Aperçu">
                          <Eye size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500 italic">Aucun document Abby trouvé pour ce client.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold">Fiches clients</h2>
        <div className="flex items-center space-x-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <Filter size={18} className="text-gray-400" />
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer outline-none"
          >
            <option value="alpha" className="bg-[#141414]">Ordre Alphabétique</option>
            <option value="appointments" className="bg-[#141414]">Le plus de Rendez-vous</option>
            <option value="spending" className="bg-[#141414]">Le plus de dépenses</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedClients.map((client: any) => (
          <motion.div 
            key={client.id} 
            whileHover={{ y: -4 }}
            onClick={() => setSelectedClient(client)}
            className="glass-card p-6 cursor-pointer hover:border-lilas/30 transition-all group flex flex-col justify-between"
          >
            <div>
              <h4 className="font-bold text-lg group-hover:text-lilas transition-colors">{client.displayName || `${client.firstName} ${client.lastName}`}</h4>
              <p className="text-gray-400 text-sm truncate">{client.email}</p>
            </div>
            <div className="flex justify-between items-end mt-6 pt-4 border-t border-white/5">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Rendez-vous</span>
                <span className="text-lg font-bold text-white">{client.appointmentCount}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Total dépensé</span>
                <span className="text-lg font-bold text-lilas">{client.totalSpent.toLocaleString()}€</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

const LoginView = ({ onLoginSuccess, apiFetch, isAuthenticated }: { onLoginSuccess: () => Promise<void>, apiFetch: any, isAuthenticated: boolean }) => {
  const [isIframe, setIsIframe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasClickedLogin, setHasClickedLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserCanWriteCookie, setBrowserCanWriteCookie] = useState<boolean | null>(null);
  const [isCheckingCookies, setIsCheckingCookies] = useState(true);

  useEffect(() => {
    const checkCookies = async () => {
      let canWrite = false;
      try {
        const testCookie = "test_cookie=" + Date.now() + "; SameSite=None; Secure; path=/";
        document.cookie = testCookie;
        canWrite = document.cookie.includes("test_cookie");
      } catch (e) {}
      
      setBrowserCanWriteCookie(canWrite);
      setIsCheckingCookies(false);
    };
    checkCookies();
  }, []);

  useEffect(() => {
    setIsIframe(window.self !== window.top);
    
    const handleMessage = async (event: MessageEvent) => {
      console.log("Message reçu dans App:", event.data?.type);
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const token = event.data.token;
        if (token) {
          console.log("Token reçu via postMessage:", token.substring(0, 5) + "...");
          localStorage.setItem('larabstrait_token', token);
        }
        setLoading(true);
        await onLoginSuccess();
        setLoading(false);
      }
    };

    // Support BroadcastChannel pour une communication plus fiable entre onglets/iframes du même domaine
    let bc: any = null;
    try {
      bc = new BroadcastChannel('larabstrait_auth');
      bc.onmessage = async (event: any) => {
        console.log("Message reçu via BroadcastChannel:", event.data?.type);
        if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
          if (event.data.token) {
            localStorage.setItem('larabstrait_token', event.data.token);
          }
          setLoading(true);
          await onLoginSuccess();
          setLoading(false);
        }
      };
    } catch (e) { console.warn("BroadcastChannel non supporté"); }

    // Backup: Écouter les changements de localStorage pour détecter la connexion réussie
    const handleStorage = async (event: StorageEvent) => {
      if (event.key === 'msal_login_success') {
        console.log("Connexion détectée via localStorage");
        setLoading(true);
        await onLoginSuccess();
        setLoading(false);
        localStorage.removeItem('msal_login_success');
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
    };
  }, [onLoginSuccess]);

  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('larabstrait_test', '1');
      localStorage.removeItem('larabstrait_test');
    } catch (e) {
      setStorageError(true);
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      setHasClickedLogin(true);
      // On passe l'origine actuelle au serveur pour qu'il construise la bonne URL de redirection
      const response = await fetch(`/api/auth/url?origin=${encodeURIComponent(window.location.origin)}`);
      if (!response.ok) throw new Error('Impossible de récupérer l\'URL d\'authentification');
      const { url } = await response.json();
      
      window.open(url, 'microsoft_login', 'width=600,height=700');
      
      // Sécurité : Vérifier périodiquement le statut si le postMessage échoue
      const checkInterval = setInterval(async () => {
        // 1. Vérifier si un token est apparu dans localStorage (posé par le popup)
        const token = localStorage.getItem('larabstrait_token');
        if (token) {
          console.log("Token détecté via polling localStorage");
          clearInterval(checkInterval);
          await onLoginSuccess();
          setLoading(false);
          return;
        }

        // 2. Vérifier le statut via l'API (fallback classique)
        try {
          const res = await apiFetch('/api/auth/status');
          const data = await res.json();
          if (data.isAuthenticated) {
            clearInterval(checkInterval);
            await onLoginSuccess();
            setLoading(false);
          }
        } catch (e) { /* ignore */ }
      }, 1000);

      // Arrêter le check après 2 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        setLoading(false);
      }, 120000);
      
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full glass-card p-10 text-center space-y-8"
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="w-20 h-20 bg-lilas rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(209,179,255,0.3)]">
            <span className="text-black font-bold text-4xl">LA</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Larabstrait</h1>
            <p className="text-gray-400 mt-2">Studio de Tatouage Privé</p>
          </div>
        </div>

        {!isCheckingCookies && browserCanWriteCookie === false && isIframe && (
          <div className="p-6 bg-orange-500/20 border-2 border-orange-500 rounded-2xl text-orange-200 text-sm space-y-4 shadow-[0_0_20px_rgba(249,115,22,0.2)]">
            <div className="flex items-center justify-center space-x-2 font-bold text-lg">
              <AlertTriangle className="text-orange-500" />
              <span>Action Requise</span>
            </div>
            <p>
              Votre navigateur bloque les cookies de connexion dans cet aperçu. 
              <strong> La connexion Microsoft ne peut pas fonctionner ici.</strong>
            </p>
            <a 
              href={window.location.href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors text-center shadow-lg"
            >
              Ouvrir l'application en plein écran
            </a>
            <p className="text-[10px] opacity-70 italic text-center">
              Une fois ouvert dans un nouvel onglet, la connexion fonctionnera normalement.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {isIframe && (
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 text-xs">
              <p className="font-bold mb-1">Utilisateur iPhone/iPad ?</p>
              Pour une expérience optimale et éviter les blocages de connexion, ouvrez l'application directement.
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block mt-2 text-purple-300 underline font-medium"
              >
                Ouvrir dans un nouvel onglet
              </a>
            </div>
          )}

          <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-sm text-gray-400">
            Cette application est réservée aux membres du tenant Microsoft autorisé.
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
              {error}
            </div>
          )}

            {hasClickedLogin ? (
              <div className="space-y-4">
                <div className="p-4 bg-lilas/10 border border-lilas/20 rounded-2xl">
                  <div className="flex items-center justify-center space-x-3 text-lilas mb-2">
                    <div className="w-5 h-5 border-2 border-lilas/20 border-t-lilas rounded-full animate-spin" />
                    <span className="font-medium text-sm">En attente de connexion...</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Une fenêtre de connexion s'est ouverte. Connectez-vous pour continuer.
                  </p>
                </div>
                
                <button
                  onClick={async () => { 
                    if (loading) return;
                    setLoading(true); 
                    setError(null);
                    try {
                      const success = await (onLoginSuccess() as any);
                      if (!success) {
                        setError("La connexion n'a pas pu être vérifiée. Assurez-vous d'avoir terminé l'étape précédente dans le popup.");
                      }
                    } catch (e) {
                      setError("Erreur de communication avec le serveur. Veuillez réessayer.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="w-full bg-lilas hover:bg-lilas/90 text-black font-bold py-4 px-8 rounded-2xl transition-all flex items-center justify-center space-x-3 shadow-lg disabled:opacity-70"
                  disabled={loading}
                >
                  {loading ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : (
                    <RefreshCw size={20} />
                  )}
                  <span>{loading ? "Vérification..." : "J'ai terminé la connexion"}</span>
                </button>
                
                <button
                  onClick={() => setHasClickedLogin(false)}
                  className="text-xs text-gray-500 hover:text-gray-400 underline"
                >
                  Réessayer la connexion
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <button 
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full btn-primary py-4 flex items-center justify-center space-x-3 text-lg group disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="animate-spin" size={24} />
                  ) : (
                    <LayoutDashboard size={24} className="group-hover:scale-110 transition-transform" />
                  )}
                  <span>Connexion Microsoft</span>
                </button>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/5 space-y-2">
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-2 text-gray-500 hover:text-white text-xs transition-colors"
            >
              Actualiser la page
            </button>
          </div>

          <p className="text-[10px] text-gray-600 uppercase tracking-widest">
            Sécurité Entra ID Activée
          </p>
        </motion.div>
      </div>
    );
  };

const CreateAppointmentView = ({ clients, onBack, onCreated, apiFetch }: any) => {
  const [isNewClient, setIsNewClient] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '',
    newClientName: '',
    newClientEmail: '',
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    style: 'Flash',
    total: 0,
    deposit: 'Non',
    depositAmount: 0,
    orderForm: 'Non édité',
    location: '',
    projectRecap: '',
    size: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateDefaultDeposit = (total: number) => {
    const t = parseFloat(total.toString());
    if (t === 0) return 0;
    if (t < 200) return 50;
    return t * 0.25;
  };

  const handleTotalChange = (val: string) => {
    const total = val === '' ? 0 : parseFloat(val);
    const depositAmount = calculateDefaultDeposit(total);
    setFormData({
      ...formData,
      total,
      depositAmount
    });
  };

  const handleCreate = async () => {
    if (isNewClient && !formData.newClientName) {
      setError("Veuillez saisir le nom du nouveau client");
      return;
    }
    if (!isNewClient && !formData.clientId) {
      setError("Veuillez sélectionner un client");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let clientName = '';
      let clientEmail = '';

      if (isNewClient) {
        clientName = formData.newClientName;
        clientEmail = formData.newClientEmail;
      } else {
        const selectedClient = clients.find((c: any) => c.id === formData.clientId);
        clientName = selectedClient?.displayName || '';
        clientEmail = selectedClient?.email || '';
      }

      const dateTime = new Date(`${formData.date}T${formData.time}`);
      
      const orderFormIds: Record<string, number> = {
        "Édité": 129690000,
        "Non édité": 129690001,
        "Dispensé": 129690002
      };

      const depositIds: Record<string, number> = {
        "Oui": 129690000,
        "Non": 129690001,
        "Dispensé": 129690002
      };

      const styleIds: Record<string, number> = {
        "Flash": 129690000,
        "Projet perso": 129690001,
        "Retouches": 129690002,
        "RDV Préparatoire": 129690003,
        "Event": 129690004,
        "Cadeau": 129690005
      };

      const createPayload: any = {
        cr7e0_nomclient: clientName,
        cr7e0_email: clientEmail,
        cr7e0_daterdv: dateTime.toISOString(),
        cr7e0_tariftattoo: parseFloat(formData.total.toString()),
        cr7e0_acompte: (depositIds[formData.deposit] || 129690001).toString(),
        cr7e0_montantacompte: parseFloat(formData.depositAmount.toString()),
        cr7e0_typederdv: (styleIds[formData.style] || 129690000).toString(),
        cr7e0_boncommande: (orderFormIds[formData.orderForm] || 129690001).toString(),
        cr7e0_emplacement: formData.location,
        cr7e0_recapitulatifprojet: formData.projectRecap,
        cr7e0_taille: formData.size
      };

      const response = await apiFetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la création du rendez-vous");
      }

      onCreated();
    } catch (err: any) {
      console.error("Erreur création:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Retour</span>
        </button>
        
        <button 
          onClick={handleCreate}
          disabled={saving}
          className="px-6 py-2 bg-lilas text-black rounded-xl text-sm font-bold transition-all flex items-center space-x-2 disabled:opacity-50"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
          <span>{saving ? 'Création...' : 'Créer le rendez-vous'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex items-center space-x-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="glass-card p-8">
        <h2 className="text-2xl font-bold mb-6">Nouveau Rendez-vous</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Client</label>
                <button 
                  onClick={() => setIsNewClient(!isNewClient)}
                  className="text-[10px] text-lilas hover:underline font-bold uppercase"
                >
                  {isNewClient ? "Choisir un client existant" : "+ Nouveau client"}
                </button>
              </div>

              {isNewClient ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <input 
                      type="text" 
                      placeholder="Nom complet du client"
                      value={formData.newClientName}
                      onChange={(e) => setFormData({...formData, newClientName: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <input 
                      type="email" 
                      placeholder="Email (optionnel)"
                      value={formData.newClientEmail}
                      onChange={(e) => setFormData({...formData, newClientEmail: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
                    />
                  </div>
                </div>
              ) : (
                <select 
                  value={formData.clientId}
                  onChange={(e) => setFormData({...formData, clientId: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all appearance-none"
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map((client: any) => (
                    <option key={client.id} value={client.id}>{client.displayName}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Date</label>
                <input 
                  type="date" 
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Heure</label>
                <input 
                  type="time" 
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Type de projet</label>
              <select 
                value={formData.style}
                onChange={(e) => setFormData({...formData, style: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all appearance-none"
              >
                <option value="Flash">Flash</option>
                <option value="Projet perso">Projet perso</option>
                <option value="Retouches">Retouches</option>
                <option value="RDV Préparatoire">RDV Préparatoire</option>
                <option value="Event">Event</option>
                <option value="Cadeau">Cadeau</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Emplacement</label>
                <input 
                  type="text" 
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
                  placeholder="Ex: Bras"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Taille</label>
                <input 
                  type="text" 
                  value={formData.size}
                  onChange={(e) => setFormData({...formData, size: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
                  placeholder="Ex: 10cm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Récap Projet</label>
              <textarea 
                value={formData.projectRecap}
                onChange={(e) => setFormData({...formData, projectRecap: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all min-h-[80px]"
                placeholder="Détails du projet..."
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Tarif Total (€)</label>
              <input 
                type="number" 
                value={formData.total || ''}
                onChange={(e) => handleTotalChange(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Acompte</label>
                <select 
                  value={formData.deposit}
                  onChange={(e) => setFormData({...formData, deposit: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all appearance-none"
                >
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                  <option value="Dispensé">Dispensé</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Montant Acompte (€)</label>
                <input 
                  type="number" 
                  value={formData.depositAmount}
                  onChange={(e) => setFormData({...formData, depositAmount: parseFloat(e.target.value) || 0})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Bon de commande</label>
              <select 
                value={formData.orderForm}
                onChange={(e) => setFormData({...formData, orderForm: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all appearance-none"
              >
                <option value="Non édité">Non édité</option>
                <option value="Édité">Édité</option>
                <option value="Dispensé">Dispensé</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const CreateTimeOffView = ({ onBack, onCreated, apiFetch }: any) => {
  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!formData.startDate || !formData.endDate || !formData.reason) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      
      if (end < start) {
        throw new Error("La date de fin doit être après la date de début");
      }

      // On crée un enregistrement par jour pour que ça apparaisse bien dans le calendrier
      const days = [];
      let current = new Date(start);
      while (current <= end) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }

      const promises = days.map(date => {
        // On force l'heure à midi pour éviter les décalages de fuseau horaire
        const safeDate = new Date(date);
        safeDate.setHours(12, 0, 0, 0);

        const payload = {
          cr7e0_nomclient: `CONGÉ: ${formData.reason}`,
          cr7e0_email: 'conge@larabstrait.fr',
          cr7e0_daterdv: safeDate.toISOString(), // Utilise la date "sécurisée"
          cr7e0_tariftattoo: 0,
          cr7e0_acompte: "129690002",
          cr7e0_montantacompte: 0,
          cr7e0_typederdv: "129690005",
          cr7e0_boncommande: "129690002"
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
        throw new Error(data.error || "Erreur lors de la création d'un des jours de congé");
      }

      onCreated();
    } catch (err: any) {
      console.error("Erreur création congés:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl transition-all">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold">Poser un congés</h2>
        </div>
        <button 
          onClick={handleSubmit}
          disabled={saving}
          className="btn-primary flex items-center space-x-2"
        >
          {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
          <span>{saving ? "Enregistrement..." : "Enregistrer"}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex items-center space-x-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-card p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Motif du congé</label>
              <input 
                type="text" 
                placeholder="Ex: Vacances, Salon, Perso..."
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Date de début</label>
                <input 
                  type="date" 
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Date de fin</label>
                <input 
                  type="date" 
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-lilas/50 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="hidden md:block">
          <div className="glass-card p-8 h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <div className="w-20 h-20 rounded-3xl bg-lilas/10 flex items-center justify-center text-lilas">
              <Plane size={40} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Bloquer l'agenda</h3>
              <p className="text-sm text-gray-400 max-w-[200px] mx-auto">
                Les jours sélectionnés apparaîtront en rouge dans votre planning pour indiquer votre indisponibilité.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
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

  // Helper pour convertir la clé VAPID
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Enregistrement du Service Worker et vérification de l'abonnement
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsPushSupported(true);
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker enregistré:', registration);
          return registration.pushManager.getSubscription();
        })
        .then(subscription => {
          setPushSubscription(subscription);
        })
        .catch(err => console.error('Erreur SW:', err));
    }
  }, []);

  const subscribeToPush = async () => {
    try {
      // Demander explicitement la permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert("La permission pour les notifications a été refusée. Si vous êtes sur ordinateur, vérifiez les paramètres de votre navigateur. Si vous êtes dans l'aperçu AI Studio, essayez d'ouvrir l'application dans un nouvel onglet.");
        return false;
      }

      const response = await apiFetch('/api/notifications/vapid-public-key');
      const { publicKey } = await response.json();
      
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
      
      await apiFetch('/api/notifications/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription),
        headers: { 'Content-Type': 'application/json' }
      });
      
      setPushSubscription(subscription);
      return true;
    } catch (error: any) {
      console.error('Erreur abonnement push:', error);
      if (error.name === 'NotAllowedError' || error.message?.includes('permission denied')) {
        alert("L'accès aux notifications est bloqué par votre navigateur. Cela arrive souvent quand l'application est ouverte dans un cadre (iframe). Veuillez ouvrir l'application dans un nouvel onglet pour activer les notifications.");
      } else {
        alert("Une erreur est survenue lors de l'activation des notifications : " + error.message);
      }
      return false;
    }
  };

  const unsubscribeFromPush = async () => {
    if (pushSubscription) {
      await pushSubscription.unsubscribe();
      setPushSubscription(null);
    }
  };

  const sendTestNotification = async () => {
    try {
      const res = await apiFetch('/api/notifications/send-test', { method: 'POST' });
      if (res.ok) {
        alert("Notification de test envoyée ! Elle devrait apparaître d'ici quelques secondes.");
      } else {
        const data = await res.json();
        alert("Erreur lors de l'envoi du test : " + (data.error || "Erreur inconnue"));
      }
    } catch (error: any) {
      alert("Erreur réseau lors de l'envoi du test : " + error.message);
    }
  };

  // Helper pour les appels API avec token
  const apiFetch = async (url: string, options: any = {}) => {
    const token = localStorage.getItem('larabstrait_token');
    const isIframe = window.self !== window.top;
    
    const headers = {
      ...options.headers,
      'Authorization': token ? `Bearer ${token}` : '',
      'X-Dev-Bypass': isIframe ? 'true' : 'false'
    };
    
    // Timeout de 10 secondes pour éviter les blocages infinis
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(url, { 
        ...options, 
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  };

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

  const fetchData = async (isBackground = false) => {
    if (!isAuthenticated) return;
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const [apptsRes, timeOffRes] = await Promise.all([
        apiFetch('/api/appointments'),
        apiFetch('/api/bookings/timeoff').catch(() => ({ ok: false, json: () => Promise.resolve([]) }))
      ]);

      if (apptsRes.status === 401) {
        setIsAuthenticated(false);
        return;
      }

      const apptsData = await apptsRes.json();
      const timeOffData = timeOffRes.ok ? await timeOffRes.json() : [];

      if (!apptsRes.ok || apptsData.error) {
        throw new Error(`Rendez-vous: ${apptsData.details || apptsData.error || apptsRes.statusText}`);
      }

      console.log("Rendez-vous bruts Dataverse:", apptsData);
      
      // Mapping des données Dataverse (cr7e0_) vers le format UI
      const mappedAppts = (apptsData || []).map((appt: any) => {
        // On cherche le client via la fiche client (lookup)
        const clientObj = appt.cr7e0_ficheclient || {};
        
        // Utilisation des nouvelles colonnes
        let clientName = clientObj.cr7e0_nomclient || appt.cr7e0_nomclient || 
                         clientObj.cr7e0_nomduclient || appt.cr7e0_nomduclient ||
                         clientObj.cr7e0_nom || appt.cr7e0_nom ||
                         clientObj.cr7e0_name || appt.cr7e0_name ||
                         'Client Inconnu';
        
        // Capitaliser les initiales et nettoyer
        clientName = clientName.split(' ').map((word: string) => {
          if (!word) return '';
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');

        // Date et heure
        const dateStr = appt.cr7e0_daterdv;
        const rawDate = dateStr ? new Date(dateStr).getTime() : 0;
        const dateObj = dateStr ? new Date(dateStr) : null;
        
        // Acompte (Choix)
        const depositIdToLabel: Record<string, string> = {
          "129690000": "Oui",
          "129690001": "Non",
          "129690002": "Dispensé"
        };
        const depositLabel = appt['cr7e0_acompte@OData.Community.Display.V1.FormattedValue'] || 
                             depositIdToLabel[String(appt.cr7e0_acompte)] || 
                             'Non';
        
        const hasDeposit = depositLabel === 'Oui';
        
        // Type de tatouage
        const styleIdToLabel: Record<string, string> = {
          "129690000": "Flash",
          "129690001": "Projet perso",
          "129690002": "Retouches",
          "129690003": "RDV Préparatoire",
          "129690004": "Event",
          "129690005": "Cadeau"
        };
        const tattooType = appt['cr7e0_typederdv@OData.Community.Display.V1.FormattedValue'] || 
                           styleIdToLabel[String(appt.cr7e0_typederdv)] ||
                           appt.cr7e0_typederdv || 
                           'Tatouage';

        const isTimeOff = (tattooType || '').toLowerCase().includes('congé') || 
                          (tattooType || '').toLowerCase().includes('timeoff') ||
                          (tattooType || '').toLowerCase().includes('indisponibilité') ||
                          (clientName || '').toLowerCase().includes('congé');

        // Bon de commande (Choix)
        const orderFormIdToLabel: Record<string, string> = {
          "129690000": "Édité",
          "129690001": "Non édité",
          "129690002": "Dispensé"
        };
        const orderFormLabel = appt['cr7e0_boncommande@OData.Community.Display.V1.FormattedValue'] || 
                               orderFormIdToLabel[String(appt.cr7e0_boncommande)] || 
                               'Non édité';

        // On vérifie si la date est réellement exploitable
const isValid = dateObj instanceof Date && !isNaN(dateObj.getTime());

return {
  id: appt.cr7e0_gestiontatouageid || appt.id,
  client: clientName,
  clientEmail: appt.cr7e0_email || '',
  // Si la date est valide on l'affiche, sinon on met "À définir"
  date: isValid ? dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date à définir',
  // Si c'est un congé, on n'affiche pas l'heure (souvent 00:00 ou invalide)
  time: (isValid && !isTimeOff) ? dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : (isTimeOff ? 'Journée' : ''),
  rawDate,
  style: tattooType,
  total: appt.cr7e0_tariftattoo || 0,
  deposit: depositLabel,
  hasDeposit,
  depositAmount: appt.cr7e0_montantacompte || 0,
  orderForm: orderFormLabel,
  location: appt.cr7e0_emplacement || '',
  projectRecap: appt.cr7e0_recapitulatifprojet || '',
  size: appt.cr7e0_taille || '',
  status: hasDeposit ? 'Payé' : 'Confirmé',
  method: 'N/A',
  price: `${appt.cr7e0_tariftattoo || 0} €`,
  isTimeOff
};
      });

      console.log("Rendez-vous mappés:", mappedAppts);
      
      // Dérivation de la base client à partir des rendez-vous
      const clientMap = new Map();
      mappedAppts.forEach(appt => {
        if (appt.isTimeOff) return; // Ne pas créer de client pour les congés
        
        const email = (appt.clientEmail || "").toLowerCase().trim();
        // On regroupe par email si présent, sinon par nom
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
      const mappedClients = Array.from(clientMap.values());

      setAppointments(mappedAppts);
      setClients(mappedClients as any);
      
      // Mapping des TimeOff de Bookings
      const mappedTimeOff = (timeOffData || []).map((item: any) => ({
        id: item.id,
        title: item.serviceName || 'Congé / Indisponibilité',
        start: item.startDateTime?.dateTime,
        end: item.endDateTime?.dateTime,
        isTimeOff: true
      }));
      setTimeOffEvents(mappedTimeOff);
    } catch (err: any) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkAuth = async () => {
    console.log("Vérification de l'authentification...");
    setLoading(true);
    try {
      const isIframe = window.self !== window.top;
      
      // Si on est en iframe, on peut court-circuiter la vérification réelle 
      // car le backend va nous donner un utilisateur de bypass via apiFetch
      if (isIframe) {
        console.log("Mode Iframe détecté : Bypass de l'authentification activé.");
        setIsAuthenticated(true);
        setUser({
          name: "Aperçu AI Studio",
          username: "preview@aistudio.google",
          homeAccountId: "bypass-id"
        });
        setAuthChecking(false);
        setLoading(false);
        return true;
      }

      // Appel via apiFetch qui inclut déjà le header X-Dev-Bypass si on est en iframe
      const res = await apiFetch('/api/auth/status');
      const data = await res.json();
      console.log("Status auth reçu:", data);
      
      setIsAuthenticated(data.isAuthenticated);
      setUser(data.user);
      
      if (!data.isAuthenticated) {
        console.warn("L'utilisateur n'est pas authentifié selon le serveur.");
      }
      return data.isAuthenticated;
    } catch (err) {
      console.error("Erreur lors de la vérification auth:", err);
      setIsAuthenticated(false);
      return false;
    } finally {
      setAuthChecking(false);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('larabstrait_token');
      setIsAuthenticated(false);
      setUser(null);
    } catch (err) {
      console.error("Erreur déconnexion:", err);
    }
  };

  useEffect(() => {
    // 1. Vérifier si un token est présent dans l'URL (retour de callback)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('larabstrait_token', tokenFromUrl);
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      
      // Synchronisation automatique toutes les 2 minutes
      const intervalId = setInterval(() => {
        console.log("Synchronisation automatique des données...");
        fetchData(true);
      }, 120000);
      
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticated]);

  const filteredAppointments = appointments.filter((appt: any) => {
    if (appt.isTimeOff) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (appt.client && appt.client.toLowerCase().includes(query)) ||
      (appt.clientEmail && appt.clientEmail.toLowerCase().includes(query)) ||
      (appt.style && appt.style.toLowerCase().includes(query))
    );
  });

  const filteredClients = clients.filter((client: any) => {
    if ((client.displayName || "").toLowerCase().includes('congé')) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (client.displayName && client.displayName.toLowerCase().includes(query)) ||
      (client.firstName && client.firstName.toLowerCase().includes(query)) ||
      (client.lastName && client.lastName.toLowerCase().includes(query)) ||
      (client.email && client.email.toLowerCase().includes(query))
    );
  });

  if (authChecking) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <RefreshCw className="text-lilas animate-spin" size={48} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={checkAuth} apiFetch={apiFetch} isAuthenticated={isAuthenticated} />;
  }

  const navigateTo = (tab: string) => {
    setActiveTab(tab);
    setShowCreateForm(false);
    setShowTimeOffForm(false);
    setSelectedAppointment(null);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-dark-bg text-gray-100 overflow-hidden flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-dark-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div 
          className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigateTo('dashboard')}
        >
          <div className="w-8 h-8 bg-lilas rounded-lg flex items-center justify-center">
            <span className="text-black font-bold text-lg">LA</span>
          </div>
          <h1 className="text-lg font-bold tracking-tight">Larabstrait</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-0 z-[60] md:relative md:inset-auto
        w-full md:w-64 border-r border-white/5 p-6 pt-6 flex flex-col bg-dark-bg
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex items-center justify-between mb-10 md:mb-10 px-2">
          <div 
            className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigateTo('dashboard')}
          >
            <div className="w-10 h-10 bg-lilas rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-xl">LA</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Larabstrait</h1>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Tableau de bord" 
            active={activeTab === 'dashboard'} 
            onClick={() => navigateTo('dashboard')}
          />
          <SidebarItem 
            icon={Calendar} 
            label="Agenda" 
            active={activeTab === 'calendar'} 
            onClick={() => navigateTo('calendar')}
          />
          <SidebarItem 
            icon={Wallet} 
            label="Comptabilité" 
            active={activeTab === 'accounting'} 
            onClick={() => navigateTo('accounting')}
          />
          <SidebarItem 
            icon={FileText} 
            label="Facturation" 
            active={activeTab === 'billing'} 
            onClick={() => navigateTo('billing')}
          />
          <SidebarItem 
            icon={Users} 
            label="Clients" 
            active={activeTab === 'clients'} 
            onClick={() => navigateTo('clients')}
          />
          <SidebarItem 
            icon={Settings} 
            label="Paramètres" 
            active={activeTab === 'settings'} 
            onClick={() => navigateTo('settings')}
          />
        </nav>

        <div className="pt-6 border-t border-white/5 space-y-2">
          <button 
            onClick={() => { fetchData(); setIsMobileMenuOpen(false); }}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            <span className="font-medium">Synchroniser</span>
          </button>
          <SidebarItem icon={LogOut} label="Déconnexion" onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {/* Global Search Header */}
        {!selectedAppointment && (
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="Rechercher un client, un email ou un style..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-card-bg border border-white/10 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-lilas/50 transition-all w-full"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            {activeTab === 'dashboard' && !showCreateForm && !selectedAppointment && (
              <button 
                onClick={() => setShowCreateForm(true)}
                className="btn-primary flex items-center justify-center space-x-2 md:w-auto w-full"
              >
                <Plus size={20} />
                <span>Nouveau RDV</span>
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex items-center space-x-3">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {showCreateForm ? (
            <CreateAppointmentView 
              clients={clients}
              onBack={() => setShowCreateForm(false)}
              onCreated={() => {
                setShowCreateForm(false);
                fetchData(true);
              }}
              apiFetch={apiFetch}
            />
          ) : showTimeOffForm ? (
            <CreateTimeOffView 
              onBack={() => setShowTimeOffForm(false)}
              onCreated={() => {
                setShowTimeOffForm(false);
                fetchData(true);
              }}
              apiFetch={apiFetch}
            />
          ) : selectedAppointment ? (
            <AppointmentDetailView 
              appointment={selectedAppointment} 
              onBack={() => setSelectedAppointment(null)}
              onUpdate={() => {
                setSelectedAppointment(null);
                fetchData(true);
              }}
              apiFetch={apiFetch}
            />
          ) : activeTab === 'dashboard' ? (
            <DashboardView key="dashboard" appointments={filteredAppointments} rules={accountingRules} loading={loading} user={user} onSelectAppointment={setSelectedAppointment} />
          ) : activeTab === 'calendar' ? (
            <CalendarView 
              key="calendar" 
              appointments={appointments} 
              timeOffEvents={timeOffEvents} 
              onSelectAppointment={setSelectedAppointment} 
              onCreateAppointment={() => setShowCreateForm(true)}
              onCreateTimeOff={() => setShowTimeOffForm(true)}
            />
          ) : activeTab === 'accounting' ? (
            <AccountingView key="accounting" appointments={filteredAppointments} rules={accountingRules} loading={loading} />
          ) : activeTab === 'billing' ? (
            <BillingView key="billing" appointments={filteredAppointments} clients={filteredClients} apiFetch={apiFetch} />
          ) : activeTab === 'clients' ? (
            <ClientsView key="clients" clients={filteredClients} appointments={filteredAppointments} onSelectAppointment={setSelectedAppointment} apiFetch={apiFetch} />
          ) : activeTab === 'settings' ? (
            <SettingsView 
              key="settings" 
              rules={accountingRules} 
              setRules={setAccountingRules} 
              apiFetch={apiFetch}
              isPushSupported={isPushSupported}
              pushSubscription={pushSubscription}
              onSubscribe={subscribeToPush}
              onUnsubscribe={unsubscribeFromPush}
              onTestNotification={sendTestNotification}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Vue en cours de développement...
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
