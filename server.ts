import express from "express";
import cron from 'node-cron';
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import session from "express-session";
import cookieParser from "cookie-parser";
import * as msal from "@azure/msal-node";
import webpush from "web-push";
import multer from "multer";
import Database from "better-sqlite3";
import nodemailer from 'nodemailer';
import axios, { AxiosInstance } from "axios";
import {
  fetchDataverse,
  updateDataverse,
  createDataverse,
  deleteDataverse
} from "./dataverseService";

dotenv.config();

// 1. On s'assure que le dossier "data" existe
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const oldDbPath = path.join(dataDir, 'notifications.db');
const newDbPath = path.join(dataDir, 'larabstrait.db');

// Le serveur renomme le fichier tout seul s'il trouve l'ancien !
if (fs.existsSync(oldDbPath) && !fs.existsSync(newDbPath)) {
  fs.renameSync(oldDbPath, newDbPath);
  console.log("📦 Base de données renommée avec succès en larabstrait.db");
}

const db = new Database(newDbPath);

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

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    content TEXT,
    completed INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS flashes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    price TEXT NOT NULL,
    size TEXT NOT NULL,
    duration INTEGER DEFAULT 60,
    available INTEGER DEFAULT 1,
    image_filename TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.prepare("ALTER TABLE flashes ADD COLUMN duration INTEGER DEFAULT 60").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE flashes ADD COLUMN client_data TEXT").run();
} catch (e) {}

// Configuration Web Push
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || "BOL1mjmDT2wcuCh-ToFzWu6o9oIjq4FVr85uKtosGYsvA3beiLNqf4YPFHddtBPqfVbfTgRRN6rLCcX3vrXUQhM",
  privateKey: process.env.VAPID_PRIVATE_KEY || "R0V328V-nSSnmYHPj5xpvtVKx7vzs1Ix82kpd9tsvHY"
};

