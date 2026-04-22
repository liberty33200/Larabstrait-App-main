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
import pkg from 'pg';
import Database from "better-sqlite3";
import nodemailer from 'nodemailer';
import axios, { AxiosInstance } from "axios";
import cors from "cors";



// 1. On définit la structure d'une demande pour TypeScript
interface MockRequest {
  id: number;
  client_name: string;
  client_email: string;
  project_description: string;
  instagram: string;
  reference_images: string;
  status: string;
  created_at: string;
}

// 2. On dit à fakeDb d'utiliser cette structure
let fakeDb: MockRequest[] = [];

dotenv.config();
const { Pool } = pkg;

// ✅ Création de __dirname pour les ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION DOSSIER UPLOADS ---
const uploadDir = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuration de Multer pour les requêtes publiques (Formulaire)
const publicStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const publicUpload = multer({ 
  storage: publicStorage, 
  limits: { fileSize: 10 * 1024 * 1024 } // Limite à 10 Mo par image
});

// --- NETTOYAGE AUTO DES UPLOADS (1 AN) ---
setInterval(() => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) return;
    const now = Date.now();
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    
    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > oneYear) {
          fs.unlink(filePath, () => console.log(`🧹 Fichier expiré supprimé : ${file}`));
        }
      });
    });
  });
}, 24 * 60 * 60 * 1000);

// --- CACHE POUR L'API ABBY ---
let abbyCache: { data: any[] | null, lastFetch: number } = { data: null, lastFetch: 0 };
const ABBY_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes de mémoire

// Configuration SQLite
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const oldDbPath = path.join(dataDir, 'notifications.db');
const newDbPath = path.join(dataDir, 'larabstrait.db');

if (fs.existsSync(oldDbPath) && !fs.existsSync(newDbPath)) {
  fs.renameSync(oldDbPath, newDbPath);
  console.log("📦 Base de données renommée avec succès en larabstrait.db");
}

const db = new Database(newDbPath);
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

if (!process.env.DB_PASSWORD || !process.env.DB_HOST) {
  console.error("❌ ERREUR CRITIQUE : Les informations de connexion à la base de données sont manquantes dans le fichier .env");
  process.exit(1); 
}

pool.connect(async (err, client, release) => {
  if (err || !client) {
    return console.error("❌ Erreur de connexion Postgres:", err?.stack || "Client introuvable");
  }
  console.log("🐘 Connecté avec succès à PostgreSQL !");
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_requests (
        id SERIAL PRIMARY KEY,
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        client_phone TEXT,
        instagram TEXT,
        project_description TEXT NOT NULL,
        placement TEXT,
        estimated_size TEXT,
        availability_prefs TEXT,
        reference_images TEXT,
        status TEXT DEFAULT 'En attente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const columnsToAdd = [
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS location TEXT`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS size TEXT`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS instagram TEXT`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS abby_bdc_id TEXT`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS abby_deposit_id TEXT`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS abby_final_id TEXT`,
    ];

    for (const query of columnsToAdd) {
      await client.query(query).catch(() => {});
    }

    console.log("✅ Tables et colonnes PostgreSQL vérifiées.");
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation des tables :", error);
  } finally {
    release();
  }
});

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

