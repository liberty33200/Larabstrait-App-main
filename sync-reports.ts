import axios from "axios";
import Database from "better-sqlite3";

// Remplace par la VRAIE URL de ton application en ligne
const PROD_URL = "https://app.larabstrait.fr"; 

async function syncReports() {
  console.log("⏳ Connexion à la production...");
  const db = new Database("notifications.db");

  try {
    // 1. On télécharge les données de la prod
    const response = await axios.get(`${PROD_URL}/api/reports`);
    const reports = response.data;

    if (!Array.isArray(reports)) {
      throw new Error("Format de données invalide reçu de la prod.");
    }

    // 2. On prépare la requête pour mettre à jour la base locale
    // INSERT OR REPLACE permet de créer les nouveaux et mettre à jour les anciens
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO reports (id, user_id, content, completed, timestamp) 
      VALUES (?, ?, ?, ?, ?)
    `);

    // 3. On injecte tout d'un coup
    db.transaction(() => {
      for (const report of reports) {
        stmt.run(report.id, report.user_id, report.content, report.completed, report.timestamp);
      }
    })();

    console.log(`✅ Synchronisation terminée ! ${reports.length} tickets mis à jour en local.`);
  } catch (error: any) {
    console.error("❌ Erreur de synchronisation :", error.message);
  }
}

syncReports();