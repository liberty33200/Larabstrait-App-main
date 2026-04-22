import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, User, Clock, Image as ImageIcon, 
  ArrowRight, Instagram, Check, X, Phone,
  DollarSign, MapPin, Maximize, Calendar, 
  Activity, AlertCircle, Heart
} from 'lucide-react';

interface BookingRequest {
  id: number;
  client_name: string;
  client_email: string;
  client_phone?: string;
  instagram?: string;
  project_description: string;
  project_type?: string;
  placement?: string;
  estimated_size?: string;
  budget?: string;
  reference_images?: string;
  status: string;
  created_at: string;
}

interface InboxViewProps {
  apiFetch: (url: string, options?: any) => Promise<Response>;
  onAcceptRequest: (req: any) => void;
}

const InfoCard = ({ title, value, icon: Icon, truncate = true }: { title: string, value: string, icon?: any, truncate?: boolean }) => {
  const isMissing = value === 'Non communiqué';
  return (
    <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 flex flex-col justify-center min-h-[80px]">
      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
        {Icon && <Icon size={12} className="opacity-70" />} 
        {title}
      </p>
      <p className={`text-sm font-semibold ${truncate ? 'truncate' : 'whitespace-pre-wrap leading-relaxed'} ${isMissing ? 'text-gray-600' : (title === 'Budget' ? 'text-lilas' : 'text-gray-200')}`}>
        {value}
      </p>
    </div>
  );
};

