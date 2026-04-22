import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';

export const LoginView = ({ onLoginSuccess, apiFetch, isAuthenticated }: { onLoginSuccess: () => Promise<void>, apiFetch: any, isAuthenticated: boolean }) => {
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
        
<div className="flex flex-col items-center justify-center mb-12">
  <img 
    src="/logo_larabstrait.png" 
    alt="Larabstrait Logo" 
    className="h-24 w-auto mb-6 object-contain"
  />
  <h1 className="text-4xl font-black text-white tracking-tighter">Larabstrait</h1>
  <p className="text-gray-500 mt-2">Studio de Tatouage Privé</p>
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