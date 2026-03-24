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

// 2. On range la base de données DEDANS
const db = new Database(path.join(dataDir, 'notifications.db'));
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
`);



// Configuration Web Push
const vapidKeys = {
  publicKey:
    process.env.VAPID_PUBLIC_KEY ||
    "BOL1mjmDT2wcuCh-ToFzWu6o9oIjq4FVr85uKtosGYsvA3beiLNqf4YPFHddtBPqfVbfTgRRN6rLCcX3vrXUQhM",
  privateKey:
    process.env.VAPID_PRIVATE_KEY ||
    "R0V328V-nSSnmYHPj5xpvtVKx7vzs1Ix82kpd9tsvHY"
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
  return db
    .prepare("SELECT abby_api_key FROM user_settings WHERE user_id = ?")
    .get(userId) as any;
}

// --- 1. FONCTIONS DE BASE (Validées par le support Abby) ---
function getAbbyApiKey(): string {
  let envKey = process.env.ABBY_API_KEY || "";
  // SÉCURITÉ DOCKER : On pulvérise les espaces, retours à la ligne et guillemets potentiels
  envKey = envKey.replace(/\s+/g, "").replace(/['"]/g, "");
  
  // On retire le mot Bearer s'il a été collé par erreur, mais on GARDE STRICTEMENT le suk_
  return envKey.replace(/^Bearer/i, "");
}

function getAbbyAxiosClient(): AxiosInstance | null {
  const apiKey = getAbbyApiKey();
  if (!apiKey) return null;

  return axios.create({
    baseURL: "https://api.app-abby.com", // URL confirmée par le support
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${apiKey}`, // Format exact : "Bearer suk_..."
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
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