export const InboxView = ({ apiFetch, onAcceptRequest }: InboxViewProps) => {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await apiFetch('/api/requests');
      const data = await response.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erreur chargement demandes:", error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      await apiFetch(`/api/requests/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchRequests();
    } catch (error) {
      console.error("Erreur statut:", error);
    }
  };

  const getImages = (jsonStr?: string): string[] => {
    try {
      return jsonStr ? JSON.parse(jsonStr) : [];
    } catch (e) {
      return [];
    }
  };

  const parseDetails = (req: BookingRequest) => {
    let raw = req.project_description || "";
    const keys = ["TYPE :", "BUDGET PRÉVU :", "DESCRIPTION :", "EMPLACEMENT :", "TAILLE :", "DISPOS :", "SANTÉ & CONFORT", "Premier tatouage :", "Appréhensions :", "Infos santé :", "Préférences :"];

    const extract = (key: string) => {
      const start = raw.indexOf(key);
      if (start === -1) return "";
      const content = raw.substring(start + key.length);
      let minEnd = content.length;
      keys.forEach(k => {
        if (k !== key) {
          const idx = content.indexOf(k);
          if (idx !== -1 && idx < minEnd) minEnd = idx;
        }
      });
      return content.substring(0, minEnd).replace(/[✨💰📝📍📏🗓️🌿]/g, '').replace(/-+/g, '').trim();
    };

    const formatEmpty = (val: string, fallback: string = "Non communiqué") => {
      if (!val) return fallback;
      if (val.toLowerCase() === "non précisé" || val.toLowerCase() === "n/a") return "Non communiqué";
      return val;
    };

    return {
      type: req.project_type || formatEmpty(extract("TYPE :"), "Projet Tattoo"),
      budget: req.budget || formatEmpty(extract("BUDGET PRÉVU :")),
      placement: req.placement || formatEmpty(extract("EMPLACEMENT :")),
      size: req.estimated_size || formatEmpty(extract("TAILLE :")),
      dispos: formatEmpty(extract("DISPOS :")),
      firstTattoo: formatEmpty(extract("Premier tatouage :")),
      apprehensions: formatEmpty(extract("Appréhensions :")),
      health: formatEmpty(extract("Infos santé :")),
      prefs: formatEmpty(extract("Préférences :")),
      desc: formatEmpty(extract("DESCRIPTION :"))
    };
  };

  return (
    <div className="space-y-8 relative">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Demandes de projet</h2>
          <p className="text-gray-500 text-sm mt-1">Gestion du flux entrant</p>
        </div>
        <div className="bg-lilas/10 text-lilas px-4 py-2 rounded-full text-sm font-bold border border-lilas/20 flex items-center space-x-2">
          <Mail size={16} />
          <span>{requests.filter(r => r.status === 'En attente').length} demandes</span>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-white/5 rounded-3xl animate-pulse"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {requests.map((req) => (
            <motion.div 
              key={req.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedRequest(req)}
              className={`glass-card p-6 rounded-3xl cursor-pointer hover:border-lilas/40 hover:-translate-y-1 transition-all duration-300 flex flex-col group relative overflow-hidden ${
                req.status === 'En attente' ? 'border-t-4 border-t-lilas/80' : 'border border-white/5'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lilas group-hover:bg-lilas group-hover:text-black transition-colors">
                    <User size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-md leading-tight">{req.client_name}</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1 tracking-wider">
                      {parseDetails(req).type}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-400 line-clamp-2 italic mb-4">
                "{parseDetails(req).desc.substring(0, 100)}..."
              </p>

              <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${
                  req.status === 'Accepté' ? 'bg-emerald-500/10 text-emerald-400' : 
                  req.status === 'Refusé' ? 'bg-rose-500/10 text-rose-400' : 'bg-white/5 text-gray-500'
                }`}>
                  {req.status}
                </span>
                <ArrowRight size={16} className="text-gray-600 group-hover:text-lilas transition-colors" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-black/95 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.98, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 20 }}
              className="bg-[#0A0A0A] border border-white/10 max-w-5xl w-full h-full md:h-auto md:max-h-[90vh] overflow-hidden md:rounded-[2rem] flex flex-col shadow-2xl"
            >
              <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center bg-[#0A0A0A] z-10 shrink-0">
                <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                  {selectedRequest.client_name}
                </h3>
                <button onClick={() => setSelectedRequest(null)} className="p-2 text-gray-500 bg-white/5 hover:bg-white/10 hover:text-white rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
                <div className="flex flex-col md:flex-row gap-10">
                  <div className="w-full md:w-2/3 flex flex-col space-y-8">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      <InfoCard title="Emplacement" value={parseDetails(selectedRequest).placement} icon={MapPin} />
                      <InfoCard title="Taille" value={parseDetails(selectedRequest).size} icon={Maximize} />
                      <InfoCard title="Budget" value={parseDetails(selectedRequest).budget} icon={DollarSign} />
                      <InfoCard title="Dispos" value={parseDetails(selectedRequest).dispos} icon={Calendar} />
                      <InfoCard title="1er Tatouage" value={parseDetails(selectedRequest).firstTattoo} icon={User} />
                      <InfoCard title="Infos Santé" value={parseDetails(selectedRequest).health} icon={Activity} />
                      
                      <div className="col-span-2 lg:col-span-3 grid grid-cols-1 gap-3">
                         <InfoCard title="Appréhensions" value={parseDetails(selectedRequest).apprehensions} icon={AlertCircle} truncate={false} />
                         <InfoCard title="Préférences" value={parseDetails(selectedRequest).prefs} icon={Heart} truncate={false} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest ml-1">Description détaillée</p>
                      <div className="text-sm md:text-base text-gray-300 leading-relaxed bg-white/[0.02] p-6 md:p-8 rounded-[1.5rem] border border-white/5 min-h-[120px] whitespace-pre-wrap">
                        {parseDetails(selectedRequest).desc}
                      </div>
                    </div>

                    {getImages(selectedRequest.reference_images).length > 0 && (
                      <div className="space-y-3 pb-8 md:pb-0">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest ml-1">Images d'inspiration</p>
                        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                          {getImages(selectedRequest.reference_images).map((img, i) => (
                            <button 
                              key={i} 
                              onClick={() => setFullscreenImage(img)} 
                              className="w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden border border-white/10 hover:border-lilas shrink-0 transition-all shadow-lg focus:outline-none"
                            >
                              <img src={img} alt="Inspo" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full md:w-1/3 flex flex-col border-t md:border-t-0 md:border-l border-white/5 pt-8 md:pt-0 md:pl-10 pb-8 md:pb-0">
                    <div className="space-y-4 mb-8">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">Contact direct</p>
                      
                      <div className="flex items-center gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                         <Instagram size={20} className="text-lilas" />
                         <div className="overflow-hidden">
                            {selectedRequest.instagram ? (
                              <a href={`https://instagram.com/${selectedRequest.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="text-sm text-white font-bold hover:text-lilas transition-colors truncate block">
                                {selectedRequest.instagram}
                              </a>
                            ) : <p className="text-sm text-gray-600 font-semibold">Non communiqué</p>}
                         </div>
                      </div>

                      <div className="flex items-center gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                         <Phone size={20} className="text-gray-400" />
                         <div className="overflow-hidden">
                            <p className="text-sm text-white font-bold truncate">{selectedRequest.client_phone || "Non communiqué"}</p>
                         </div>
                      </div>

                      <div className="flex items-center gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                         <Mail size={20} className="text-gray-400" />
                         <div className="overflow-hidden">
                            <p className="text-sm text-white font-bold truncate max-w-[200px]">{selectedRequest.client_email}</p>
                         </div>
                      </div>
                    </div>

                    <a 
                      href={`mailto:${selectedRequest.client_email}?subject=Ton projet tattoo - Larabstrait`}
                      className="w-full py-4 bg-white text-black rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-lilas transition-colors shadow-xl mb-8"
                    >
                      <Mail size={20} /> Envoyer un mail
                    </a>

                    <div className="flex-1 hidden md:block" />

                    <div className="grid grid-cols-2 gap-3 mt-auto">
                      <button 
                        onClick={() => {
                          updateStatus(selectedRequest.id, 'Accepté');
                          onAcceptRequest(selectedRequest);
                          setSelectedRequest(null);
                        }}
                        className="bg-emerald-500 py-4 rounded-2xl text-black font-black flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all shadow-lg"
                      >
                        <Check size={20} strokeWidth={3} /> Accepter
                      </button>

                      <button 
                        onClick={() => {
                          if(window.confirm("Refuser cette demande ?")) {
                            updateStatus(selectedRequest.id, 'Refusé');
                            setSelectedRequest(null);
                          }
                        }}
                        className="bg-rose-500 py-4 rounded-2xl text-white font-black flex items-center justify-center gap-2 hover:bg-rose-600 transition-all shadow-lg"
                      >
                        <X size={20} strokeWidth={3} /> Refuser
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fullscreenImage && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/98 p-4 cursor-zoom-out"
            onClick={() => setFullscreenImage(null)}
          >
            <button 
              className="absolute top-6 right-6 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setFullscreenImage(null);
              }}
            >
              <X size={24} />
            </button>
            <motion.img 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              src={fullscreenImage} 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};