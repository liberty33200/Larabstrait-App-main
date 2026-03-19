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
import axios, { AxiosInstance } from "axios";
import {
  fetchDataverse,
  updateDataverse,
  createDataverse,
  deleteDataverse
} from "./dataverseService";

dotenv.config();

// Initialisation de la base de données pour les notifications et paramètres
const db = new Database("notifications.db");
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
  app.use(express.json());
  app.use(cookieParser());

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
              <p>Bonjour ${clientName},</p>
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

  app.post("/api/appointments", async (req, res) => {
    try {
      const result = await createDataverse("cr7e0_gestiontatouages", req.body);
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

  // --- GESTION DES ERREURS 404 DE L'API ---
  app.all("/api/*", (req, res) => {
    console.error(
      `[404] Le frontend a tenté d'appeler une route inexistante : ${req.method} ${req.path}`
    );
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVEUR DÉMARRÉ SUR LE PORT ${PORT} <<<`);
  });
}

startServer().catch(console.error);