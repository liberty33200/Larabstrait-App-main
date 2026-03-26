import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Bell, AlertCircle, Calendar, Receipt, 
  Check, Wallet, Plus, RefreshCw, Edit2, Trash2, 
  ChevronDown, Search, Copy 
} from 'lucide-react';

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

export const SettingsView = ({ 
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