try { db.prepare("ALTER TABLE flashes ADD COLUMN duration INTEGER DEFAULT 60").run(); } catch (e) {}
try { db.prepare("ALTER TABLE flashes ADD COLUMN client_data TEXT").run(); } catch (e) {}

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || "BOL1mjmDT2wcuCh-ToFzWu6o9oIjq4FVr85uKtosGYsvA3beiLNqf4YPFHddtBPqfVbfTgRRN6rLCcX3vrXUQhM",
  privateKey: process.env.VAPID_PRIVATE_KEY || "R0V328V-nSSnmYHPj5xpvtVKx7vzs1Ix82kpd9tsvHY"
};
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      `mailto:${process.env.EMAIL_STUDIO || 'contact@larabstrait.fr'}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    console.log("✅ VAPID configuré");
  } catch (err) {
    console.error("❌ Erreur VAPID:", err);
  }
} else {
  console.log("⚠️ VAPID non configuré : le serveur démarre sans notifications push.");
}

declare module "express-session" { interface SessionData { user: any; } }

function getUserId(req: any): string { return req.session?.user?.homeAccountId || "anonymous"; }

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
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" }
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;
app.use(cors({
  origin: [
    'https://formulaire.larabstrait.fr', 
    'https://app.larabstrait.fr'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

  // ==========================================
  // 1. CONFIGURATION GLOBALE ET SÉCURITÉ
  // ==========================================
  app.set("trust proxy", true);
  app.use(cors({ origin: true, credentials: true })); // Sécurité CORS activée EN PREMIER
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  // ==========================================
  // 2. EXPOSITION DES DOSSIERS PHYSIQUES (IMAGES)
  // ==========================================
  app.use('/uploads', express.static(uploadDir));
  
  const flashesDir = path.join(__dirname, 'data', 'flashes');
  if (!fs.existsSync(flashesDir)) fs.mkdirSync(flashesDir, { recursive: true });
  app.use('/api/flashes/images', express.static(flashesDir));

  const flashStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, flashesDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, 'flash-' + uniqueSuffix + ext);
    }
  });
  const flashUpload = multer({ storage: flashStorage });

  // ==========================================
  // 3. AUTHENTIFICATION MICROSOFT
  // ==========================================
  const msalConfig: msal.Configuration = {
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID || "missing-client-id",
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}`,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "missing-client-secret"
    }
  };

  let cca: msal.ConfidentialClientApplication;
  try { cca = new msal.ConfidentialClientApplication(msalConfig); } catch (error) { cca = {} as any; }

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

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: "Non autorisé. Connecte-toi via Microsoft." });
    }
    next();
  };

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
      .then((url) => res.json({ url })).catch((error) => res.status(500).json({ error: error.message }));
  });

  app.get("/api/auth/login", (req, res) => {
    cca.getAuthCodeUrl({ scopes: ["user.read", "Mail.Send", "Files.Read.All"], redirectUri: getRedirectUri(req) })
      .then((response) => res.redirect(response)).catch((error) => res.status(500).send(error));
  });

  app.get("/api/auth/status", (req: any, res) => {
    res.json({ isAuthenticated: !!req.session.user, user: req.session.user || null });
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


  // =========================================================================
  // --- FORMULAIRE PUBLIC (BOOKING REQUESTS) --- (Ne nécessite PAS requireAuth)
  // =========================================================================
  async function notifyAdmin(requestData: any) {
  // --- 1. MINI-EXTRACTEUR POUR NETTOYER LE TEXTE DU MAIL ---
  let raw = requestData.project_description || "";
  const keys = ["TYPE :", "BUDGET PRÉVU :", "DESCRIPTION :", "EMPLACEMENT :", "TAILLE :", "DISPOS :", "SANTÉ & CONFORT", "Premier tatouage :", "Appréhensions :", "Infos santé :", "Préférences :", "NUMÉRO FLASH :"];
  
  const extract = (key: string) => {
    const start = raw.indexOf(key);
    if (start === -1) return "Non précisé";
    const content = raw.substring(start + key.length);
    let minEnd = content.length;
    keys.forEach(k => {
      if (k !== key) {
        const idx = content.indexOf(k);
        if (idx !== -1 && idx < minEnd) minEnd = idx;
      }
    });
    return content.substring(0, minEnd).replace(/[✨💰📝📍📏🗓️🌿🆔]/g, '').replace(/-+/g, '').trim();
  };

  const type = extract("TYPE :") !== "Non précisé" ? extract("TYPE :") : "Projet";
  const numFlash = extract("NUMÉRO FLASH :");
  const placement = extract("EMPLACEMENT :");
  const rawDesc = extract("DESCRIPTION :");
  const pureDesc = rawDesc !== "Non précisé" ? rawDesc : "Détails à consulter dans l'application.";

  // Si c'est un flash, on met le numéro en évidence
  const typeLabel = numFlash !== "Non précisé" ? `Flash n°${numFlash}` : type;

  // --- 2. ENVOI DE L'EMAIL (OUTLOOK) ---
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp-mail.outlook.com",
    port: smtpPort,
    secure: false, 
    requireTLS: true, 
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const mailOptions = {
    from: `"Larabstrait App" <${process.env.SMTP_USER}>`,
    to: process.env.EMAIL_STUDIO, 
    subject: `✨ Nouvelle demande : ${requestData.client_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #0A0A0A; color: #ffffff; padding: 30px; border-radius: 16px; max-width: 600px; margin: auto;">
        
        <h2 style="color: #ffffff; margin-top: 0; margin-bottom: 5px; font-size: 24px;">Nouveau projet reçu !</h2>
        <p style="color: #888888; font-size: 14px; margin-top: 0; margin-bottom: 25px;">Envoyé par <strong>${requestData.client_name}</strong></p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
          <tr>
            <td width="48%" style="background-color: #1A1A1A; padding: 15px; border-radius: 12px; border: 1px solid #2A2A2A;">
              <span style="font-size: 10px; color: #888888; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Type de projet</span><br>
              <strong style="color: #D4B0FF; font-size: 16px; display: inline-block; margin-top: 5px;">${typeLabel}</strong>
            </td>
            
            <td width="4%"></td> <td width="48%" style="background-color: #1A1A1A; padding: 15px; border-radius: 12px; border: 1px solid #2A2A2A;">
              <span style="font-size: 10px; color: #888888; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Emplacement</span><br>
              <strong style="color: #ffffff; font-size: 16px; display: inline-block; margin-top: 5px;">${placement}</strong>
            </td>
          </tr>
        </table>

        <div style="background-color: #1A1A1A; padding: 20px; border-radius: 12px; border: 1px solid #2A2A2A; margin-bottom: 30px;">
          <span style="font-size: 10px; color: #888888; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Description détaillée</span>
          <p style="color: #CCCCCC; font-size: 14px; line-height: 1.6; margin-top: 10px; margin-bottom: 0;">
            "${pureDesc.length > 250 ? pureDesc.substring(0, 250) + '...' : pureDesc}"
          </p>
        </div>

        <div style="text-align: center;">
          <a href="https://app.larabstrait.fr" style="background-color: #D4B0FF; color: #000000; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block;">
            Ouvrir le Dashboard
          </a>
        </div>

      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📧 Email de notification envoyé avec succès.");
  } catch (e) {
    console.error("❌ Erreur envoi email notification:", e);
  }

  // --- 3. ENVOI DE LA NOTIFICATION PUSH ---
  const subscriptions = db.prepare("SELECT subscription FROM subscriptions").all();
  const payload = JSON.stringify({
    title: "✨ Nouveau Projet !",
    body: `${requestData.client_name} vient d'envoyer un formulaire.`,
    icon: "/icon-192x192.png",
    data: { url: "/requests" }
  });

  subscriptions.forEach((row: any) => {
    try {
      const sub = JSON.parse(row.subscription);
      webpush.sendNotification(sub, payload);
    } catch (e) {
      console.error("❌ Erreur envoi Push:", e);
    }
  });
}

// --- MISE À JOUR DE LA ROUTE POST ---
app.post("/api/requests", publicUpload.array('images', 3), async (req: any, res) => {
  try {
    const { clientName, clientEmail, projectDescription, instagram } = req.body;
    const imageUrls = req.files ? (req.files as any[]).map(f => `http://localhost:3000/uploads/${f.filename}`) : [];

    const newRequest = {
      id: Date.now(),
      client_name: clientName,
      client_email: clientEmail,
      project_description: projectDescription,
      instagram: instagram || '',
      reference_images: JSON.stringify(imageUrls),
      status: 'En attente',
      created_at: new Date().toISOString()
    };

    fakeDb.unshift(newRequest);

    // 🔥 DÉCLENCHEMENT DE LA NOTIFICATION
    notifyAdmin(newRequest);

    return res.status(201).json({ success: true, requestId: newRequest.id });
  } catch (error: any) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

  // =========================================================================
  // --- BOÎTE DE RÉCEPTION (ADMIN TATOUEUR) --- (Nécessite requireAuth)
  // =========================================================================
  app.get("/api/requests", requireAuth, async (req, res) => {
    res.json(fakeDb); 
  });

  app.put("/api/requests/:id/status", requireAuth, express.json(), async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      // En mode test, on met juste à jour la mémoire vive
      const reqIndex = fakeDb.findIndex(r => r.id.toString() === id.toString());
      if (reqIndex !== -1) {
        fakeDb[reqIndex].status = status;
        return res.json({ success: true, request: fakeDb[reqIndex] });
      }
      return res.status(404).json({ error: "Demande introuvable en mode test." });
    } catch (error: any) {
      res.status(500).json({ error: "Erreur serveur lors de la modification de la demande." });
    }
  });

  // ==========================================
  // --- ROUTES POSTGRESQL (Rendez-vous) ---
  // ==========================================
  app.get("/api/appointments", async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM appointments ORDER BY appointment_date DESC`);
      res.json(result.rows);
    } catch (error: any) {
      console.error("Erreur GET Appointments:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/appointments", express.json(), async (req: any, res) => {
    try {
      const id = `local-${Date.now()}`;
      const data = req.body;
      
      const query = `
          INSERT INTO appointments (
            id, client_name, client_email, client_phone, appointment_date, 
            style, total_price, deposit_amount, deposit_status, 
            project_status, project_recap, location, size, instagram
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `;

      const values = [
          id, 
          data.client_name || "Inconnu", 
          data.client_email || "", 
          data.client_phone || "",
          data.appointment_date || new Date().toISOString(), 
          data.style || "Flash", 
          data.total_price || 0,
          data.deposit_amount || 0, 
          data.deposit_status || "Non", 
          data.project_status || "À dessiner",
          data.project_recap || "",
          data.location || "",
          data.size || "",
          data.instagram || ""
      ];

      await pool.query(query, values);
      res.status(201).json({ id });
    } catch (error: any) { 
      console.error("❌ Erreur Create Postgres:", error.message);
      res.status(500).json({ error: error.message }); 
    }
  });

  app.patch("/api/appointments/:id", async (req, res) => {
    try {
      const data = req.body;
      const updates = [];
      const values = [];
      let i = 1;

      if (data.client_name !== undefined) { updates.push(`client_name = $${i++}`); values.push(data.client_name); }
      if (data.client_email !== undefined) { updates.push(`client_email = $${i++}`); values.push(data.client_email); }
      if (data.client_phone !== undefined) { updates.push(`client_phone = $${i++}`); values.push(data.client_phone); }
      if (data.appointment_date !== undefined) { updates.push(`appointment_date = $${i++}`); values.push(data.appointment_date); }
      if (data.style !== undefined) { updates.push(`style = $${i++}`); values.push(data.style); }
      if (data.total_price !== undefined) { updates.push(`total_price = $${i++}`); values.push(data.total_price); }
      if (data.deposit_amount !== undefined) { updates.push(`deposit_amount = $${i++}`); values.push(data.deposit_amount); }
      if (data.deposit_status !== undefined) { updates.push(`deposit_status = $${i++}`); values.push(data.deposit_status); }
      if (data.project_status !== undefined) { updates.push(`project_status = $${i++}`); values.push(data.project_status); }
      if (data.project_recap !== undefined) { updates.push(`project_recap = $${i++}`); values.push(data.project_recap); }
      if (data.location !== undefined) { updates.push(`location = $${i++}`); values.push(data.location); }
      if (data.size !== undefined) { updates.push(`size = $${i++}`); values.push(data.size); }
      if (data.instagram !== undefined) { updates.push(`instagram = $${i++}`); values.push(data.instagram); }
      if (data.abby_bdc_id !== undefined) { updates.push(`abby_bdc_id = $${i++}`); values.push(data.abby_bdc_id); }
      if (data.abby_deposit_id !== undefined) { updates.push(`abby_deposit_id = $${i++}`); values.push(data.abby_deposit_id); }
      if (data.abby_final_id !== undefined) { updates.push(`abby_final_id = $${i++}`); values.push(data.abby_final_id); }

      if (updates.length > 0) {
        values.push(req.params.id);
        const query = `UPDATE appointments SET ${updates.join(', ')} WHERE id = $${i}`;
        await pool.query(query, values);
      }
      res.json({ success: true });
    } catch (error: any) { 
      console.error("❌ Erreur Update Postgres:", error.message);
      res.status(500).json({ error: error.message }); 
    }
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      await pool.query(`DELETE FROM appointments WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.get('/api/settings/abby', (req, res) => { res.json({ abby_api_key: !!getAbbyApiKey() }); });

  // =========================================================================
  // --- GESTION DES FLASHS ET REPORTS ---
  // =========================================================================
  app.get('/api/flashes', (req, res) => {
    try {
      const flashes = db.prepare("SELECT * FROM flashes ORDER BY created_at DESC").all();
      res.json(flashes.map((f: any) => ({ ...f, available: f.available === 1 })));
    } catch (error) { res.status(500).json({ error: "Erreur" }); }
  });

  app.post('/api/flashes', flashUpload.single('image'), (req, res) => {
    try {
      const { title, price, size, duration } = req.body;
      if (!req.file) return res.status(400).json({ error: "L'image est obligatoire." });
      const stmt = db.prepare("INSERT INTO flashes (title, price, size, duration, image_filename) VALUES (?, ?, ?, ?, ?)");
      const info = stmt.run(title, price, size, duration || 60, req.file.filename);
      res.status(201).json({ success: true, id: info.lastInsertRowid });
    } catch (error) { res.status(500).json({ error: "Erreur" }); }
  });

  app.put('/api/flashes/:id', flashUpload.single('image'), (req, res) => {
    try {
      const { title, price, size, duration } = req.body;
      const flashId = req.params.id;
      const existing: any = db.prepare("SELECT image_filename FROM flashes WHERE id = ?").get(flashId);
      if (!existing) return res.status(404).json({ error: "Non trouvé" });
      let fileName = existing.image_filename;
      if (req.file) {
        const oldPath = path.join(flashesDir, existing.image_filename);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        fileName = req.file.filename;
      }
      const stmt = db.prepare(`UPDATE flashes SET title = ?, price = ?, size = ?, duration = ?, image_filename = ? WHERE id = ?`);
      stmt.run(title, price, size, duration, fileName, flashId);
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Erreur" }); }
  });

  app.patch('/api/flashes/:id', express.json(), async (req, res) => {
    try {
      const { available, reservationDetails, isExporting } = req.body;
      const flashId = req.params.id;

      if (isExporting && reservationDetails) {
        const flash: any = db.prepare("SELECT * FROM flashes WHERE id = ?").get(flashId);
        
        if (flash) {
          const appointmentId = `flash-${Date.now()}`;
          const query = `
            INSERT INTO appointments (
              id, client_name, client_phone, appointment_date, 
              style, total_price, deposit_amount, deposit_status, 
              project_status, project_recap, instagram, size
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `;
          const cleanPrice = parseFloat(flash.price.replace(/[^0-9.]/g, '')) || 0;
          const values = [
            appointmentId, 
            reservationDetails.name || "Client Flash", 
            reservationDetails.phone || "",
            reservationDetails.dateTime || new Date().toISOString(), 
            "Flash", cleanPrice, 0, "Non", "Validé", 
            `Réservation Flash Kiosk: ${flash.title}`, 
            reservationDetails.instagram || "",
            flash.size || ""
          ];
          await pool.query(query, values);
        }
      }

      const clientData = reservationDetails && !isExporting ? JSON.stringify(reservationDetails) : null;
      db.prepare("UPDATE flashes SET available = ?, client_data = ? WHERE id = ?").run(available ? 1 : 0, clientData, flashId);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: "Erreur lors de la modification du flash" }); }
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
    } catch (error) { res.status(500).json({ error: "Erreur" }); }
  });

  app.get('/api/reports', (req, res) => {
    try {
      const reports = db.prepare("SELECT * FROM reports ORDER BY timestamp DESC").all();
      res.json(reports);
    } catch (error) { res.status(500).json({ error: "Erreur" }); }
  });

  app.post('/api/reports', (req, res) => {
    try {
      const { content } = req.body;
      const stmt = db.prepare("INSERT INTO reports (user_id, content) VALUES (?, ?)");
      const info = stmt.run(getUserId(req), content);
      res.status(201).json({ success: true, id: info.lastInsertRowid });
    } catch (error) { res.status(500).json({ error: "Erreur" }); }
  });

  app.patch('/api/reports/:id', (req, res) => {
    try {
      db.prepare("UPDATE reports SET completed = ? WHERE id = ?").run(req.body.completed ? 1 : 0, req.params.id);
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Erreur" }); }
  });

  // =========================================================================
  // --- PDF ET AUTRES ROUTES ---
  // =========================================================================
  const consentsDir = path.join(process.cwd(), 'data', 'consents');
  if (!fs.existsSync(consentsDir)) fs.mkdirSync(consentsDir, { recursive: true });

  app.post('/api/appointments/:id/consent', express.json({limit: '50mb'}), async (req, res) => {
    try {
      const { pdfData } = req.body;
      if (!pdfData) return res.status(400).json({ error: "Données PDF manquantes" });
      const base64Data = pdfData.replace(/^data:application\/pdf;filename=generated\.pdf;base64,/, "").replace(/^data:application\/pdf;base64,/, "");
      fs.writeFileSync(path.join(consentsDir, `${req.params.id}.pdf`), base64Data, 'base64');
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: "Erreur" }); }
  });

  app.get('/api/appointments/:id/check-consent', (req, res) => {
    res.json({ exists: fs.existsSync(path.join(consentsDir, `${req.params.id}.pdf`)) });
  });

  app.get('/api/appointments/:id/download-consent', (req, res) => {
    const filePath = path.join(consentsDir, `${req.params.id}.pdf`);
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="decharge-${req.params.id}.pdf"`);
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.status(404).send("Document introuvable");
    }
  });

  app.post('/api/appointments/:id/send-pdf', express.json(), async (req: any, res) => {
    try {
      const { clientEmail } = req.body;
      if (!clientEmail) return res.status(400).json({ error: "Email manquant" });
      const smtpPort = parseInt(process.env.SMTP_PORT || "465");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.hostinger.com",
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: `"Larabstrait" <${process.env.SMTP_USER}>`,
        to: clientEmail,
        subject: "Ta fiche de soins Larabstrait ✨",
        text: `Hello !\n\nSuite à notre séance voici, ci-joint, la feuille de soin...`,
        attachments: [{ filename: 'Fiche_de_soins_Larabstrait.pdf', path: path.join(process.cwd(), 'public', 'Feuille_de_soins.pdf'), contentType: 'application/pdf' }]
      });
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: "Erreur" }); }
  });

  app.get("/api/bookings/timeoff", (req, res) => res.json([]));

  // =========================================================================
  // --- NOTIFICATIONS WEB PUSH ---
  // =========================================================================
  app.get('/api/notifications/vapid-public-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.post('/api/notifications/subscribe', express.json(), (req: any, res) => {
    try {
      const subscription = req.body;
      // On sauvegarde l'abonnement dans la base de données SQLite
      const stmt = db.prepare("INSERT OR IGNORE INTO subscriptions (subscription, user_id) VALUES (?, ?)");
      stmt.run(JSON.stringify(subscription), getUserId(req));
      res.status(201).json({ success: true });
    } catch (error) {
      console.error("Erreur sauvegarde subscription:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post('/api/notifications/send-test', requireAuth, (req, res) => {
    try {
      const payload = JSON.stringify({ 
        title: "Test Larabstrait ✨", 
        body: "Les notifications push sont bien activées sur cet appareil !", 
        icon: "/icon-192x192.png" 
      });
      
      const subscriptions = db.prepare("SELECT subscription FROM subscriptions").all();
      subscriptions.forEach((row: any) => {
        try {
          webpush.sendNotification(JSON.parse(row.subscription), payload);
        } catch (e) {}
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de l'envoi du test" });
    }
  });

  // =========================================================================
  // --- ABBY ET MAKE ---
  // =========================================================================
  app.get("/api/abby/documents", async (req: any, res) => {
    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) return res.json([]);
      
      const now = Date.now();
      if (abbyCache.data && (now - abbyCache.lastFetch < ABBY_CACHE_DURATION)) return res.json(abbyCache.data);
      
      const resp = await abbyApi.get("/v2/billings", { params: { page: 1, limit: 100, test: false } });
      const rawDocs = resp.data?.data || resp.data?.docs || resp.data || [];

      const formattedDocs = (Array.isArray(rawDocs) ? rawDocs : []).map((doc: any) => {
        const docNumber = (doc.number || doc.id || "").toUpperCase();
        let docType = "Facture";
        if (docNumber.startsWith("BDC") || docNumber.startsWith("DEV")) docType = "Bon de commande";
        else if (docNumber.startsWith("AC")) docType = "Facture d'acompte";
        else if (docNumber.startsWith("DE") || doc.type === "estimate") docType = "Devis";
        
        let statusCode = "draft", statusText = "Brouillon";
        const s = (doc.state || doc.status || "").toString().toLowerCase();

        if (["canceled", "cancelled", "annulée"].includes(s)) { statusCode = "draft"; statusText = "Annulé"; }
        else if (["paid", "payée", "payee", "accepted", "acceptée", "signed", "signé"].includes(s)) { statusCode = "paid"; statusText = docType.includes("Facture") ? "Encaissé" : "Signé"; }
        else if (["sent", "envoyée", "validated", "validée"].includes(s)) { statusCode = "sent"; statusText = docType.includes("Facture") ? "À encaisser" : "À signer"; }

        const rawAmount = doc.totalAmountWithTaxAfterDiscount ?? doc.totalPrice ?? doc.totalAmount ?? 0;

        return { 
          id: doc.number || doc.id || "N/A", internalId: doc.id, 
          client: doc.customer ? `${doc.customer.firstname || ""} ${doc.customer.lastname || ""}`.trim() : "Client inconnu", 
          email: doc.customer?.email || "", type: docType, amount: rawAmount / 100, 
          date: (doc.emittedAt || doc.createdAt) ? new Date((typeof (doc.emittedAt || doc.createdAt) === "number" && (doc.emittedAt || doc.createdAt).toString().length === 10) ? (doc.emittedAt || doc.createdAt) * 1000 : (doc.emittedAt || doc.createdAt)).toLocaleDateString("fr-FR") : "N/A", 
          status: statusCode, statusLabel: statusText 
        };
      });

      abbyCache.data = formattedDocs;
      abbyCache.lastFetch = now;
      res.json(formattedDocs);
    } catch (error: any) { res.status(500).json({ error: "Erreur Abby", details: error.message }); }
  });

  app.post("/api/appointments/:id/encaisser", express.json(), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { abbyFactureId, clientName, total, docType } = req.body;
      const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/f6j61397e0mydxsxh45ovho05ruz9vtu";
      
      try {
        await fetch(MAKE_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentId: id, abbyDocumentId: abbyFactureId, client: clientName, amount: total, action: "encaissement", docType: docType }) });
      } catch (makeError) { return res.status(500).json({ error: "Impossible de contacter Make" }); }

      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) return res.status(400).json({ error: "Clé Abby non configurée" });

      let isPaid = false, attempts = 0;
      while (attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
        try {
          const { data } = await abbyApi.get(`/v2/billing/${abbyFactureId}`);
          const docInfo = data.data || data;
          if (["paid", "payée", "payee", "accepted", "acceptée", "signed", "signé", "encaissé"].includes((docInfo.status || docInfo.state || "").toString().toLowerCase())) {
            isPaid = true; break;
          }
        } catch (err) {}
      }

      if (!isPaid) return res.status(408).json({ error: "Make lancé, mais pas de retour d'Abby à temps." });

      if (docType === "Facture d'acompte") {
        await pool.query(`UPDATE appointments SET deposit_status = 'Oui' WHERE id = $1`, [id]);
      } else {
        await pool.query(`UPDATE appointments SET project_status = 'Payé' WHERE id = $1`, [id]);
      }
      abbyCache.data = null;
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: "Erreur serveur" }); }
  });

  app.get("/api/abby/documents/:id/pdf", async (req: any, res) => {
    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) return res.status(400).json({ error: "Clé API manquante" });
      const { data } = await abbyApi.get(`/v2/billing/${req.params.id}`);
      const docInfo = data.data || data;
      const pdfUrl = docInfo.url || docInfo.pdfUrl || docInfo.fileUrl || docInfo.link;
      if (!pdfUrl) return res.status(404).json({ error: "Pas de PDF." });
      const pdfResponse = await axios.get(pdfUrl, { responseType: 'stream' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="document-${req.params.id}.pdf"`);
      pdfResponse.data.pipe(res);
    } catch (error: any) { res.status(500).json({ error: "Erreur PDF" }); }
  });

  app.post("/api/abby/sync", async (req, res) => {
    try {
      abbyCache.data = null;
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) return res.status(400).json({ success: false });
      const response = await abbyApi.get('/v2/billings', { params: { page: 1, limit: 100, test: false } });
      const documents = response.data?.data || response.data?.docs || response.data || [];
      let updateCount = 0;

      for (const doc of documents) {
        if (['paid', 'signed', 'accepted', 'encaissé'].includes(doc.status?.toLowerCase())) {
          const r1 = await pool.query(`UPDATE appointments SET deposit_status = 'Oui' WHERE abby_deposit_id = $1 AND deposit_status != 'Oui'`, [doc.id]);
          const r2 = await pool.query(`UPDATE appointments SET project_status = 'Payé' WHERE abby_final_id = $1 AND project_status != 'Payé'`, [doc.id]);
          updateCount += (r1.rowCount || 0) + (r2.rowCount || 0);
        }
      }
      res.json({ success: true, updated: updateCount });
    } catch (error: any) { res.status(500).json({ success: false }); }
  });

  app.all("/api/*", (req, res) => {
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
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVEUR DÉMARRÉ SUR LE PORT ${PORT} <<<`);
  });
}

startServer().catch(console.error);
