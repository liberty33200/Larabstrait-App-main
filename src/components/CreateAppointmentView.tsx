import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Plus, RefreshCw, AlertCircle } from 'lucide-react';

export const CreateAppointmentView = ({ clients, onBack, onCreated, apiFetch }: any) => {
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
      const needsDrawing = ["Flash", "Projet perso", "Cadeau"].includes(formData.style);

      // PAYLOAD PROPRE POUR POSTGRESQL (Plus de cr7e0 ni de codes chiffres)
      const createPayload = {
        client_name: clientName,
        client_email: clientEmail,
        appointment_date: dateTime.toISOString(),
        total_price: parseFloat(formData.total.toString()),
        deposit_status: formData.deposit,
        deposit_amount: parseFloat(formData.depositAmount.toString()),
        style: formData.style,
        location: formData.location,
        project_recap: formData.projectRecap,
        size: formData.size,
        project_status: needsDrawing ? 'À dessiner' : 'Non nécessaire',
        instagram: "" // Ajout pour éviter les erreurs SQL
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lilas/50 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <input 
                      type="email" 
                      placeholder="Email (optionnel)"
                      value={formData.newClientEmail}
                      onChange={(e) => setFormData({...formData, newClientEmail: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lilas/50 transition-all"
                    />
                  </div>
                </div>
              ) : (
                <select 
                  value={formData.clientId}
                  onChange={(e) => setFormData({...formData, clientId: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lilas/50 transition-all appearance-none"
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lilas/50 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Heure</label>
                <input 
                  type="time" 
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lilas/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Type de projet</label>
              <select 
                value={formData.style}
                onChange={(e) => setFormData({...formData, style: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lilas/50 transition-all appearance-none"
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lilas/50 transition-all"
                  placeholder="Ex: Bras"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Taille</label>
                <input 
                  type="text" 
                  value={formData.size}
                  onChange={(e) => setFormData({...formData, size: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lilas/50 transition-all"
                  placeholder="Ex: 10cm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Récap Projet</label>
              <textarea 
                value={formData.projectRecap}
                onChange={(e) => setFormData({...formData, projectRecap: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lilas/50 transition-all min-h-[80px]"
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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lilas/50 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Acompte</label>
                <select 
                  value={formData.deposit}
                  onChange={(e) => setFormData({...formData, deposit: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lilas/50 transition-all appearance-none"
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lilas/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Bon de commande</label>
              <select 
                value={formData.orderForm}
                onChange={(e) => setFormData({...formData, orderForm: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lilas/50 transition-all appearance-none"
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