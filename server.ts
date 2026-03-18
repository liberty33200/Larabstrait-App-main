import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import session from "express-session";
import cookieParser from "cookie-parser";
import Abby from "@abby-inc/node";
import * as msal from "@azure/msal-node";
import Database from "better-sqlite3";
import webpush from "web-push";
import { fetchDataverse, updateDataverse, createDataverse, deleteDataverse } from "./dataverseService";
import { fetchGraph } from "./graphService";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

/* =========================
SESSION
========================= */

app.use(session({
  name: "larabstrait_session",
  secret: process.env.SESSION_SECRET || "tattoo-secret",
  resave: false,
  saveUninitialized: true
}));

/* =========================
DATABASE
========================= */

const db = new Database("notifications.db");

db.exec(`
CREATE TABLE IF NOT EXISTS subscriptions (
id INTEGER PRIMARY KEY AUTOINCREMENT,
subscription TEXT UNIQUE,
user_id TEXT
)
`);

/* =========================
ABBY
========================= */

const getAbbyClient = () => {

  const apiKey = process.env.ABBY_API_KEY;

  console.log("ABBY KEY LENGTH:", apiKey?.length);

  if (!apiKey) {
    console.error("ABBY_API_KEY manquante");
    return null;
  }

  return new Abby({ apiKey });
};

/* =========================
AUTH MICROSOFT
========================= */

const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET
  }
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

/* =========================
AUTH ROUTES
========================= */

app.get("/api/auth/url", async (req, res) => {

  try {

    const url = await cca.getAuthCodeUrl({
      scopes: ["user.read"],
      redirectUri: process.env.APP_URL + "/api/auth/callback"
    });

    res.json({ url });

  } catch (err) {

    res.status(500).json(err);

  }

});

app.get("/api/auth/callback", async (req: any, res) => {

  try {

    const token = await cca.acquireTokenByCode({
      code: req.query.code,
      scopes: ["user.read"],
      redirectUri: process.env.APP_URL + "/api/auth/callback"
    });

    req.session.user = token.account;

    res.redirect("/");

  } catch (err) {

    res.status(500).send(err);

  }

});

/* =========================
DATAVERSE
========================= */

app.get("/api/appointments", async (req, res) => {

  try {

    const data = await fetchDataverse("cr7e0_gestiontatouages");

    res.json(data);

  } catch (err: any) {

    res.status(500).json({ error: err.message });

  }

});

app.post("/api/appointments", async (req, res) => {

  try {

    const data = await createDataverse("cr7e0_gestiontatouages", req.body);

    res.json(data);

  } catch (err: any) {

    res.status(500).json({ error: err.message });

  }

});

app.patch("/api/appointments/:id", async (req, res) => {

  try {

    const data = await updateDataverse(
      "cr7e0_gestiontatouages",
      req.params.id,
      req.body
    );

    res.json(data);

  } catch (err: any) {

    res.status(500).json({ error: err.message });

  }

});

app.delete("/api/appointments/:id", async (req, res) => {

  try {

    await deleteDataverse("cr7e0_gestiontatouages", req.params.id);

    res.json({ success: true });

  } catch (err: any) {

    res.status(500).json({ error: err.message });

  }

});

/* =========================
ABBY TEST
========================= */

app.get("/api/abby/test", async (req, res) => {

  try {

    const abby = getAbbyClient();

    if (!abby) {
      return res.status(400).json({ error: "Clé Abby manquante" });
    }

    const contacts = await abby.contact.retrieveContacts({
      query: { limit: 1 }
    });

    res.json({
      success: true,
      contacts: contacts.data
    });

  } catch (err: any) {

    res.status(500).json({
      error: err.message
    });

  }

});

/* =========================
ABBY DOCUMENTS
========================= */

app.get("/api/abby/documents", async (req, res) => {

  try {

    const abby = getAbbyClient();

    if (!abby) {
      return res.status(400).json({ error: "Clé Abby manquante" });
    }

    const invoices = await abby.invoice.retrieveInvoices({
      query: { limit: 50 }
    });

    res.json(invoices.data);

  } catch (err: any) {

    res.status(500).json({
      error: err.message
    });

  }

});

/* =========================
ABBY CREATE INVOICE
========================= */

app.post("/api/abby/invoice", async (req, res) => {

  try {

    const abby = getAbbyClient();

    const invoice = await abby.invoice.createInvoiceByContactOrOrganizationId({
      path: { customerId: req.body.customerId }
    });

    res.json(invoice.data);

  } catch (err: any) {

    res.status(500).json({ error: err.message });

  }

});

/* =========================
NOTIFICATIONS
========================= */

const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

if (vapidPublic && vapidPrivate) {

  webpush.setVapidDetails(
    "mailto:contact@larabstrait.fr",
    vapidPublic,
    vapidPrivate
  );

  console.log("VAPID notifications activées");

} else {

  console.log("Notifications push désactivées (VAPID non configuré)");

}

app.post("/api/notifications/subscribe", (req: any, res) => {

  try {

    db.prepare(`
      INSERT OR REPLACE INTO subscriptions(subscription,user_id)
      VALUES(?,?)
    `).run(JSON.stringify(req.body), "default");

    res.json({ success: true });

  } catch {

    res.status(500).json({ error: "Subscription failed" });

  }

});

/* =========================
START SERVER
========================= */
app.get("/api/abby/raw-test", async (req, res) => {

  try {

    const response = await axios.get(
      "https://api.app-abby.com/contacts?page=1&limit=10",
      {
        headers: {
          Authorization: `Bearer ${process.env.ABBY_API_KEY}`,
          Accept: "application/json",
          "User-Agent": "larabstrait-app"
        }
      }
    )

    res.json(response.data)

  } catch (err:any) {

    res.status(500).json({
      error: err.response?.data || err.message
    })

  }

})
app.listen(PORT, () => {

  console.log(`>>> SERVEUR DÉMARRÉ SUR ${PORT}`);

});