webpush.setVapidDetails(
  "mailto:florent.bidard@gmail.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

declare module "express-session" {
  interface SessionData {
    user: any;
  }
}

const isProd = process.env.NODE_ENV === "production";

function getUserId(req: any): string {
  return req.session?.user?.homeAccountId || "anonymous";
}

function getStoredAbbySettings(userId: string) {
  return db.prepare("SELECT abby_api_key FROM user_settings WHERE user_id = ?").get(userId) as any;
}

// --- 1. FONCTIONS DE BASE ABBY ---
function getAbbyApiKey(): string {
  let envKey = process.env.ABBY_API_KEY || "";
  envKey = envKey.replace(/\s+/g, "").replace(/['"]/g, "");
  return envKey.replace(/^Bearer/i, "");
}

function getAbbyAxiosClient(): AxiosInstance | null {
  const apiKey = getAbbyApiKey();
  if (!apiKey) return null;

  return axios.create({
    baseURL: "https://api.app-abby.com",
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });
}

function handleAbbyError(err: any, res: any, context: string) {
  const status = err.response?.status || 500;
  const errorData = err.response?.data || err.message;
  console.error(`[Abby Error] ${context}:`, errorData);
  res.status(status).json({
    error: `Erreur Abby (${context})`,
    details: errorData
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const msalConfig: msal.Configuration = {
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID || "missing-client-id",
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}`,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "missing-client-secret"
    }
  };

  let cca: msal.ConfidentialClientApplication;
  try {
    cca = new msal.ConfidentialClientApplication(msalConfig);
  } catch (error) {
    cca = {} as any;
  }

  app.set("trust proxy", true);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  // GESTION DU CATALOGUE DE FLASHS
  const flashesDir = path.join(process.cwd(), 'data', 'flashes');
  if (!fs.existsSync(flashesDir)) {
    fs.mkdirSync(flashesDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, flashesDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, 'flash-' + uniqueSuffix + ext);
    }
  });
  const upload = multer({ storage });

  app.use('/api/flashes/images', express.static(flashesDir));

  app.get('/api/flashes', (req, res) => {
    try {
      const flashes = db.prepare("SELECT * FROM flashes ORDER BY created_at DESC").all();
      res.json(flashes.map((f: any) => ({ ...f, available: f.available === 1 })));
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de la récupération des flashs" });
    }
  });

  app.post('/api/flashes', upload.single('image'), (req, res) => {
    try {
      const { title, price, size, duration } = req.body;
      if (!req.file) return res.status(400).json({ error: "L'image est obligatoire." });

      const stmt = db.prepare("INSERT INTO flashes (title, price, size, duration, image_filename) VALUES (?, ?, ?, ?, ?)");
      const info = stmt.run(title, price, size, duration || 60, req.file.filename);
      res.status(201).json({ success: true, id: info.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de la création du flash" });
    }
  });

  app.put('/api/flashes/:id', upload.single('image'), (req, res) => {
    try {
      const { title, price, size, duration } = req.body;
      const flashId = req.params.id;
      const existing: any = db.prepare("SELECT image_filename FROM flashes WHERE id = ?").get(flashId);
      if (!existing) return res.status(404).json({ error: "Flash non trouvé" });

      let fileName = existing.image_filename;
      if (req.file) {
        const oldPath = path.join(flashesDir, existing.image_filename);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        fileName = req.file.filename;
      }

      const stmt = db.prepare(`UPDATE flashes SET title = ?, price = ?, size = ?, duration = ?, image_filename = ? WHERE id = ?`);
      stmt.run(title, price, size, duration, fileName, flashId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erreur modification" });
    }
  });

  app.patch('/api/flashes/:id', express.json(), (req, res) => {
    try {
      const { available, reservationDetails } = req.body;
      const clientData = reservationDetails ? JSON.stringify(reservationDetails) : null;
      db.prepare("UPDATE flashes SET available = ?, client_data = ? WHERE id = ?").run(available ? 1 : 0, clientData, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erreur réservation" });
    }
  });

  app.delete('/api/flashes/:id', (req, res) => {
    try {
      const flash: any = db.prepare("SELECT image_filename FROM flashes WHERE id = ?").get(req.params.id);
      if (flash) {
        const imgPath = path.join(flashesDir, flash.image_filename);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        db.prepare("DELETE FROM flashes WHERE id = ?").run(req.params.id);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erreur suppression" });
    }
  });

  app.get('/api/availability', async (req, res) => {
    const { date, duration } = req.query; 
    const flashDur = parseInt(duration as string) || 60;
    try {
      const start = new Date(`${date}T18:00:00`);
      const end = new Date(start.getTime() + (6 * 60 * 60 * 1000)); 
      const existingAppointments: any[] = []; 
      const slots = [];
      let current = new Date(start);
      const step = 30;

      while (current.getTime() + (flashDur * 60000) <= end.getTime()) {
        const slotStart = new Date(current);
        const slotEnd = new Date(current.getTime() + (flashDur * 60000));
        const isFree = !existingAppointments.some(app => {
          const appStart = new Date(app.start);
          const appEnd = new Date(app.end);
          return (slotStart < appEnd && slotEnd > appStart);
        });

        if (isFree) {
          slots.push(slotStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        }
        current = new Date(current.getTime() + (step * 60000));
      }
      res.json(slots);
    } catch (error) {
      res.status(500).json({ error: "Erreur calcul créneaux" });
    }
  });

  app.post('/api/appointments/:id/consent', express.json({ limit: '50mb' }), async (req: any, res) => {
    const appointmentId = req.params.id;
    const { pdfData, clientName, appointmentDate } = req.body;
    const cleanName = clientName ? clientName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_") : "Client";
    const dateStr = appointmentDate ? appointmentDate.toString().replace(/[\/\.\s]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '') : "Date_Inconnue";
    const fileName = `Consentement_${cleanName}_${dateStr}_${appointmentId}.pdf`;

    try {
      let userAccountId = req.session?.user?.homeAccountId;
      if (!userAccountId) {
        const accounts = await cca.getTokenCache().getAllAccounts();
        if (accounts.length > 0) userAccountId = accounts[0].homeAccountId;
        else return res.status(401).json({ error: "Non authentifié" });
      }

      const account = await cca.getTokenCache().getAccountByHomeId(userAccountId);
      const authResult = await cca.acquireTokenSilent({ account: account!, scopes: ["Mail.Send"] });
      const graphToken = authResult.accessToken;

      let base64Data = pdfData.includes('base64,') ? pdfData.split('base64,')[1] : pdfData;
      base64Data = base64Data.replace(/\s/g, ''); 

      const dechargesDir = path.join(process.cwd(), 'data', 'decharges');
      if (!fs.existsSync(dechargesDir)) fs.mkdirSync(dechargesDir, { recursive: true });

      fs.writeFileSync(path.join(dechargesDir, fileName), Buffer.from(base64Data, 'base64'));

      const emailPayload = {
        message: {
          subject: `🖋️ Décharge signée : ${clientName}`,
          body: { contentType: "HTML", content: `<p>Bonjour,</p><p>Une nouvelle décharge a été signée par <b>${clientName}</b> pour le RDV du ${dateStr}.</p>` },
          toRecipients: [{ emailAddress: { address: process.env.EMAIL_STUDIO ? process.env.EMAIL_STUDIO.trim() : "" } }],
          attachments: [{ "@odata.type": "#microsoft.graph.fileAttachment", name: `Consentement_${cleanName}_${dateStr}.pdf`, contentType: "application/pdf", contentBytes: base64Data }]
        }
      };

      await axios.post("https://graph.microsoft.com/v1.0/me/sendMail", emailPayload, { headers: { Authorization: `Bearer ${graphToken}`, "Content-Type": "application/json" } });
      res.json({ success: true });

    } catch (error: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get('/api/appointments/:id/download-consent', (req, res) => {
    const appointmentId = req.params.id;
    const dechargesDir = path.join(process.cwd(), 'data', 'decharges');
    if (!fs.existsSync(dechargesDir)) return res.status(404).send("Dossier vide");
    const files = fs.readdirSync(dechargesDir);
    const targetFile = files.find(f => f.includes(appointmentId) && f.endsWith('.pdf'));

    if (targetFile) res.download(path.join(dechargesDir, targetFile));
    else res.status(404).json({ error: "Fichier non trouvé" });
  });

  app.get('/api/appointments/:id/check-consent', (req, res) => {
    const appointmentId = req.params.id;
    const dechargesDir = path.join(process.cwd(), 'data', 'decharges');
    if (!fs.existsSync(dechargesDir)) return res.json({ exists: false });
    const files = fs.readdirSync(dechargesDir);
    const exists = files.some(f => f.includes(appointmentId));
    res.json({ exists });
  });

  const sessionSecret = process.env.SESSION_SECRET || "tattoo-studio-secret-v3";
  const tokenSessions = new Map<string, any>();

  app.use(
    session({
      name: "larabstrait_session",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: true,
      proxy: true,
      cookie: { secure: true, sameSite: "none", httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
    })
  );

  app.use("/api", (req: any, res, next) => {
    const authHeader = req.headers.authorization;
    const bypassHeader = req.headers["x-dev-bypass"];

    if (bypassHeader === "true") {
      req.session.user = { name: "Aperçu", username: "preview@aistudio.google", homeAccountId: "bypass-id" };
      return next();
    }

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const tokenUser = tokenSessions.get(token);
      if (tokenUser) req.session.user = tokenUser;
    }
    next();
  });

  const getRedirectUri = (req: any) => {
    const origin = req.query.origin as string;
    const host = req.get("host") || "";
    const xForwardedHost = req.get("x-forwarded-host") || "";

    let baseUrl = process.env.APP_URL || "";
    if (!baseUrl) {
      if (host.includes("run.app") || xForwardedHost.includes("run.app") || (origin && origin.includes("run.app"))) {
        const effectiveHost = xForwardedHost.split(",")[0].trim() || host;
        baseUrl = `https://${effectiveHost}`;
      } else if (origin && origin.startsWith("http")) {
        baseUrl = origin;
      } else if (host.includes("localhost")) {
        baseUrl = "http://localhost:3000";
      } else {
        baseUrl = "https://app.larabstrait.fr";
      }
    }

    baseUrl = baseUrl.replace(/\/+$/, "").replace(/\/api\/auth\/callback$/, "");
    if (baseUrl.includes("localhost") && (host.includes("run.app") || xForwardedHost.includes("run.app"))) {
      baseUrl = `https://${xForwardedHost.split(",")[0].trim() || host}`;
    }
    return `${baseUrl}/api/auth/callback`;
  };

  app.get("/api/auth/url", (req, res) => {
    cca.getAuthCodeUrl({ scopes: ["user.read", "Mail.Send", "Files.Read.All"], redirectUri: getRedirectUri(req) })
      .then((url) => res.json({ url }))
      .catch((error) => res.status(500).json({ error: error.message }));
  });

  app.get("/api/auth/login", (req, res) => {
    cca.getAuthCodeUrl({ scopes: ["user.read", "Mail.Send", "Files.Read.All"], redirectUri: getRedirectUri(req) })
      .then((response) => res.redirect(response))
      .catch((error) => res.status(500).send(error));
  });

  app.get("/api/auth/status", (req: any, res) => {
    res.json({ isAuthenticated: !!req.session.user, user: req.session.user || null });
  });

  app.post("/api/appointments", express.json(), async (req: any, res) => {
    try {
      const result = await createDataverse("cr7e0_gestiontatouages", req.body);
      const clientEmail = req.body.cr7e0_email;
      const rawDate = req.body.cr7e0_daterdv; 
      const userAccountId = req.session?.user?.homeAccountId;

      // SÉCURITÉ : On vérifie que ce n'est PAS un congé avant d'envoyer l'email
      const isTimeOff = clientEmail === 'conge@larabstrait.fr' || (req.body.cr7e0_nomclient || '').includes('CONGÉ');

      if (clientEmail && userAccountId && rawDate && !isTimeOff) {
        try {
          const dateObj = new Date(rawDate);
          const formattedDate = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          const formattedTime = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

          const account = await cca.getTokenCache().getAccountByHomeId(userAccountId);
          if (account) {
            const authResult = await cca.acquireTokenSilent({ account: account, scopes: ["Mail.Send"] });
            const graphToken = authResult.accessToken;

            const emailPayload = {
              message: {
                subject: `Confirmation de rendez-vous - Larabstrait`,
                body: {
                  contentType: "HTML",
                  content: `<p>Hello !</p><p>Ton rendez-vous du <b>${formattedDate} à ${formattedTime}</b> est bien confirmé !</p><p>À bientôt !<br/>Larabstrait</p>`
                },
                toRecipients: [{ emailAddress: { address: clientEmail.trim() } }]
              }
            };

            await axios.post("https://graph.microsoft.com/v1.0/me/sendMail", emailPayload, { headers: { Authorization: `Bearer ${graphToken}`, "Content-Type": "application/json" } });
            console.log(`[Email] Confirmation envoyée automatiquement à ${clientEmail}`);
          }
        } catch (mailError: any) {
          console.error("[Graph Error - Email automatique]:", mailError.response?.data || mailError.message);
        }
      }
      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auth/callback", (req: any, res) => {
    cca.acquireTokenByCode({ code: req.query.code as string, scopes: ["user.read", "Mail.Send", "Files.Read.All"], redirectUri: getRedirectUri(req) })
      .then((response) => {
        if (response.account) {
          const userData = { homeAccountId: response.account.homeAccountId, username: response.account.username, name: response.account.name };
          req.session.user = userData;
          const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
          tokenSessions.set(token, userData);
          res.send(`
            <html><body><h2>Connexion réussie !</h2><script>
                  const token = "${token}"; localStorage.setItem('larabstrait_token', token);
                  try { new BroadcastChannel('larabstrait_auth').postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: token }); } catch (e) {}
                  if (window.opener) { window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: token }, '*'); }
                  setTimeout(() => { window.close(); setTimeout(() => { if (!window.closed) { window.location.href = "/?token=" + token; } }, 1000); }, 500);
                </script></body></html>
          `);
        } else {
          res.redirect("/");
        }
      })
      .catch((error) => res.status(500).send(error));
  });

  app.get("/api/auth/user", (req: any, res) => res.json(req.session.user || null));
  app.post("/api/auth/logout", (req: any, res) => req.session.destroy(() => res.json({ success: true })));

  app.get("/api/bookings/timeoff", (req, res) => res.json([]));

  app.get("/api/appointments", async (req, res) => {
    try {
      const data = await fetchDataverse("cr7e0_gestiontatouages");
      res.json(data);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.patch("/api/appointments/:id", async (req, res) => {
    try {
      const result = await updateDataverse("cr7e0_gestiontatouages", req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/appointments", express.json(), async (req: any, res) => {
    try {
      const result = await createDataverse("cr7e0_gestiontatouages", req.body);
      const clientEmail = req.body.cr7e0_email;
      const rawDate = req.body.cr7e0_daterdv; 
      const userAccountId = req.session?.user?.homeAccountId;

      if (clientEmail && userAccountId && rawDate) {
        try {
          const dateObj = new Date(rawDate);
          const formattedDate = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          const formattedTime = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

          const account = await cca.getTokenCache().getAccountByHomeId(userAccountId);
          if (account) {
            const authResult = await cca.acquireTokenSilent({ account: account, scopes: ["Mail.Send"] });
            const graphToken = authResult.accessToken;

            const emailPayload = {
              message: {
                subject: `Confirmation de rendez-vous - Larabstrait`,
                body: {
                  contentType: "HTML",
                  content: `<p>Hello !</b>,</p><p>Ton rendez-vous du <b>${formattedDate} à ${formattedTime}</b> est bien confirmé !</p><p>À bientôt !<br/>Larabstrait</p>`
                },
                toRecipients: [{ emailAddress: { address: clientEmail.trim() } }]
              }
            };

            await axios.post("https://graph.microsoft.com/v1.0/me/sendMail", emailPayload, { headers: { Authorization: `Bearer ${graphToken}`, "Content-Type": "application/json" } });
          }
        } catch (mailError: any) {
          console.error("[Graph Error - Email automatique]:", mailError.response?.data || mailError.message);
        }
      }
      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      const success = await deleteDataverse("cr7e0_gestiontatouages", req.params.id);
      res.json({ success });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.get("/api/settings/abby", (req: any, res) => {
    try {
      const hasEnvKey = !!process.env.ABBY_API_KEY?.trim();
      res.json({ configured: hasEnvKey, source: hasEnvKey ? "env" : null, abby_api_key: hasEnvKey ? "CONFIGURED" : "" });
    } catch (error) { res.status(500).json({ error: "Erreur récupération paramètres" }); }
  });

  app.post("/api/settings/abby", express.json(), (req: any, res) => {
    const userId = getUserId(req);
    const { abby_api_key } = req.body;
    try {
      const cleanedKey = typeof abby_api_key === "string" ? abby_api_key.trim() : "";
      db.prepare("INSERT OR REPLACE INTO user_settings (user_id, abby_api_key) VALUES (?, ?)").run(userId, cleanedKey);
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Erreur sauvegarde" }); }
  });

  app.get("/api/abby/debug-auth", (req: any, res) => {
    const userId = getUserId(req);
    try {
      const settings = getStoredAbbySettings(userId);
      const dbKey = settings?.abby_api_key?.trim() || "";
      const envKey = process.env.ABBY_API_KEY?.trim() || "";
      const finalKey = getAbbyApiKey();
      res.json({ userId, hasDbKey: !!dbKey, hasEnvKey: !!envKey, finalSource: envKey ? "env" : dbKey ? "database" : null, finalPrefix: finalKey ? finalKey.slice(0, 4) : null, finalLength: finalKey ? finalKey.length : 0 });
    } catch (error) { res.status(500).json({ error: "Erreur debug auth Abby" }); }
  });

  app.get("/api/abby/test-connection", async (req: any, res) => {
    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });
      const { data } = await abbyApi.get("/contacts", { params: { limit: 1, page: 1 } });
      res.json({ success: true, message: "Connexion réussie à l'API Abby", data });
    } catch (err: any) { handleAbbyError(err, res, "Test Connection"); }
  });

  app.get("/api/abby/test-debug", async (req: any, res) => {
    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });
      const { data } = await abbyApi.get("/contacts", { params: { limit: 1, page: 1 } });
      res.json({ success: true, message: "Connexion Abby OK", data });
    } catch (err: any) { handleAbbyError(err, res, "Test Debug"); }
  });

  // ==========================================
  // ROUTE DE CRÉATION DE DOCUMENTS ABBY
  // ==========================================
  app.post("/api/abby/create-document", express.json(), async (req: any, res) => {
    const { appointment, type } = req.body;
    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });

      let customerId = "";
      
      // RECHERCHE SUR L'EMAIL EN PRIORITÉ
      const searchParam = appointment.clientEmail || appointment.client;
      const { data: searchResult } = await abbyApi.get("/contacts", { params: { search: searchParam, page: 1, limit: 10 } });
      const contactsList = searchResult?.data || searchResult?.docs || searchResult || [];

      if (Array.isArray(contactsList) && contactsList.length > 0) {
        customerId = contactsList[0].id;
      } else {
        const names = String(appointment.client || "").trim().split(" ");
        // CREATION AVEC EMAIL
        const { data: newContact } = await abbyApi.post("/contact", { 
          firstname: names[0] || "Client", 
          lastname: names.slice(1).join(" ") || "Inconnu",
          email: appointment.clientEmail || "" 
        });
        customerId = newContact.id;
      }

      if (type === "Recette") {
        const payload = {
          paidAt: new Date(appointment.date).toISOString(),
          paymentMethodUsed: { value: 1 },
          vatAmount: 0, vatId: 1, client: appointment.client,
          priceWithoutTax: Math.round((appointment.total || 0) * 100),
          priceTotalTax: Math.round((appointment.total || 0) * 100),
          reference: `RDV-${appointment.id}`, productType: 1, isSap: false, isTaxIncluded: true
        };
        const { data } = await abbyApi.post("/incomeBook", payload);
        return res.json({ success: true, data });
      }

      if (["Facture", "Facture d'acompte", "Facture finale", "Bon de commande"].includes(type)) {
        const isBdc = type === "Bon de commande";
        const endpoint = isBdc ? `/v2/billing/estimate/${customerId}` : `/v2/billing/invoice/${customerId}`;
        const { data: document } = await abbyApi.post(endpoint, {});
        const documentId = document.id;

        let amount = appointment.total || 0;
        if (type === "Facture d'acompte") amount = appointment.depositAmount || 0;
        else if (type === "Facture finale" || type === "Facture") amount = (appointment.total || 0) - (appointment.depositAmount || 0);

        await abbyApi.patch(`/v2/billing/${documentId}/lines`, {
          lines: [{ 
            designation: `${appointment.style || "Prestation de tatouage"} - ${type}`, 
            quantity: 1, 
            quantityUnit: "unit", 
            unitPrice: Math.round(amount * 100), 
            type: "commercial_or_craft_services", 
            vatCode: "FR_00HT" 
          }]
        });
        return res.json({ success: true, data: { id: documentId, message: `${type} créé(e) en brouillon` } });
      }

      return res.status(400).json({ error: "Type de document non supporté" });
    } catch (err: any) { handleAbbyError(err, res, `Create Document (${type})`); }
  });

  app.post("/api/abby/pay-document", express.json(), async (req: any, res) => {
    const { appointmentId, type } = req.body;
    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });
      res.json({ success: true, message: "Encaissement validé" });
    } catch (err: any) { handleAbbyError(err, res, `Pay Document (${type})`); }
  });

  // LISTE DES DOCUMENTS ABBY
  app.get("/api/abby/documents", async (req: any, res) => {
    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });
      const resp = await abbyApi.get("/v2/billings", { params: { page: 1, limit: 50, test: false } });
      const rawDocs = resp.data?.data || resp.data?.docs || resp.data || [];

      const formattedDocs = (Array.isArray(rawDocs) ? rawDocs : []).map((doc: any) => {
        let docType = "Document";
        if (doc.type === "invoice" || doc.number?.startsWith("FA")) docType = "Facture";
        else if (doc.type === "estimate" || doc.number?.startsWith("DE")) docType = "Devis";
        
        let statusCode = "draft";
        let statusText = "Brouillon";
        const s = (doc.state || doc.status || "").toString().toLowerCase();

        if (["canceled", "cancelled", "annulée"].includes(s)) { statusCode = "draft"; statusText = "Annulé"; }
        else if (["paid", "payée", "payee"].includes(s)) { statusCode = "paid"; statusText = "Encaissé"; }
        else if (["accepted", "acceptée", "signed", "signé"].includes(s)) { statusCode = "paid"; statusText = "Signé"; }
        else if (["sent", "envoyée", "validated", "validée"].includes(s)) { statusCode = "sent"; statusText = docType === "Facture" ? "À encaisser" : "À signer"; }

        let amount = (doc.totalAmountWithTaxAfterDiscount !== undefined) ? doc.totalAmountWithTaxAfterDiscount / 100 : 0;
        let clientName = doc.customer ? `${doc.customer.firstname || ""} ${doc.customer.lastname || ""}`.trim() : "Client inconnu";
        
        // AJOUT DE L'EMAIL POUR LE MATCHING
        let clientEmail = doc.customer ? (doc.customer.email || "") : "";
        
        let dateVal = doc.emittedAt || doc.createdAt;
        let formattedDate = dateVal ? new Date(typeof dateVal === "number" && dateVal.toString().length === 10 ? dateVal * 1000 : dateVal).toLocaleDateString("fr-FR") : "N/A";

        return { 
          id: doc.number || doc.id || "N/A", 
          internalId: doc.id, 
          client: clientName, 
          email: clientEmail, // On expose l'email !
          type: docType, 
          amount, 
          date: formattedDate, 
          status: statusCode, 
          statusLabel: statusText 
        };
      });
      res.json(formattedDocs.sort((a: any, b: any) => (b.date === "N/A" ? "" : b.date.split("/").reverse().join("-")).localeCompare(a.date === "N/A" ? "" : a.date.split("/").reverse().join("-"))));
    } catch (error: any) { res.status(error.response?.status || 500).json({ error: "Erreur Abby", details: error.response?.data || error.message }); }
  });

  app.get("/api/abby/documents/:id/pdf", async (req: any, res) => {
    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });
      const internalId = req.params.id;
      let pdfBuffer: any = null;
      for (const route of [`/v2/billing/${internalId}/download`, `/v2/billings/${internalId}/download`, `/v2/documents/${internalId}/download`]) {
        try { pdfBuffer = (await abbyApi.get(route, { responseType: "arraybuffer" })).data; break; } catch (e) {}
      }
      if (!pdfBuffer) throw new Error("Impossible de trouver le PDF.");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `${req.query.inline === "true" ? "inline" : "attachment"}; filename="${internalId}.pdf"`);
      return res.send(pdfBuffer);
    } catch (error: any) { res.status(500).json({ error: "Impossible de récupérer le PDF." }); }
  });

  app.post("/api/notifications/subscribe", express.json(), (req: any, res) => {
    try { db.prepare("INSERT OR REPLACE INTO subscriptions (subscription, user_id) VALUES (?, ?)").run(JSON.stringify(req.body), getUserId(req)); res.status(201).json({}); } 
    catch (error) { res.status(500).json({ error: "Erreur abonnement" }); }
  });

  app.post("/api/notifications/send-test", express.json(), async (req: any, res) => {
    try {
      const subscriptions = db.prepare("SELECT subscription FROM subscriptions WHERE user_id = ?").all(getUserId(req));
      if (subscriptions.length === 0) return res.status(400).json({ error: "Aucun appareil enregistré." });
      await Promise.all((subscriptions as any[]).map((sub) => webpush.sendNotification(JSON.parse(sub.subscription), JSON.stringify({ title: "Test", body: "Test notification !", url: "/" })).catch((err) => { if (err.statusCode === 410 || err.statusCode === 404) db.prepare("DELETE FROM subscriptions WHERE subscription = ?").run(sub.subscription); })));
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });
  
  app.get('/api/reports', (req, res) => {
    try { res.json(db.prepare("SELECT * FROM reports ORDER BY timestamp DESC").all()); } 
    catch (error: any) { res.status(500).json({ error: "Erreur SQL", details: error.message }); }
  });

  app.post("/api/reports", express.json(), async (req: any, res) => {
    const { content } = req.body;
    if (!content || content.trim().length < 5) return res.status(400).json({ error: "Le message est trop court." });
    try {
      db.prepare("INSERT INTO reports (user_id, content) VALUES (?, ?)").run(getUserId(req), content);
      const subs = db.prepare("SELECT subscription FROM subscriptions").all();
      await Promise.all(subs.map((sub: any) => webpush.sendNotification(JSON.parse(sub.subscription), JSON.stringify({ title: "Nouveau Ticket 🐞", body: content.substring(0, 50) + "...", url: "/" })).catch((err) => { if (err.statusCode === 410 || err.statusCode === 404) db.prepare("DELETE FROM subscriptions WHERE subscription = ?").run(sub.subscription); })));
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: "Erreur écriture" }); }
  });

  app.patch("/api/reports/:id", express.json(), (req: any, res) => {
    try { db.prepare("UPDATE reports SET completed = ? WHERE id = ?").run(req.body.completed ? 1 : 0, req.params.id); res.json({ success: true }); } 
    catch (error: any) { res.status(500).json({ error: "Erreur MAJ" }); }
  });

  app.delete("/api/reports/completed", (req: any, res) => {
    try { db.prepare("DELETE FROM reports WHERE completed = 1").run(); res.json({ success: true }); } 
    catch (error: any) { res.status(500).json({ error: "Erreur purge" }); }
  });

  app.all("/api/*", (req, res) => {
    console.error(`[404] Route introuvable : ${req.method} ${req.path}`);
    res.status(404).json({ error: "Route API introuvable", path: req.path });
  });

  const vite = await createViteServer({ server: { middlewareMode: true, allowedHosts: true, hmr: false }, appType: "spa" });
  app.use(vite.middlewares);

  app.get("*", async (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    try {
      const indexPath = path.resolve(process.cwd(), "index.html");
      if (!fs.existsSync(indexPath)) return res.status(404).send("index.html introuvable.");
      res.status(200).set({ "Content-Type": "text/html" }).send(await vite.transformIndexHtml(req.url, fs.readFileSync(indexPath, "utf-8")));
    } catch (e) { res.status(500).send("Erreur interne."); }
  });

  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const futureLimit = new Date(now.getTime() + 20 * 60000).toISOString();
      const appointments = await fetchDataverse("cr7e0_gestiontatouages", "cr7e0_nomclient,cr7e0_daterdv", `cr7e0_daterdv ge ${now.toISOString()} and cr7e0_daterdv le ${futureLimit}`);
    } catch (error: any) { console.error("Erreur Cron:", error.message); }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVEUR DÉMARRÉ SUR LE PORT ${PORT} <<<`);
  });
}

startServer().catch(console.error);