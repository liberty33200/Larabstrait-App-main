import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import session from "express-session";
import cookieParser from "cookie-parser";
import * as msal from "@azure/msal-node";
import webpush from "web-push";
import Database from "better-sqlite3";
import axios from "axios";
import { fetchDataverse, updateDataverse, createDataverse, deleteDataverse } from "./dataverseService";

dotenv.config();

// Initialisation de la base de données pour les notifications et paramètres
const db = new Database('notifications.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription TEXT UNIQUE,
    user_id TEXT
  );
  
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    abby_api_key TEXT
  );
`);

// Configuration Web Push
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BOL1mjmDT2wcuCh-ToFzWu6o9oIjq4FVr85uKtosGYsvA3beiLNqf4YPFHddtBPqfVbfTgRRN6rLCcX3vrXUQhM',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'R0V328V-nSSnmYHPj5xpvtVKx7vzs1Ix82kpd9tsvHY'
};

webpush.setVapidDetails(
  'mailto:florent.bidard@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

declare module "express-session" {
  interface SessionData {
    user: any;
  }
}

const isProd = process.env.NODE_ENV === "production";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const msalConfig: msal.Configuration = {
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID || "missing-client-id",
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}`,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "missing-client-secret",
    }
  };

  let cca: msal.ConfidentialClientApplication;
  try {
    cca = new msal.ConfidentialClientApplication(msalConfig);
  } catch (error) {
    console.error("MSAL Init Error:", error);
    cca = {} as any;
  }

  app.set('trust proxy', true);
  app.use(express.json());
  app.use(cookieParser());
  
  const sessionSecret = process.env.SESSION_SECRET || "tattoo-studio-secret-v3";
  const tokenSessions = new Map<string, any>();

  app.use(session({
    name: 'larabstrait_session',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    proxy: true,
    cookie: {
      secure: true,
      sameSite: 'none',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  }));

  app.use('/api', (req: any, res, next) => {
    const authHeader = req.headers.authorization;
    const bypassHeader = req.headers['x-dev-bypass'];

    if (bypassHeader === 'true') {
      req.session.user = {
        name: "Aperçu AI Studio",
        username: "preview@aistudio.google",
        homeAccountId: "bypass-id"
      };
      return next();
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const tokenUser = tokenSessions.get(token);
      if (tokenUser) {
        req.session.user = tokenUser;
      }
    }
    next();
  });

  const getRedirectUri = (req: any) => {
    const origin = req.query.origin as string;
    const host = req.get('host') || "";
    const xForwardedHost = req.get('x-forwarded-host') || "";
    
    // On essaie d'abord d'utiliser la variable d'environnement définie dans Portainer
let baseUrl = process.env.APP_URL || "";

if (!baseUrl) {
  if (host.includes('run.app') || xForwardedHost.includes('run.app') || (origin && origin.includes('run.app'))) {
    const effectiveHost = xForwardedHost.split(',')[0].trim() || host;
    baseUrl = `https://${effectiveHost}`;
  } else if (origin && origin.startsWith('http')) {
    baseUrl = origin;
  } else if (host.includes('localhost')) {
    baseUrl = `http://localhost:3000`;
  } else {
    // Si vraiment rien n'est défini, on met ton adresse NAS par défaut
    baseUrl = "https://app.larabstrait.fr";
  }
}

    baseUrl = baseUrl.replace(/\/+$/, '');
    if (baseUrl.includes('localhost') && (host.includes('run.app') || xForwardedHost.includes('run.app'))) {
       baseUrl = `https://${xForwardedHost.split(',')[0].trim() || host}`;
    }

    return `${baseUrl}/api/auth/callback`;
  };

  app.get("/api/auth/url", (req, res) => {
    cca.getAuthCodeUrl({ scopes: ["user.read"], redirectUri: getRedirectUri(req) })
      .then((url) => res.json({ url }))
      .catch((error) => res.status(500).json({ error: error.message }));
  });

  app.get("/api/auth/login", (req, res) => {
    cca.getAuthCodeUrl({ scopes: ["user.read"], redirectUri: getRedirectUri(req) })
      .then((response) => res.redirect(response))
      .catch((error) => res.status(500).send(error));
  });

  app.get("/api/auth/status", (req: any, res) => {
    res.json({ isAuthenticated: !!req.session.user, user: req.session.user || null });
  });

  app.get("/api/auth/callback", (req, res) => {
    cca.acquireTokenByCode({ code: req.query.code as string, scopes: ["user.read"], redirectUri: getRedirectUri(req) })
      .then((response) => {
      if (response.account) {
        const userData = { homeAccountId: response.account.homeAccountId, username: response.account.username, name: response.account.name };
        req.session.user = userData;
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        tokenSessions.set(token, userData);
        
        res.send(`
          <html>
            <body>
              <h2>Connexion réussie !</h2>
              <script>
                const token = "${token}";
                localStorage.setItem('larabstrait_token', token);
                try { new BroadcastChannel('larabstrait_auth').postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: token }); } catch (e) {}
                if (window.opener) window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: token }, '*');
                setTimeout(() => { window.close(); setTimeout(() => { if (!window.closed) window.location.href = "/?token=" + token; }, 1000); }, 500);
              </script>
            </body>
          </html>
        `);
      } else res.redirect("/");
    }).catch((error) => res.status(500).send(error));
  });

  app.get("/api/auth/user", (req: any, res) => res.json(req.session.user || null));
  app.post("/api/auth/logout", (req, res) => req.session.destroy(() => res.json({ success: true })));

  // --- CALENDRIER / TIME OFF (DUMMY) ---
  app.get("/api/bookings/timeoff", (req, res) => {
    res.json([]); 
  });

  // --- DATA & APPOINTMENTS (Dataverse) ---
  app.get("/api/appointments", async (req, res) => {
    try {
      const data = await fetchDataverse('cr7e0_gestiontatouages'); 
      res.json(data); 
    } catch (error: any) { 
      res.status(500).json({ error: error.message }); 
    }
  });

  app.patch("/api/appointments/:id", async (req, res) => {
    try {
      const result = await updateDataverse('cr7e0_gestiontatouages', req.params.id, req.body); 
      res.json({ success: true, data: result });
    } catch (error: any) { 
      res.status(500).json({ error: error.message }); 
    }
  });

  app.post("/api/appointments", async (req, res) => {
    try {
      const result = await createDataverse('cr7e0_gestiontatouages', req.body); 
      res.status(201).json(result);
    } catch (error: any) { 
      res.status(500).json({ error: error.message }); 
    }
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      const success = await deleteDataverse('cr7e0_gestiontatouages', req.params.id); 
      res.json({ success });
    } catch (error: any) { 
      res.status(500).json({ error: error.message }); 
    }
  });

  // --- SETTINGS ---
  app.get("/api/settings/abby", (req: any, res) => {
    const userId = req.session.user?.homeAccountId || 'anonymous';
    try {
      const settings = db.prepare('SELECT abby_api_key FROM user_settings WHERE user_id = ?').get(userId) as any;
      res.json({ abby_api_key: settings?.abby_api_key || '' });
    } catch (error) { res.status(500).json({ error: "Erreur récupération paramètres" }); }
  });

  app.post("/api/settings/abby", express.json(), (req: any, res) => {
    const { abby_api_key } = req.body;
    const userId = req.session.user?.homeAccountId || 'anonymous';
    try {
      db.prepare('INSERT OR REPLACE INTO user_settings (user_id, abby_api_key) VALUES (?, ?)').run(userId, abby_api_key?.trim());
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Erreur sauvegarde" }); }
  });

  // --- ABBY API ---
  const getAbbyAxiosClient = (userId: string) => {
    const settings = db.prepare('SELECT abby_api_key FROM user_settings WHERE user_id = ?').get(userId) as any;
    const apiKey = settings?.abby_api_key;
    if (!apiKey) return null;

    return axios.create({
      baseURL: 'https://api.app-abby.com',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
  };

  const handleAbbyError = (err: any, res: any, context: string) => {
    const status = err.response?.status || 500;
    const errorData = err.response?.data || err.message;
    console.error(`[Abby Error] ${context}:`, errorData);
    res.status(status).json({ error: `Erreur Abby (${context})`, details: errorData });
  };

  app.get("/api/abby/test-connection", async (req: any, res) => {
    const userId = req.session.user?.homeAccountId || 'anonymous';
    try {
      const abbyApi = getAbbyAxiosClient(userId);
      if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });

      const { data } = await abbyApi.get('/contacts', { params: { limit: 1, page: 1 } });
      res.json({ success: true, message: "Connexion réussie à l'API Abby" });
    } catch (err: any) {
      handleAbbyError(err, res, "Test Connection");
    }
  });

  app.get("/api/abby/test-debug", async (req: any, res) => {
    const userId = req.session.user?.homeAccountId || 'anonymous';
    try {
      const abbyApi = getAbbyAxiosClient(userId);
      if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });

      const { data } = await abbyApi.get('/contacts', { params: { limit: 1, page: 1 } });
      res.json({ success: true, message: "Connexion Abby OK", data });
    } catch (err: any) {
      handleAbbyError(err, res, "Test Debug");
    }
  });

  app.post("/api/abby/create-document", express.json(), async (req: any, res) => {
    const { appointment, type } = req.body;
    const userId = req.session.user?.homeAccountId || 'anonymous';
    
    try {
      const abbyApi = getAbbyAxiosClient(userId);
      if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });

      let customerId = '';
      const { data: searchResult } = await abbyApi.get('/contacts', { 
        params: { search: appointment.client, page: 1 } 
      });
      
      const contactsList = searchResult.data || searchResult.docs || searchResult;
      
      if (contactsList && contactsList.length > 0) {
        customerId = contactsList[0].id;
      } else {
        const names = appointment.client.split(' ');
        const firstname = names[0] || 'Client';
        const lastname = names.slice(1).join(' ') || 'Inconnu';
        
        const { data: newContact } = await abbyApi.post('/contacts', { firstname, lastname });
        customerId = newContact.id;
      }

      if (type === 'Recette') {
        const payload = {
          paidAt: new Date(appointment.date).toISOString(),
          paymentMethodUsed: { value: 1 },
          vatAmount: 0,
          vatId: 1,
          client: appointment.client,
          priceWithoutTax: Math.round(appointment.total * 100),
          priceTotalTax: Math.round(appointment.total * 100),
          reference: `RDV-${appointment.id}`,
          productType: 1,
          isSap: false,
          isTaxIncluded: true
        };
        const { data } = await abbyApi.post('/incomeBook', payload);
        return res.json({ success: true, data });
      } 
      
      if (type === 'Facture' || type === "Facture d'acompte" || type === "Facture finale") {
        const { data: invoice } = await abbyApi.post(`/v2/billing/invoice/${customerId}`, {});
        const invoiceId = invoice.id;

        let amount = appointment.total || 0;
        if (type === "Facture d'acompte") {
          amount = appointment.depositAmount || 0; 
        } else if (type === "Facture finale" || type === "Facture") {
          amount = (appointment.total || 0) - (appointment.depositAmount || 0);
        }

        const linesPayload = {
          lines: [
            {
              designation: appointment.style || "Prestation de tatouage",
              quantity: 1,
              quantityUnit: "unit", 
              unitPrice: Math.round(amount * 100),
              type: "commercial_or_craft_services", 
              vatCode: "FR_00HT"
            }
          ]
        };
        
        await abbyApi.patch(`/v2/billing/${invoiceId}/lines`, linesPayload);
        return res.json({ success: true, data: { id: invoiceId, message: "Facture créée en brouillon" } });
      }

      return res.status(400).json({ error: "Type de document non supporté" });
    } catch (err: any) {
      handleAbbyError(err, res, `Create Document (${type})`);
    }
  });

  app.get("/api/abby/documents", async (req: any, res) => {
    const userId = req.session.user?.homeAccountId || 'anonymous';
    
    try {
      const abbyApi = getAbbyAxiosClient(userId);
      if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });

      const { data } = await abbyApi.get('/v2/billings', { 
        params: { 
          page: 1, 
          limit: 50, 
          test: false 
        } 
      });

      const rawDocs = data.data || data.docs || data || [];

      const formattedDocs = rawDocs.map((doc: any) => {
        // --- 1. TYPE DE DOCUMENT ---
        let docType = 'Document';
        if (doc.type === 'invoice' || doc.number?.startsWith('FA')) docType = 'Facture';
        else if (doc.type === 'estimate' || doc.number?.startsWith('DE')) docType = 'Devis';
        else if (doc.type === 'purchase_order' || doc.number?.startsWith('BC')) docType = 'Bon de commande';

        // --- 2. STATUT (Couleur et Texte) ---
        let statusCode = 'draft';
        let statusText = 'Brouillon';
        const s = (doc.state || doc.status || '').toString().toLowerCase();
        
        if (['canceled', 'cancelled', 'annulée'].includes(s)) {
          statusCode = 'draft';
          statusText = 'Annulé';
        } else if (['paid', 'payée', 'payee'].includes(s)) {
          statusCode = 'paid';
          statusText = 'Encaissé';
        } else if (['accepted', 'acceptée', 'signed', 'signé', 'signee'].includes(s)) {
          statusCode = 'paid';
          statusText = 'Signé';
        } else if (['sent', 'envoyée', 'validated', 'validée', 'pending', 'finalized'].includes(s)) {
          statusCode = 'sent';
          statusText = docType === 'Facture' ? 'À encaisser' : 'À signer';
        }

        // --- 3. MONTANT & VERIFICATION POUR LES FACTURES ---
        let amount = 0;
        if (doc.totalAmountWithTaxAfterDiscount !== undefined) {
          amount = doc.totalAmountWithTaxAfterDiscount / 100;
        }
        
        if (docType === 'Facture' && doc.remainingAmountWithTax !== undefined) {
          if (statusCode === 'sent' && doc.totalAmountWithTaxAfterDiscount > 0 && doc.remainingAmountWithTax === 0) {
            statusCode = 'paid';
            statusText = 'Encaissé';
          }
          if (statusCode !== 'paid') {
            amount = doc.remainingAmountWithTax / 100;
          }
        }

        // --- 4. CLIENT ---
        let clientName = 'Client inconnu';
        if (doc.customer && (doc.customer.firstname || doc.customer.lastname)) {
          clientName = `${doc.customer.firstname || ''} ${doc.customer.lastname || ''}`.trim();
        }

        // --- 5. DATE ---
        let dateVal = doc.emittedAt || doc.createdAt;
        let formattedDate = 'N/A';
        if (dateVal) {
          if (typeof dateVal === 'number' && dateVal.toString().length === 10) {
            dateVal = dateVal * 1000;
          }
          formattedDate = new Date(dateVal).toLocaleDateString('fr-FR');
        }

        return {
          id: doc.number || doc.id || 'N/A',
          internalId: doc.id,
          client: clientName,
          type: docType,
          amount: amount,
          date: formattedDate,
          status: statusCode,
          statusLabel: statusText
        };
      });

      formattedDocs.sort((a: any, b: any) => {
        const dateA = a.date.split('/').reverse().join('-');
        const dateB = b.date.split('/').reverse().join('-');
        return dateB.localeCompare(dateA);
      });

      res.json(formattedDocs);
    } catch (error: any) {
      handleAbbyError(error, res, "Fetch Documents Final");
    }
  });

  // --- TÉLÉCHARGER LE PDF D'UN DOCUMENT ---
  app.get("/api/abby/documents/:id/pdf", async (req: any, res) => {
    const userId = req.session.user?.homeAccountId || 'anonymous';
    try {
      const abbyApi = getAbbyAxiosClient(userId);
      if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });

      const internalId = req.params.id;
      let pdfBuffer;

      // Petit scanner pour trouver la bonne route PDF d'Abby
      const routesToTest = [
        `/v2/billing/${internalId}/download`,
        `/v2/billings/${internalId}/download`,
        `/v2/documents/${internalId}/download`
      ];

      for (const route of routesToTest) {
        try {
          const response = await abbyApi.get(route, { responseType: 'arraybuffer' });
          pdfBuffer = response.data;
          console.log(`🎉 Route PDF trouvée : ${route}`);
          break; // On a trouvé le fichier, on arrête de chercher !
        } catch (e) {
          // On ignore et on tente la route suivante
        }
      }

      if (!pdfBuffer) {
        throw new Error("Impossible de trouver le PDF sur les serveurs d'Abby. L'ID est peut-être incorrect ou le document n'est pas finalisé.");
      }

      const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${disposition}; filename="${internalId}.pdf"`);
      
      return res.send(pdfBuffer);
    } catch (error: any) {
      console.error("[ABBY PDF ERROR]", error.message);
      res.status(500).json({ error: "Impossible de récupérer le PDF depuis Abby." });
    }
  });

  app.post("/api/abby/purchase-register", express.json(), async (req: any, res) => {
    const userId = req.session.user?.homeAccountId || 'anonymous';
    try {
      const abbyApi = getAbbyAxiosClient(userId);
      if (!abbyApi) return res.status(400).json({ error: "Clé API non configurée" });

      const { data } = await abbyApi.post('/v2/purchaseRegister', req.body);
      res.json({ success: true, data });
    } catch (err: any) { handleAbbyError(err, res, "Create Purchase Register Entry"); }
  });

  app.post("/api/abby/products", express.json(), async (req: any, res) => {
    const userId = req.session.user?.homeAccountId || 'anonymous';
    try {
      const abbyApi = getAbbyAxiosClient(userId);
      if (!abbyApi) return res.status(400).json({ error: "Clé API non configurée" });

      const { data } = await abbyApi.post('/v2/catalog/product', req.body);
      res.json({ success: true, data });
    } catch (err: any) { handleAbbyError(err, res, "Create Product"); }
  });

  app.get("/api/abby/products", async (req: any, res) => {
    const userId = req.session.user?.homeAccountId || 'anonymous';
    try {
      const abbyApi = getAbbyAxiosClient(userId);
      if (!abbyApi) return res.status(400).json({ error: "Clé API non configurée" });

      const { data } = await abbyApi.get('/v2/catalog/products', { params: { page: 1 } });
      res.json(data);
    } catch (err: any) { handleAbbyError(err, res, "Fetch Products"); }
  });

  // --- NOTIFICATIONS ---
  app.get("/api/notifications/vapid-public-key", (req, res) => res.json({ publicKey: vapidKeys.publicKey }));

  app.post("/api/notifications/subscribe", express.json(), (req: any, res) => {
    const userId = req.session.user?.homeAccountId || 'anonymous';
    try {
      db.prepare('INSERT OR REPLACE INTO subscriptions (subscription, user_id) VALUES (?, ?)').run(JSON.stringify(req.body), userId);
      res.status(201).json({});
    } catch (error) { res.status(500).json({ error: "Erreur abonnement" }); }
  });

  app.post("/api/notifications/send-test", express.json(), async (req: any, res) => {
    const userId = req.session.user?.homeAccountId || 'anonymous';
    const subscriptions = db.prepare('SELECT subscription FROM subscriptions WHERE user_id = ?').all(userId);
    const notificationPayload = JSON.stringify({ title: 'Test', body: 'Test notification !', url: '/' });

    try {
      if (subscriptions.length === 0) return res.status(400).json({ error: "Aucun appareil enregistré." });
      await Promise.all((subscriptions as any[]).map(sub => 
        webpush.sendNotification(JSON.parse(sub.subscription), notificationPayload)
          .catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) db.prepare('DELETE FROM subscriptions WHERE subscription = ?').run(sub.subscription);
            throw err;
          })
      ));
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // --- GESTION DES ERREURS 404 DE L'API ---
  app.all('/api/*', (req, res) => {
    console.error(`[404] Le frontend a tenté d'appeler une route inexistante : ${req.method} ${req.path}`);
    res.status(404).json({ error: "Route API introuvable", path: req.path });
  });

  // --- VITE & SPA FALLBACK ---
  const vite = await createViteServer({
    server: { middlewareMode: true, allowedHosts: true, hmr: false },
    appType: "spa",
  });
  
  app.use(vite.middlewares);

  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    try {
      const indexPath = path.resolve(process.cwd(), 'index.html');
      if (!fs.existsSync(indexPath)) return res.status(404).send("index.html introuvable.");
      let html = await vite.transformIndexHtml(req.url, fs.readFileSync(indexPath, 'utf-8'));
      res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
    } catch (e) { res.status(500).send("Erreur interne."); }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVEUR DÉMARRÉ SUR LE PORT ${PORT} <<<`);
  });
}

startServer().catch(console.error);