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

let fakeDb: MockRequest[] = [];

dotenv.config();
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const publicStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const publicUpload = multer({ storage: publicStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// DB & VAPID Config...
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const newDbPath = path.join(dataDir, 'larabstrait.db');
const db = new Database(newDbPath);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
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

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || "",
  privateKey: process.env.VAPID_PRIVATE_KEY || ""
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

// --- FONCTION DE NOTIFICATION ---
async function notifyAdmin(requestData: any) {
  let raw = requestData.project_description || "";
  const keys = ["TYPE :", "BUDGET PRÉVU :", "DESCRIPTION :", "EMPLACEMENT :", "TAILLE :", "DISPOS :", "SANTÉ & CONFORT", "Premier tatouage :", "Appréhensions :", "Infos santé :", "Préférences :", "NUMÉRO FLASH :"];
  
  const extract = (key: string) => {
    const start = raw.indexOf(key);
    if (start === -1) return "Non précisé";
    const content = raw.substring(start + key.length);
    let minEnd = content.length;
    keys.forEach(k => {
      if (k !== key && content.indexOf(k) !== -1 && content.indexOf(k) < minEnd) minEnd = content.indexOf(k);
    });
    return content.substring(0, minEnd).replace(/[✨💰📝📍📏🗓️🌿🆔]/g, '').replace(/-+/g, '').trim();
  };

  const type = extract("TYPE :") !== "Non précisé" ? extract("TYPE :") : "Projet";
  const numFlash = extract("NUMÉRO FLASH :");
  const placement = extract("EMPLACEMENT :");
  const rawDesc = extract("DESCRIPTION :");
  const pureDesc = rawDesc !== "Non précisé" ? rawDesc : "Détails à consulter dans l'application.";
  const typeLabel = numFlash !== "Non précisé" ? `Flash n°${numFlash}` : type;

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
            <td width="4%"></td>
            <td width="48%" style="background-color: #1A1A1A; padding: 15px; border-radius: 12px; border: 1px solid #2A2A2A;">
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
  } catch (e) { console.error("❌ Erreur email:", e); }

  const subscriptions = db.prepare("SELECT subscription FROM subscriptions").all();
  const payload = JSON.stringify({ title: "✨ Nouveau Projet !", body: `${requestData.client_name} vient d'envoyer un formulaire.`, icon: "/icon-192x192.png", data: { url: "/requests" } });
  subscriptions.forEach((row: any) => {
    try { webpush.sendNotification(JSON.parse(row.subscription), payload); } catch (e) {}
  });
}

async function startServer() {
  const app = express();
  // Remplace ta ligne actuelle par celle-ci :
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.set("trust proxy", true);
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  app.use('/uploads', express.static(uploadDir));

  // --- MSAL & SESSIONS ---
  const sessionSecret = process.env.SESSION_SECRET || "tattoo-studio-secret-v3";
  const tokenSessions = new Map<string, any>();
  app.use(session({ name: "larabstrait_session", secret: sessionSecret, resave: false, saveUninitialized: true, proxy: true, cookie: { secure: true, sameSite: "none", httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }}));

  app.use("/api", (req: any, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const tokenUser = tokenSessions.get(authHeader.substring(7));
      if (tokenUser) req.session.user = tokenUser;
    }
    next();
  });

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session?.user) return res.status(401).json({ error: "Non autorisé." });
    next();
  };

  // --- ROUTES FORMULAIRE CLIENT ---
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
      notifyAdmin(newRequest); // 🔥 Envoi de l'email et de la notif push !
      
      return res.status(201).json({ success: true, requestId: newRequest.id });
    } catch (error: any) { res.status(500).json({ error: "Erreur serveur" }); }
  });

  // --- ROUTES DASHBOARD ADMIN ---
  app.get("/api/requests", requireAuth, async (req, res) => { res.json(fakeDb); });

  app.put("/api/requests/:id/status", requireAuth, express.json(), async (req, res) => {
    const reqIndex = fakeDb.findIndex(r => r.id.toString() === req.params.id);
    if (reqIndex !== -1) {
      fakeDb[reqIndex].status = req.body.status;
      return res.json({ success: true, request: fakeDb[reqIndex] });
    }
    return res.status(404).json({ error: "Introuvable." });
  });

  // --- ROUTES NOTIFICATIONS WEB PUSH ---
  app.get('/api/notifications/vapid-public-key', (req, res) => { res.json({ publicKey: vapidKeys.publicKey }); });
  
  app.post('/api/notifications/subscribe', express.json(), (req: any, res) => {
    try {
      const stmt = db.prepare("INSERT OR IGNORE INTO subscriptions (subscription, user_id) VALUES (?, ?)");
      stmt.run(JSON.stringify(req.body), getUserId(req));
      res.status(201).json({ success: true });
    } catch (error) { res.status(500).json({ error: "Erreur serveur" }); }
  });

  app.post('/api/notifications/send-test', requireAuth, (req, res) => {
    try {
      const payload = JSON.stringify({ title: "Test Larabstrait ✨", body: "Les notifications push sont bien activées sur cet appareil !", icon: "/icon-192x192.png" });
      const subscriptions = db.prepare("SELECT subscription FROM subscriptions").all();
      subscriptions.forEach((row: any) => {
        try { webpush.sendNotification(JSON.parse(row.subscription), payload); } catch (e) {}
      });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Erreur test push" }); }
  });

  // (Ajoute ici le reste de tes routes PostgreSQL, Abby, Flashes...)

  const vite = await createViteServer({ server: { middlewareMode: true, allowedHosts: true, hmr: false }, appType: "spa" });
  app.use(vite.middlewares);

  app.get("*", async (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    try {
      const indexPath = path.resolve(process.cwd(), "index.html");
      res.status(200).set({ "Content-Type": "text/html" }).send(await vite.transformIndexHtml(req.url, fs.readFileSync(indexPath, "utf-8")));
    } catch (e) { res.status(500).send("Erreur interne."); }
  });
  
  app.listen(PORT, "0.0.0.0", () => { console.log(`>>> SERVEUR DÉMARRÉ SUR LE PORT ${PORT} <<<`); });
}

startServer().catch(console.error);
