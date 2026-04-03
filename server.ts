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

dotenv.config();
const { Pool } = pkg;

// 1. On s'assure que le dossier "data" existe
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
  if (err) return console.error("❌ Erreur de connexion Postgres:", err.stack);
  console.log("🐘 Connecté avec succès à PostgreSQL !");
  
  // Sécurité : On s'assure que les colonnes ajoutées récemment existent bien dans PostgreSQL
  try {
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS location TEXT`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS size TEXT`);
    await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS instagram TEXT`);
  } catch (e) {
    // Les colonnes existent peut-être déjà, on ignore silencieusement
  }
  
  release();
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

webpush.setVapidDetails("mailto:florent.bidard@gmail.com", vapidKeys.publicKey, vapidKeys.privateKey);

declare module "express-session" { interface SessionData { user: any; } }

const isProd = process.env.NODE_ENV === "production";

function getUserId(req: any): string { return req.session?.user?.homeAccountId || "anonymous"; }
function getStoredAbbySettings(userId: string) { return db.prepare("SELECT abby_api_key FROM user_settings WHERE user_id = ?").get(userId) as any; }

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

async function getOrCreateAbbyClient(abbyApi: AxiosInstance, rawName: string, rawEmail: string): Promise<string> {
  const cleanEmail = (rawEmail || "").trim().toLowerCase();
  const cleanName = (rawName || "Client Inconnu").replace(/^Client\s+/i, '').trim();
  
  const names = cleanName.split(" ");
  const lastname = names.length > 1 ? names.slice(1).join(" ") : (names[0] || "Inconnu");
  const firstname = names.length > 1 ? names[0] : "";

  if (cleanEmail) {
    try {
      console.log(`🔍 Téléchargement des contacts pour chercher ${cleanEmail}...`);
      
      const { data: searchResult } = await abbyApi.get("/contacts", { params: { limit: 100 } });
      const contactsList = searchResult?.data || searchResult?.docs || searchResult || [];
      
      const found = Array.isArray(contactsList) ? contactsList.find((c: any) => {
        const email1 = c.email ? c.email.toLowerCase().trim() : "";
        const emailsArray = Array.isArray(c.emails) ? c.emails.map((e:string) => e.toLowerCase().trim()) : [];
        return email1 === cleanEmail || emailsArray.includes(cleanEmail);
      }) : null;

      if (found) {
        console.log(`✅ Client existant trouvé sur Abby ! ID : ${found.id}`);
        return found.id;
      }
    } catch (e: any) {
      console.error("❌ Le serveur d'Abby n'a pas répondu à la recherche :", e.message);
      throw new Error("Serveur Abby inaccessible");
    }
  }

  console.log(`🆕 Client introuvable en base. Création en cours pour : ${cleanName}...`);
  try {
    const { data: newContact } = await abbyApi.post("/contact", {
      firstname: firstname,
      lastname: lastname,
      emails: [cleanEmail]
    });
    
    const newId = newContact?.data?.id || newContact?.id;
    console.log(`✅ Nouveau client créé ! ID : ${newId}`);
    return newId;
  } catch (error: any) {
    console.error("❌ Échec de la création du client Abby:", error.response?.data || error.message);
    throw new Error("Impossible de créer le client dans Abby.");
  }
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
  try { cca = new msal.ConfidentialClientApplication(msalConfig); } catch (error) { cca = {} as any; }

  app.set("trust proxy", true);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  const flashesDir = path.join(process.cwd(), 'data', 'flashes');
  if (!fs.existsSync(flashesDir)) fs.mkdirSync(flashesDir, { recursive: true });

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
    } catch (error) { res.status(500).json({ error: "Erreur" }); }
  });

  app.post('/api/flashes', upload.single('image'), (req, res) => {
    try {
      const { title, price, size, duration } = req.body;
      if (!req.file) return res.status(400).json({ error: "L'image est obligatoire." });
      const stmt = db.prepare("INSERT INTO flashes (title, price, size, duration, image_filename) VALUES (?, ?, ?, ?, ?)");
      const info = stmt.run(title, price, size, duration || 60, req.file.filename);
      res.status(201).json({ success: true, id: info.lastInsertRowid });
    } catch (error) { res.status(500).json({ error: "Erreur" }); }
  });

  app.put('/api/flashes/:id', upload.single('image'), (req, res) => {
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

  app.patch('/api/flashes/:id', express.json(), (req, res) => {
    try {
      const { available, reservationDetails } = req.body;
      const clientData = reservationDetails ? JSON.stringify(reservationDetails) : null;
      db.prepare("UPDATE flashes SET available = ?, client_data = ? WHERE id = ?").run(available ? 1 : 0, clientData, req.params.id);
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Erreur" }); }
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

  // --- ROUTES REPORTS (SQLite) ---
  app.get('/api/reports', (req, res) => {
    try {
      const reports = db.prepare("SELECT * FROM reports ORDER BY timestamp DESC").all();
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de la récupération des rapports" });
    }
  });

  app.post('/api/reports', (req, res) => {
    try {
      const { content } = req.body;
      const userId = getUserId(req);
      const stmt = db.prepare("INSERT INTO reports (user_id, content) VALUES (?, ?)");
      const info = stmt.run(userId, content);
      res.status(201).json({ success: true, id: info.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de la création du rapport" });
    }
  });

  app.patch('/api/reports/:id', (req, res) => {
    try {
      const { completed } = req.body;
      db.prepare("UPDATE reports SET completed = ? WHERE id = ?").run(completed ? 1 : 0, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erreur lors de la mise à jour du rapport" });
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
        if (isFree) slots.push(slotStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        current = new Date(current.getTime() + (step * 60000));
      }
      res.json(slots);
    } catch (error) { res.status(500).json({ error: "Erreur" }); }
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


  // ==========================================
  // --- NOUVELLES ROUTES PURES POSTGRESQL ---
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

      // On met à jour uniquement si la donnée est fournie
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
  app.get('/api/appointments/:id/check-consent', (req, res) => { res.json({ exists: false }); });
  app.get("/api/bookings/timeoff", (req, res) => res.json([]));

  app.get("/api/abby/documents", async (req: any, res) => {
    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) return res.json([]);
      
      const resp = await abbyApi.get("/v2/billings", { params: { page: 1, limit: 100, test: false } });
      const rawDocs = resp.data?.data || resp.data?.docs || resp.data || [];

      const formattedDocs = (Array.isArray(rawDocs) ? rawDocs : []).map((doc: any) => {
        const docNumber = (doc.number || doc.id || "").toUpperCase();
        let docType = "Facture";
        if (docNumber.startsWith("BDC")) docType = "Bon de commande";
        else if (docNumber.startsWith("AC")) docType = "Facture d'acompte";
        else if (docNumber.startsWith("DE") || doc.type === "estimate") docType = "Devis";
        
        let statusCode = "draft";
        let statusText = "Brouillon";
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

      res.json(formattedDocs);
    } catch (error: any) { res.status(500).json({ error: "Erreur Abby", details: error.message }); }
  });

// =========================================================================
// --- CRÉATEUR DE DOCUMENT (DIRECT ABBY) ---
// =========================================================================
app.post("/api/abby/create-document", express.json(), async (req: any, res) => {
  const { appointment, type } = req.body;

  try {
    const abbyApi = getAbbyAxiosClient();
    if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });

    const rawName = appointment.client_name || "Client Inconnu";
    const rawEmail = appointment.client_email || "";
    const customerId = await getOrCreateAbbyClient(abbyApi, rawName, rawEmail);

    const totalAmount = Number(appointment.total_price) || 0;
    let calculatedAmount = type === "Facture d'acompte" 
      ? (totalAmount <= 200 ? 50 : totalAmount * 0.25)
      : totalAmount;

    const abbyResponse = await abbyApi.post("/v2/billings", {
      customerId: customerId,
      type: type === "Facture d'acompte" ? "invoice" : "invoice",
      items: [{
        title: `${type} - Tatouage le ${new Date(appointment.appointment_date).toLocaleDateString('fr-FR')}`,
        price: Math.round(calculatedAmount * 100),
        quantity: 1,
        vatRate: 0 
      }],
      comment: `Lien RDV : ${appointment.id}`
    });

    const newAbbyId = abbyResponse.data?.id || abbyResponse.data?.data?.id;
    if (!newAbbyId) throw new Error("Abby n'a pas renvoyé d'ID.");

    if (type === "Facture d'acompte") {
      await pool.query(
        `UPDATE appointments SET abby_deposit_id = $1, deposit_amount = $2 WHERE id = $3`,
        [newAbbyId, calculatedAmount, appointment.id]
      );
    } else {
      await pool.query(
        `UPDATE appointments SET abby_final_id = $1 WHERE id = $2`,
        [newAbbyId, appointment.id]
      );
    }

    res.json({ success: true, data: { id: newAbbyId } });

  } catch (error: any) {
    console.error("❌ Erreur Direct Abby Create:", error.response?.data || error.message);
    res.status(500).json({ error: "Erreur lors de la création sur Abby" });
  }
});

// =========================================================================
// --- ENCAISSEUR (DIRECT ABBY) ---
// =========================================================================
app.post("/api/abby/pay-document", express.json(), async (req: any, res) => {
  const { abbyDocId, type, appointmentId } = req.body;

  try {
    const abbyApi = getAbbyAxiosClient();
    if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });

    await abbyApi.post(`/v2/billings/${abbyDocId}/payments`, {
      amount: 0,
      paymentMethod: "cash",
      paidAt: new Date().toISOString()
    });

    if (type === "Facture d'acompte") {
      await pool.query(
        `UPDATE appointments SET deposit_status = 'Oui' WHERE id = $1`,
        [appointmentId]
      );
    }

    res.json({ success: true });

  } catch (error: any) {
    console.error("❌ Erreur Direct Abby Pay:", error.response?.data || error.message);
    res.status(500).json({ error: "Erreur lors de l'encaissement sur Abby" });
  }
});

  app.get("/api/abby/documents/:id/pdf", async (req: any, res) => {
    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });

      const { data } = await abbyApi.get(`/v2/billing/${req.params.id}`);
      const docInfo = data.data || data;
      const pdfUrl = docInfo.url || docInfo.pdfUrl || docInfo.fileUrl || docInfo.link;

      if (!pdfUrl) return res.status(404).json({ error: "Le document n'a pas de PDF généré." });

      const pdfResponse = await axios.get(pdfUrl, { responseType: 'stream' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="document-${req.params.id}.pdf"`);
      pdfResponse.data.pipe(res);

    } catch (error: any) {
      console.error("[Abby PDF Error]:", error.response?.data || error.message);
      res.status(500).json({ error: "Erreur lors de la récupération du PDF Abby" });
    }
  });

  app.post("/api/abby/sync", async (req, res) => {
  try {
    const abbyApi = getAbbyAxiosClient();
    if (!abbyApi) {
      return res.status(400).json({ success: false, error: "Clé API Abby non configurée." });
    }

    const response = await abbyApi.get('/v2/billings');
    const documents = response.data?.data || response.data || [];

    const paidStatuses = ['paid', 'signed', 'accepted', 'encaissé'];
    let updateCount = 0;

    for (const doc of documents) {
      if (paidStatuses.includes(doc.status)) {
        const updateAcompte = await pool.query(
          `UPDATE appointments SET deposit_status = 'Oui' WHERE abby_deposit_id = $1 AND deposit_status != 'Oui'`,
          [doc.id]
        );
        updateCount += updateAcompte.rowCount || 0;

        const updateFacture = await pool.query(
          `UPDATE appointments SET project_status = 'Payé' WHERE abby_final_id = $1 AND project_status != 'Payé'`,
          [doc.id]
        );
        updateCount += updateFacture.rowCount || 0;
      }
    }

    res.json({ success: true, updated: updateCount });
  } catch (error: any) {
    console.error("❌ Erreur lors de la Synchro Abby globale:", error.message);
    res.status(500).json({ success: false, error: "Erreur de synchronisation Abby" });
  }
});

  app.all("/api/*", (req, res) => {
    console.error(`[404] Route introuvable bloquée : ${req.method} ${req.path}`);
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