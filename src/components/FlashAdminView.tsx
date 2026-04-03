import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Image as ImageIcon, X, UploadCloud, CheckCircle2, Clock, Ruler, Tag, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const FlashAdminView = () => {
  const [flashes, setFlashes] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [editingFlash, setEditingFlash] = useState<any | null>(null);
  
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');
  const [duration, setDuration] = useState('60');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFlashes = async () => {
    try {
      const res = await fetch('/api/flashes');
      const data = await res.json();
      if (Array.isArray(data)) setFlashes(data);
    } catch (error) { console.error("Erreur chargement:", error); }
  };

  useEffect(() => { loadFlashes(); }, []);

  const openEditForm = (flash: any) => {
    setEditingFlash(flash);
    setTitle(flash.title || '');
    setPrice(flash.price || '');
    setSize(flash.size || '');
    setDuration(flash.duration ? flash.duration.toString() : '60');
    setFile(null);
    setShowForm(true);
  };

  const openAddForm = () => {
    setEditingFlash(null);
    setTitle(''); setPrice(''); setSize(''); setDuration('60'); setFile(null);
    setShowForm(true);
  };

  const handleSaveFlash = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('price', price);
    formData.append('size', size);
    formData.append('duration', duration);
    if (file) formData.append('image', file);

    try {
      const url = editingFlash ? `/api/flashes/${editingFlash.id}` : '/api/flashes';
      const method = editingFlash ? 'PUT' : 'POST';

      const res = await fetch(url, { method, body: formData });

      if (res.ok) {
        setShowForm(false);
        loadFlashes();
      } else { alert("Erreur lors de l'enregistrement."); }
    } catch (error) { alert("Erreur réseau."); }
    setIsUploading(false);
  };

  const toggleAvailable = async (id: number, currentStatus: boolean) => {
    await fetch(`/api/flashes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: !currentStatus })
    });
    loadFlashes();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Supprimer définitivement ce flash ?")) return;
    await fetch(`/api/flashes/${id}`, { method: 'DELETE' });
    loadFlashes();
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 text-white font-sans max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-white flex items-center space-x-3 uppercase tracking-tighter">
            <ImageIcon className="text-lilas" size={32} />
            <span>Catalogue</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1 uppercase tracking-widest font-bold">Admin Edition</p>
        </div>
        <button 
          onClick={openAddForm} 
          className="w-full sm:w-auto bg-lilas text-black px-8 py-4 rounded-2xl font-black flex items-center justify-center space-x-3 hover:bg-lilas/90 active:scale-95 transition shadow-xl uppercase text-xs tracking-[0.2em]"
        >
          <Plus size={20} /> <span>Nouveau Flash</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {flashes.map(flash => (
          <motion.div key={flash.id} layout className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] overflow-hidden group flex flex-col backdrop-blur-sm">
            <div className="aspect-[3/4] relative bg-black/40">
              <img src={`/api/flashes/images/${flash.image_filename}`} alt={flash.title} className="w-full h-full object-contain p-6" />
              
              <div className="absolute top-4 right-4 flex flex-col space-y-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300">
                <button onClick={() => openEditForm(flash)} className="bg-white text-black p-3 rounded-2xl shadow-2xl hover:bg-lilas transition-colors active:scale-90">
                  <Edit2 size={18} />
                </button>
                <button onClick={() => handleDelete(flash.id)} className="bg-white text-red-600 p-3 rounded-2xl shadow-2xl hover:bg-red-50 transition-colors active:scale-90">
                  <Trash2 size={18} />
                </button>
              </div>

              {!flash.available && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center">
                  <span className="bg-red-500 text-white font-black px-6 py-2 rounded-full uppercase text-[10px] tracking-widest -rotate-12 shadow-2xl">Vendu / Réservé</span>
                </div>
              )}
            </div>

            <div className="p-6 flex-1 flex flex-col">
              <h3 className="font-bold text-xl text-white mb-4 truncate">{flash.title}</h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="flex items-center space-x-2 bg-black/30 p-2 rounded-xl border border-zinc-800">
                  <Tag size={14} className="text-lilas" /> <span className="text-sm font-bold">{flash.price}</span>
                </div>
                <div className="flex items-center space-x-2 bg-black/30 p-2 rounded-xl border border-zinc-800">
                  <Clock size={14} className="text-lilas" /> <span className="text-sm font-bold">{flash.duration}m</span>
                </div>
              </div>
              <button 
                onClick={() => toggleAvailable(flash.id, flash.available)} 
                className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${
                  flash.available ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                }`}
              >
                {flash.available ? "Désactiver" : "Réactiver"}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-0 sm:p-4 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} 
              className="bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-[2.5rem] p-8 w-full max-w-lg h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto relative"
            >
              <button onClick={() => setShowForm(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white p-2 bg-zinc-800 rounded-full transition">
                <X size={24} />
              </button>
              
              <h2 className="text-3xl font-black mb-8 uppercase tracking-tighter">
                {editingFlash ? "Modifier" : "Nouveau"}
              </h2>
              
              <form onSubmit={handleSaveFlash} className="space-y-6">
                <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-3xl h-48 flex flex-col items-center justify-center cursor-pointer transition-all ${file ? 'border-lilas bg-lilas/5' : 'border-zinc-800 bg-black/50'}`}>
                  {file ? (
                    <div className="text-center px-4">
                      <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                      <p className="text-emerald-500 font-bold text-xs truncate">{file.name}</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <UploadCloud size={40} className="mx-auto text-zinc-700 mb-3" />
                      <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest block px-6">
                        {editingFlash ? "Remplacer l'image" : "Importer le dessin"}
                      </span>
                    </div>
                  )}
                  <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </div>

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nom du modèle</label>
                    <input required placeholder="Nom" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-lilas outline-none transition-colors" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Prix</label>
                      <input required placeholder="Ex: 150€" value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-lilas outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Durée (min)</label>
                      <input required type="number" step="15" value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-lilas outline-none" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Taille</label>
                    <input required placeholder="Ex: 10cm" value={size} onChange={e => setSize(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white focus:border-lilas outline-none" />
                  </div>
                </div>

                <button type="submit" disabled={isUploading} className="w-full bg-lilas text-black font-black py-5 rounded-2xl mt-4 hover:scale-[1.02] active:scale-95 transition-all uppercase text-xs tracking-[0.3em] shadow-2xl shadow-lilas/20">
                  {isUploading ? "Traitement..." : "Valider"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};