async function tryAbbyGetFirstSuccess(
  abbyApi: AxiosInstance,
  routes: Array<{ url: string; params?: any; responseType?: any }>
) {
  let lastError: any = null;

  for (const route of routes) {
    try {
      const response = await abbyApi.get(route.url, {
        params: route.params,
        responseType: route.responseType
      });
      return response;
    } catch (error: any) {
      lastError = error;
    }
  }

  throw lastError || new Error("Aucune route Abby valide n'a répondu.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const msalConfig: msal.Configuration = {
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID || "missing-client-id",
      authority: `https://login.microsoftonline.com/${
        process.env.MICROSOFT_TENANT_ID || "common"
      }`,
      clientSecret:
        process.env.MICROSOFT_CLIENT_SECRET || "missing-client-secret"
    }
  };

  let cca: msal.ConfidentialClientApplication;
  try {
    cca = new msal.ConfidentialClientApplication(msalConfig);
  } catch (error) {
    console.error("MSAL Init Error:", error);
    cca = {} as any;
  }

  app.set("trust proxy", true);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  app.post('/api/appointments/:id/consent', express.json({ limit: '50mb' }), async (req: any, res) => {
  const appointmentId = req.params.id;
  const { pdfData, clientName, appointmentDate } = req.body;

  try {
    // 1. GESTION DE LA SESSION / AUTH MICROSOFT
    let userAccountId = req.session?.user?.homeAccountId;
    if (!userAccountId) {
      const accounts = await cca.getTokenCache().getAllAccounts();
      if (accounts.length > 0) userAccountId = accounts[0].homeAccountId;
      else return res.status(401).json({ error: "Non authentifié" });
    }

    const account = await cca.getTokenCache().getAccountByHomeId(userAccountId);
    const authResult = await cca.acquireTokenSilent({
      account: account!,
      scopes: ["Mail.Send"]
    });
    const graphToken = authResult.accessToken;

    // 2. NETTOYAGE DES VARIABLES POUR LE NOM DU FICHIER
    const cleanName = clientName
      ? clientName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_")
      : "Client";

    // Nettoyage de la date (ex: "17-03-2025")
    const dateStr = appointmentDate 
  ? appointmentDate.toString()
      .replace(/[\/\.\s]+/g, '-') // Remplace / . et espaces par -
      .replace(/-+/g, '-')        // Évite les doubles tirets --
      .replace(/^-+|-+$/g, '')    // Enlève les tirets au début ou à la fin
  : "Date_Inconnue";

    const fileName = `Consentement_${cleanName}_${dateStr}.pdf`;
    console.log("💾 NOM GÉNÉRÉ :", fileName);

    // --- ICI EST LA CORRECTION DU DOUBLON ---
    // On déclare base64Data UNE SEULE FOIS
    const base64Data = pdfData.includes('base64,') ? pdfData.split('base64,')[1] : pdfData;

    // 3. SAUVEGARDE SUR LE NAS
    const dechargesDir = path.join(process.cwd(), 'data', 'decharges');
    if (!fs.existsSync(dechargesDir)) {
      fs.mkdirSync(dechargesDir, { recursive: true });
    }

    const filePath = path.join(dechargesDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    console.log("📂 Sauvegarde NAS OK :", fileName);

    // 4. ENVOI DU MAIL VIA MS GRAPH
    const emailPayload = {
      message: {
        subject: `🖋️ Décharge signée : ${clientName}`,
        body: {
          contentType: "HTML",
          content: `<p>Bonjour,</p><p>Une nouvelle décharge a été signée par <b>${clientName}</b> pour le rendez-vous du ${dateStr}.</p>`
        },
        toRecipients: [{ emailAddress: { address: process.env.EMAIL_STUDIO } }],
        attachments: [{
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: `Consentement_${cleanName}_${dateStr}.pdf`,
          contentType: "application/pdf",
          contentBytes: base64Data
        }]
      }
    };

    await axios.post("https://graph.microsoft.com/v1.0/me/sendMail", emailPayload, {
      headers: { Authorization: `Bearer ${graphToken}`, "Content-Type": "application/json" }
    });
    
    console.log("📧 Email envoyé OK");
    res.json({ success: true, message: "Enregistrement et Email terminés !" });

  } catch (error: any) {
    console.error("❌ Erreur traitement décharge :", error.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route pour VERIFIER et TELECHARGER
app.get('/api/appointments/:id/download-consent', (req, res) => {
  const appointmentId = req.params.id;
  const dechargesDir = path.join(process.cwd(), 'data', 'decharges');

  if (!fs.existsSync(dechargesDir)) return res.status(404).send("Dossier vide");

  const files = fs.readdirSync(dechargesDir);
  // On cherche le fichier qui CONTIENT l'ID (peu importe le nom du client autour)
  const targetFile = files.find(f => f.includes(appointmentId) && f.endsWith('.pdf'));

  if (targetFile) {
    const filePath = path.join(dechargesDir, targetFile);
    res.download(filePath);
  } else {
    res.status(404).json({ error: "Fichier non trouvé" });
  }
});

// Route pour le CHECK (Bouton vert)
app.get('/api/appointments/:id/check-consent', (req, res) => {
  const appointmentId = req.params.id;
  const dechargesDir = path.join(process.cwd(), 'data', 'decharges');

  if (!fs.existsSync(dechargesDir)) return res.json({ exists: false });

  const files = fs.readdirSync(dechargesDir);
  const exists = files.some(f => f.includes(appointmentId));

  res.json({ exists });
});

// Route pour vérifier si une décharge existe déjà
app.get('/api/appointments/:id/check-consent', (req, res) => {
  const appointmentId = req.params.id;
  const filePath = path.join(process.cwd(), 'data', 'decharges', `Consentement_${appointmentId}.pdf`);
  
  // On renvoie simplement true ou false
  res.json({ exists: fs.existsSync(filePath) });
});

  const sessionSecret =
    process.env.SESSION_SECRET || "tattoo-studio-secret-v3";
  const tokenSessions = new Map<string, any>();

  app.use(
    session({
      name: "larabstrait_session",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: true,
      proxy: true,
      cookie: {
        secure: true,
        sameSite: "none",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
      }
    })
  );

  app.use("/api", (req: any, res, next) => {
    const authHeader = req.headers.authorization;
    const bypassHeader = req.headers["x-dev-bypass"];

    if (bypassHeader === "true") {
      req.session.user = {
        name: "Aperçu AI Studio",
        username: "preview@aistudio.google",
        homeAccountId: "bypass-id"
      };
      return next();
    }

    if (authHeader && authHeader.startsWith("Bearer ")) {
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
    const host = req.get("host") || "";
    const xForwardedHost = req.get("x-forwarded-host") || "";

    let baseUrl = process.env.APP_URL || "";

    if (!baseUrl) {
      if (
        host.includes("run.app") ||
        xForwardedHost.includes("run.app") ||
        (origin && origin.includes("run.app"))
      ) {
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

    baseUrl = baseUrl
      .replace(/\/+$/, "")
      .replace(/\/api\/auth\/callback$/, "");

    if (
      baseUrl.includes("localhost") &&
      (host.includes("run.app") || xForwardedHost.includes("run.app"))
    ) {
      baseUrl = `https://${xForwardedHost.split(",")[0].trim() || host}`;
    }

    return `${baseUrl}/api/auth/callback`;
  };

  app.get("/api/auth/url", (req, res) => {
    cca
      .getAuthCodeUrl({
        scopes: ["user.read", "Mail.Send", "Files.Read.All"],
        redirectUri: getRedirectUri(req)
      })
      .then((url) => res.json({ url }))
      .catch((error) => res.status(500).json({ error: error.message }));
  });

  app.get("/api/auth/login", (req, res) => {
    cca
      .getAuthCodeUrl({
        scopes: ["user.read", "Mail.Send", "Files.Read.All"],
        redirectUri: getRedirectUri(req)
      })
      .then((response) => res.redirect(response))
      .catch((error) => res.status(500).send(error));
  });

  app.get("/api/auth/status", (req: any, res) => {
    res.json({
      isAuthenticated: !!req.session.user,
      user: req.session.user || null
    });
  });

 app.post("/api/appointments/:id/send-pdf", express.json(), async (req: any, res) => {
    const { clientEmail, clientName } = req.body;
    const userAccountId = req.session.user?.homeAccountId;

    if (!userAccountId) return res.status(401).json({ error: "Non authentifié" });
    if (!clientEmail) return res.status(400).json({ error: "Email manquant" });

    try {
      // 1. Récupérer le jeton de sécurité pour MS Graph
      const account = await cca.getTokenCache().getAccountByHomeId(userAccountId);
      const authResult = await cca.acquireTokenSilent({
        account: account!,
        scopes: ["Mail.Send", "Files.Read.All"]
      });
      
      const graphToken = authResult.accessToken;

      // 2. Télécharger le PDF depuis SharePoint
      const driveId = "b!vOwzOeuRUUacHKDyHq_WD3KZNAfkK_xAohv1OegSBuqrG8KSnvFLRr_Q7cjhrjGF";
      const itemId = "01BVWNLSWAWRVG7IFUYNBJIPIAQB6KXFWP"; // <-- CHANGER ICI
      
      const sharepointFileUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`;
      
      const pdfResponse = await axios.get(sharepointFileUrl, {
        headers: { Authorization: `Bearer ${graphToken}` },
        responseType: 'arraybuffer'
      });

      const pdfBase64 = Buffer.from(pdfResponse.data).toString('base64');

      // 3. Envoyer l'Email
      const emailPayload = {
        message: {
          subject: "Larabstrait - Feuille de soins et informations.",
          body: {
            contentType: "HTML",
            content: `
              <p>Hello !</p>
              <p>Suite à notre séance voici, ci-joint, la feuille de soin comme convenu avec toutes les consignes à respecter durant la période de cicatrisation.</p>
              <p>Je reste disponible si besoin.</p>
              <p>À bientôt et bonne cicatrisation💫</p>
              <p>Lara - Larabstrait</p>
            `
          },
          toRecipients: [{ emailAddress: { address: clientEmail } }],
          attachments: [
            {
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: "Feuille de soins.pdf",
              contentType: "application/pdf",
              contentBytes: pdfBase64
            }
          ]
        },
        saveToSentItems: "true" // Sauvegarde une copie dans tes éléments envoyés
      };

      await axios.post("https://graph.microsoft.com/v1.0/me/sendMail", emailPayload, {
        headers: { 
          Authorization: `Bearer ${graphToken}`,
          "Content-Type": "application/json"
        }
      });

      res.json({ success: true, message: "Email envoyé avec succès" });

    } catch (error: any) {
      console.error("[Graph Error]:", error.response?.data || error.message);
      res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
    }
  });



  app.get("/api/auth/callback", (req: any, res) => {
    cca
      .acquireTokenByCode({
        code: req.query.code as string,
        scopes: ["user.read", "Mail.Send", "Files.Read.All"],
        redirectUri: getRedirectUri(req)
      })
      .then((response) => {
        if (response.account) {
          const userData = {
            homeAccountId: response.account.homeAccountId,
            username: response.account.username,
            name: response.account.name
          };

          req.session.user = userData;

          const token =
            Math.random().toString(36).substring(2) + Date.now().toString(36);

          tokenSessions.set(token, userData);

          res.send(`
            <html>
              <body>
                <h2>Connexion réussie !</h2>
                <script>
                  const token = "${token}";
                  localStorage.setItem('larabstrait_token', token);
                  try {
                    new BroadcastChannel('larabstrait_auth').postMessage({
                      type: 'OAUTH_AUTH_SUCCESS',
                      token: token
                    });
                  } catch (e) {}
                  if (window.opener) {
                    window.opener.postMessage({
                      type: 'OAUTH_AUTH_SUCCESS',
                      token: token
                    }, '*');
                  }
                  setTimeout(() => {
                    window.close();
                    setTimeout(() => {
                      if (!window.closed) {
                        window.location.href = "/?token=" + token;
                      }
                    }, 1000);
                  }, 500);
                </script>
              </body>
            </html>
          `);
        } else {
          res.redirect("/");
        }
      })
      .catch((error) => res.status(500).send(error));
  });

  app.get("/api/auth/user", (req: any, res) => {
    res.json(req.session.user || null);
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  // --- CALENDRIER / TIME OFF (DUMMY) ---
  app.get("/api/bookings/timeoff", (req, res) => {
    res.json([]);
  });

  // --- DATA & APPOINTMENTS (Dataverse) ---
  app.get("/api/appointments", async (req, res) => {
    try {
      const data = await fetchDataverse("cr7e0_gestiontatouages");
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/appointments/:id", async (req, res) => {
    try {
      const result = await updateDataverse(
        "cr7e0_gestiontatouages",
        req.params.id,
        req.body
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  // Création RDV + envoi email automatique de confirmation (si email fourni) grâce à MS Graph
  app.post("/api/appointments", express.json(), async (req: any, res) => {
    try {
      // 1. Création du rendez-vous dans la base de données Dataverse
      const result = await createDataverse("cr7e0_gestiontatouages", req.body);

      // 2. Envoi de l'email automatique (Uniquement si une adresse email a été fournie)
      const clientEmail = req.body.cr7e0_email;
      const clientName = req.body.cr7e0_nomclient || 'Client';
      const rawDate = req.body.cr7e0_daterdv; // Date au format ISO envoyée par le frontend
      const userAccountId = req.session?.user?.homeAccountId;

      // On vérifie qu'on a bien l'email, la date et qu'on est authentifié
      if (clientEmail && userAccountId && rawDate) {
        try {
          // Formatage de la date pour que ce soit joli dans l'email (ex: "jeudi 15 mai 2024 à 14:00")
          const dateObj = new Date(rawDate);
          const formattedDate = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          const formattedTime = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

          // Récupération du jeton Microsoft Graph
          const account = await cca.getTokenCache().getAccountByHomeId(userAccountId);
          if (account) {
            const authResult = await cca.acquireTokenSilent({
              account: account,
              scopes: ["Mail.Send"]
            });
            
            const graphToken = authResult.accessToken;

            // Préparation de l'email sans pièce jointe
            const emailPayload = {
              message: {
                subject: "Confirmation de votre rendez-vous - Larabstrait",
                body: {
                  contentType: "HTML",
                  content: `
                    <p>Hello,</p>
                    <p>Ton rendez-vous est bien confirmé pour le <strong>${formattedDate} à ${formattedTime}</strong>.</p>
                    <p>N'hésite pas à me contacter si tu as la moindre question ou un empêchement d'ici là.</p>
                    <p>À très vite ! 🖤</p>
                    <p>Lara - Larabstrait</p>
                  `
                },
                toRecipients: [{ emailAddress: { address: clientEmail } }]
                // Pas de bloc "attachments" ici !
              },
              saveToSentItems: "true" // Garde une trace dans ta boîte mail
            };

            // Envoi de l'email
            await axios.post("https://graph.microsoft.com/v1.0/me/sendMail", emailPayload, {
              headers: { 
                Authorization: `Bearer ${graphToken}`,
                "Content-Type": "application/json"
              }
            });
            
            console.log(`[Email] Confirmation envoyée automatiquement à ${clientEmail}`);
          }
        } catch (mailError: any) {
          // Si l'email plante, on l'affiche dans la console du serveur, mais on NE FAIT PAS planter la création du RDV
          console.error("[Graph Error - Email automatique]:", mailError.response?.data || mailError.message);
        }
      }

      // 3. On répond au frontend que le RDV est bien créé
      res.status(201).json(result);

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      const success = await deleteDataverse(
        "cr7e0_gestiontatouages",
        req.params.id
      );
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- SETTINGS ABBY ---
  app.get("/api/settings/abby", (req: any, res) => {
  try {
    const hasEnvKey = !!process.env.ABBY_API_KEY?.trim();

    res.json({
      configured: hasEnvKey,
      source: hasEnvKey ? "env" : null,
      // C'EST CE MOT QUE LE FRONTEND ATTEND POUR AFFICHER "CONNECTÉ" :
      abby_api_key: hasEnvKey ? "CONFIGURED" : "" 
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur récupération paramètres" });
  }
});

  app.post("/api/settings/abby", express.json(), (req: any, res) => {
    const userId = getUserId(req);
    const { abby_api_key } = req.body;

    try {
      const cleanedKey = typeof abby_api_key === "string"
        ? abby_api_key.trim()
        : "";

      db.prepare(
        "INSERT OR REPLACE INTO user_settings (user_id, abby_api_key) VALUES (?, ?)"
      ).run(userId, cleanedKey);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erreur sauvegarde" });
    }
  });

  app.get("/api/abby/debug-auth", (req: any, res) => {
    const userId = getUserId(req);

    try {
      const settings = getStoredAbbySettings(userId);
      const dbKey = settings?.abby_api_key?.trim() || "";
      const envKey = process.env.ABBY_API_KEY?.trim() || "";
      const finalKey = getAbbyApiKey();

      res.json({
        userId,
        hasDbKey: !!dbKey,
        hasEnvKey: !!envKey,
        finalSource: envKey ? "env" : dbKey ? "database" : null,
        finalPrefix: finalKey ? finalKey.slice(0, 4) : null,
        finalLength: finalKey ? finalKey.length : 0
      });
    } catch (error) {
      res.status(500).json({ error: "Erreur debug auth Abby" });
    }
  });

  app.get("/api/abby/test-connection", async (req: any, res) => {
    const userId = getUserId(req);

    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) {
        return res
          .status(400)
          .json({ error: "Clé API Abby non configurée" });
      }

      const { data } = await abbyApi.get("/contacts", {
        params: { limit: 1, page: 1 }
      });

      res.json({
        success: true,
        message: "Connexion réussie à l'API Abby",
        data
      });
    } catch (err: any) {
      handleAbbyError(err, res, "Test Connection");
    }
  });

  app.get("/api/abby/test-debug", async (req: any, res) => {
    const userId = getUserId(req);

    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) {
        return res
          .status(400)
          .json({ error: "Clé API Abby non configurée" });
      }

      const { data } = await abbyApi.get("/contacts", {
        params: { limit: 1, page: 1 }
      });

      res.json({
        success: true,
        message: "Connexion Abby OK",
        data
      });
    } catch (err: any) {
      handleAbbyError(err, res, "Test Debug");
    }
  });

  app.post("/api/abby/create-document", express.json(), async (req: any, res) => {
    const { appointment, type } = req.body;
    const userId = getUserId(req);

    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) {
        return res
          .status(400)
          .json({ error: "Clé API Abby non configurée" });
      }

      let customerId = "";

      const { data: searchResult } = await abbyApi.get("/contacts", {
        params: {
          search: appointment.client,
          page: 1,
          limit: 10
        }
      });

      const contactsList = searchResult?.data || searchResult?.docs || searchResult || [];

      if (Array.isArray(contactsList) && contactsList.length > 0) {
        customerId = contactsList[0].id;
      } else {
        const names = String(appointment.client || "").trim().split(" ");
        const firstname = names[0] || "Client";
        const lastname = names.slice(1).join(" ") || "Inconnu";

        const { data: newContact } = await abbyApi.post("/contact", {
          firstname,
          lastname
        });

        customerId = newContact.id;
      }

      if (type === "Recette") {
        const payload = {
          paidAt: new Date(appointment.date).toISOString(),
          paymentMethodUsed: { value: 1 },
          vatAmount: 0,
          vatId: 1,
          client: appointment.client,
          priceWithoutTax: Math.round((appointment.total || 0) * 100),
          priceTotalTax: Math.round((appointment.total || 0) * 100),
          reference: `RDV-${appointment.id}`,
          productType: 1,
          isSap: false,
          isTaxIncluded: true
        };

        const { data } = await abbyApi.post("/incomeBook", payload);
        return res.json({ success: true, data });
      }

      if (
        type === "Facture" ||
        type === "Facture d'acompte" ||
        type === "Facture finale"
      ) {
        const { data: invoice } = await abbyApi.post(
          `/v2/billing/invoice/${customerId}`,
          {}
        );

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

        return res.json({
          success: true,
          data: {
            id: invoiceId,
            message: "Facture créée en brouillon"
          }
        });
      }

      return res
        .status(400)
        .json({ error: "Type de document non supporté" });
    } catch (err: any) {
      handleAbbyError(err, res, `Create Document (${type})`);
    }
  });

  // --- LE SCANNER DE DIAGNOSTIC ABBY ---
app.get("/api/abby/documents", async (req: any, res) => {
  try {
    const abbyApi = getAbbyAxiosClient();
    if (!abbyApi) return res.status(400).json({ error: "Clé API Abby non configurée" });

    // APPEL UNIQUE : Strictement sur l'environnement de production comme exigé par Abby
    const resp = await abbyApi.get("/v2/billings", { 
      params: { page: 1, limit: 50, test: false } 
    });
    
    const successData = resp.data;
    const rawDocs = successData?.data || successData?.docs || successData || [];

    const formattedDocs = (Array.isArray(rawDocs) ? rawDocs : []).map((doc: any) => {
      let docType = "Document";
      if (doc.type === "invoice" || doc.number?.startsWith("FA")) docType = "Facture";
      else if (doc.type === "estimate" || doc.number?.startsWith("DE")) docType = "Devis";
      else if (doc.type === "purchase_order" || doc.number?.startsWith("BC")) docType = "Bon de commande";

      let statusCode = "draft";
      let statusText = "Brouillon";
      const s = (doc.state || doc.status || "").toString().toLowerCase();

      if (["canceled", "cancelled", "annulée"].includes(s)) { statusCode = "draft"; statusText = "Annulé"; }
      else if (["paid", "payée", "payee"].includes(s)) { statusCode = "paid"; statusText = "Encaissé"; }
      else if (["accepted", "acceptée", "signed", "signé", "signee"].includes(s)) { statusCode = "paid"; statusText = "Signé"; }
      else if (["sent", "envoyée", "validated", "validée", "pending", "finalized"].includes(s)) { statusCode = "sent"; statusText = docType === "Facture" ? "À encaisser" : "À signer"; }

      let amount = (doc.totalAmountWithTaxAfterDiscount !== undefined) ? doc.totalAmountWithTaxAfterDiscount / 100 : 0;
      if (docType === "Facture" && doc.remainingAmountWithTax !== undefined) {
        if (statusCode === "sent" && amount > 0 && doc.remainingAmountWithTax === 0) { statusCode = "paid"; statusText = "Encaissé"; }
        if (statusCode !== "paid") amount = doc.remainingAmountWithTax / 100;
      }

      let clientName = "Client inconnu";
      if (doc.customer && (doc.customer.firstname || doc.customer.lastname)) clientName = `${doc.customer.firstname || ""} ${doc.customer.lastname || ""}`.trim();

      let dateVal = doc.emittedAt || doc.createdAt;
      let formattedDate = "N/A";
      if (dateVal) {
        if (typeof dateVal === "number" && dateVal.toString().length === 10) dateVal *= 1000;
        formattedDate = new Date(dateVal).toLocaleDateString("fr-FR");
      }

      return { id: doc.number || doc.id || "N/A", internalId: doc.id, client: clientName, type: docType, amount, date: formattedDate, status: statusCode, statusLabel: statusText };
    });

    res.json(formattedDocs.sort((a: any, b: any) => (b.date === "N/A" ? "" : b.date.split("/").reverse().join("-")).localeCompare(a.date === "N/A" ? "" : a.date.split("/").reverse().join("-"))));

  } catch (error: any) {
    const status = error.response?.status || 500;
    const errorData = error.response?.data || error.message;
    console.error("[Abby Error] Documents:", errorData);
    res.status(status).json({ error: "Erreur Abby", details: errorData });
  }
});
  // --- TÉLÉCHARGER LE PDF D'UN DOCUMENT ---
  app.get("/api/abby/documents/:id/pdf", async (req: any, res) => {
    const userId = getUserId(req);

    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) {
        return res
          .status(400)
          .json({ error: "Clé API Abby non configurée" });
      }

      const internalId = req.params.id;
      let pdfBuffer: any = null;

      const routesToTest = [
        `/v2/billing/${internalId}/download`,
        `/v2/billings/${internalId}/download`,
        `/v2/documents/${internalId}/download`
      ];

      for (const route of routesToTest) {
        try {
          const response = await abbyApi.get(route, {
            responseType: "arraybuffer"
          });
          pdfBuffer = response.data;
          console.log(`🎉 Route PDF trouvée : ${route}`);
          break;
        } catch (e) {
          // on continue
        }
      }

      if (!pdfBuffer) {
        throw new Error(
          "Impossible de trouver le PDF sur les serveurs d'Abby. L'ID est peut-être incorrect ou le document n'est pas finalisé."
        );
      }

      const disposition = req.query.inline === "true" ? "inline" : "attachment";

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${internalId}.pdf"`
      );

      return res.send(pdfBuffer);
    } catch (error: any) {
      console.error("[ABBY PDF ERROR]", error.message);
      res
        .status(500)
        .json({ error: "Impossible de récupérer le PDF depuis Abby." });
    }
  });

  app.post("/api/abby/purchase-register", express.json(), async (req: any, res) => {
    const userId = getUserId(req);

    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) {
        return res.status(400).json({ error: "Clé API non configurée" });
      }

      const { data } = await abbyApi.post("/v2/purchaseRegister", req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      handleAbbyError(err, res, "Create Purchase Register Entry");
    }
  });

  app.post("/api/abby/products", express.json(), async (req: any, res) => {
    const userId = getUserId(req);

    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) {
        return res.status(400).json({ error: "Clé API non configurée" });
      }

      const { data } = await abbyApi.post("/v2/catalog/product", req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      handleAbbyError(err, res, "Create Product");
    }
  });

  app.get("/api/abby/products", async (req: any, res) => {
    const userId = getUserId(req);

    try {
      const abbyApi = getAbbyAxiosClient();
      if (!abbyApi) {
        return res.status(400).json({ error: "Clé API non configurée" });
      }

      const { data } = await abbyApi.get("/v2/catalog/products", {
        params: { page: 1 }
      });

      res.json(data);
    } catch (err: any) {
      handleAbbyError(err, res, "Fetch Products");
    }
  });

  // --- NOTIFICATIONS ---
  app.get("/api/notifications/vapid-public-key", (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.post("/api/notifications/subscribe", express.json(), (req: any, res) => {
    const userId = getUserId(req);

    try {
      db.prepare(
        "INSERT OR REPLACE INTO subscriptions (subscription, user_id) VALUES (?, ?)"
      ).run(JSON.stringify(req.body), userId);

      res.status(201).json({});
    } catch (error) {
      res.status(500).json({ error: "Erreur abonnement" });
    }
  });

  app.post("/api/notifications/send-test", express.json(), async (req: any, res) => {
    const userId = getUserId(req);
    const subscriptions = db
      .prepare("SELECT subscription FROM subscriptions WHERE user_id = ?")
      .all(userId);

    const notificationPayload = JSON.stringify({
      title: "Test",
      body: "Test notification !",
      url: "/"
    });

    try {
      if (subscriptions.length === 0) {
        return res
          .status(400)
          .json({ error: "Aucun appareil enregistré." });
      }

      await Promise.all(
        (subscriptions as any[]).map((sub) =>
          webpush
            .sendNotification(JSON.parse(sub.subscription), notificationPayload)
            .catch((err) => {
              if (err.statusCode === 410 || err.statusCode === 404) {
                db.prepare(
                  "DELETE FROM subscriptions WHERE subscription = ?"
                ).run(sub.subscription);
              }
              throw err;
            })
        )
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // --- SYSTÈME DE TICKETS (BUGS / AMÉLIORATIONS) ---
app.get('/api/reports', (req, res) => {
  try {
    // Ton code actuel qui lit la base de données...
    const stmt = db.prepare("SELECT * FROM reports ORDER BY timestamp DESC");
    const reports = stmt.all();
    res.json(reports);
  } catch (error: any) {
    // 👇 LA LIGNE MAGIQUE 👇
    // On force le serveur à envoyer le texte exact de l'erreur au frontend
    res.status(500).json({ 
      error: "Erreur SQL détaillée", 
      details: error.message 
    });
  }
});

app.post("/api/reports", express.json(), async (req: any, res) => {
  const userId = getUserId(req);
  const { content } = req.body;

  if (!content || content.trim().length < 5) {
    return res.status(400).json({ error: "Le message est trop court." });
  }

  try {
    db.prepare("INSERT INTO reports (user_id, content) VALUES (?, ?)").run(userId, content);

    // Récupération des appareils abonnés
    const subscriptions = db.prepare("SELECT subscription FROM subscriptions").all();
    const notificationPayload = JSON.stringify({
      title: "Nouveau Ticket / Bug 🐞",
      body: content.length > 50 ? content.substring(0, 50) + "..." : content,
      url: "/" 
    });

    // On force le serveur à ATTENDRE que toutes les notifications soient parties
    await Promise.all(
      subscriptions.map((sub: any) =>
        webpush
          .sendNotification(JSON.parse(sub.subscription), notificationPayload)
          .catch((err) => {
            console.error("Échec d'envoi Push (ticket) :", err.message);
            // On en profite pour nettoyer la base si un appareil n'existe plus
            if (err.statusCode === 410 || err.statusCode === 404) {
              db.prepare("DELETE FROM subscriptions WHERE subscription = ?").run(sub.subscription);
            }
          })
      )
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error("Erreur POST Reports:", error.message);
    res.status(500).json({ error: "Erreur écriture" });
  }
});

app.patch("/api/reports/:id", express.json(), (req: any, res) => {
  const { id } = req.params;
  const { completed } = req.body;
  try {
    db.prepare("UPDATE reports SET completed = ? WHERE id = ?").run(completed ? 1 : 0, id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Erreur MAJ" });
  }
});

app.delete("/api/reports/completed", (req: any, res) => {
  try {
    db.prepare("DELETE FROM reports WHERE completed = 1").run();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Erreur purge" });
  }
});

// --- GESTION DES ERREURS 404 DE L'API ---
app.all("/api/*", (req, res) => {
  console.error(`[404] Le frontend a tenté d'appeler une route inexistante : ${req.method} ${req.path}`);
  res.status(404).json({ error: "Route API introuvable", path: req.path });
});


  // --- VITE & SPA FALLBACK ---
  const vite = await createViteServer({
    server: { middlewareMode: true, allowedHosts: true, hmr: false },
    appType: "spa"
  });

  app.use(vite.middlewares);

  app.get("*", async (req, res, next) => {
    if (req.path.startsWith("/api")) return next();

    try {
      const indexPath = path.resolve(process.cwd(), "index.html");
      if (!fs.existsSync(indexPath)) {
        return res.status(404).send("index.html introuvable.");
      }

      const html = await vite.transformIndexHtml(
        req.url,
        fs.readFileSync(indexPath, "utf-8")
      );

      res.status(200).set({ "Content-Type": "text/html" }).send(html);
    } catch (e) {
      res.status(500).send("Erreur interne.");
    }
  });

// À la fin de server.ts, juste avant startServer().catch(console.error);
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    // On calcule une fenêtre de temps pour le filtre (ex: entre maintenant et +20 min)
    const futureLimit = new Date(now.getTime() + 20 * 60000).toISOString();
    const nowISO = now.toISOString();

    // On utilise le paramètre 'filter' pour ne récupérer que les RDV proches
    // On ne demande que les colonnes nécessaires avec 'select'
    const filter = `cr7e0_daterdv ge ${nowISO} and cr7e0_daterdv le ${futureLimit}`;
    const select = "cr7e0_nomclient,cr7e0_daterdv";

    const appointments = await fetchDataverse("cr7e0_gestiontatouages", select, filter);
    
    if (!Array.isArray(appointments)) return;

    for (const appt of appointments) {
      const startTime = new Date(appt.cr7e0_daterdv);
      const diffInMinutes = Math.round((startTime.getTime() - now.getTime()) / 60000);

      if (diffInMinutes === 15) {
        // ... (ton code d'envoi de notification reste le même)
      }
    }
  } catch (error: any) {
    console.error("Erreur Cron optimisé:", error.message);
  }
});
console.log("✅ LA ROUTE /api/appointments/:id/consent EST CHARGÉE");


  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVEUR DÉMARRÉ SUR LE PORT ${PORT} <<<`);
  });


}


startServer().catch(console.error);