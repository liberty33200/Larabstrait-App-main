import * as msal from "@azure/msal-node";
import axios from "axios";

let cca: msal.ConfidentialClientApplication | null = null;

function getCCA() {
  if (!cca) {
    const msalConfig = {
      auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID || "",
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}`,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
      }
    };
    cca = new msal.ConfidentialClientApplication(msalConfig);
  }
  return cca;
}

async function getAccessToken() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId || tenantId === "common") {
    throw new Error("Configuration Microsoft incomplète : CLIENT_ID, CLIENT_SECRET ou TENANT_ID (ne doit pas être 'common') manquant.");
  }

  const tokenRequest = {
    scopes: ["https://graph.microsoft.com/.default"],
  };

  try {
    const clientApp = getCCA();
    const response = await clientApp.acquireTokenByClientCredential(tokenRequest);
    return response?.accessToken;
  } catch (error: any) {
    console.error("Erreur acquisition token Graph:", error.message);
    throw new Error(`Erreur d'authentification Microsoft : ${error.message}`);
  }
}

export async function fetchGraph(endpoint: string, params: any = {}) {
  try {
    const token = await getAccessToken();
    const url = `https://graph.microsoft.com/v1.0/${endpoint}`;
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      params
    });
    return response.data.value || response.data;
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const details = error.response.data?.error?.message || "";
      if (status === 401) {
        throw new Error("Accès refusé (401) : Vérifiez que le Client Secret est valide et que le Tenant ID n'est pas 'common'.");
      }
      if (status === 403) {
        throw new Error("Permission manquante (403) : Assurez-vous d'avoir ajouté 'Bookings.Read.All' en type 'Application' et d'avoir cliqué sur 'Accorder le consentement de l'administrateur'.");
      }
      throw new Error(`Erreur Microsoft Graph (${status}) : ${details}`);
    }
    throw error;
  }
}

export async function fetchBookingTimeOff(businessId: string) {
  if (!businessId) return [];
  
  try {
    // On récupère d'abord les membres du staff pour avoir leurs IDs
    const staffMembers = await fetchGraph(`solutions/bookingBusinesses/${businessId}/staffMembers`);
    
    let allTimeOff: any[] = [];
    
    // Pour chaque membre du staff, on récupère ses TimeOff
    // Note: L'API v1.0 n'a pas de endpoint direct pour lister tous les TimeOff d'un coup facilement
    // On va essayer de passer par le calendarView si possible, ou boucler sur le staff
    
    for (const staff of staffMembers) {
      try {
        // Tentative de récupération via calendarView qui contient souvent les indisponibilités
        // On prend une large plage (ex: année en cours)
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1).toISOString();
        const end = new Date(now.getFullYear(), 11, 31).toISOString();
        
        const calendarItems = await fetchGraph(`solutions/bookingBusinesses/${businessId}/calendarView`, {
          startDateTime: start,
          endDateTime: end
        });
        
        // On filtre les items qui ne sont pas des rendez-vous classiques (souvent marqués différemment)
        // Ou on cherche spécifiquement les TimeOff si l'API le permet
        // En v1.0, les TimeOff sont des objets distincts
        
        // Si on ne trouve pas dans calendarView, on peut essayer de lister les TimeOff s'ils existent
        // Mais calendarView est plus complet pour le planning
        
        const timeOffItems = calendarItems.filter((item: any) => item['@odata.type'] === '#microsoft.graph.bookingAppointment' && item.serviceId === null);
        // Souvent les TimeOff n'ont pas de serviceId
        
        allTimeOff = [...allTimeOff, ...timeOffItems];
      } catch (err) {
        console.error(`Erreur lors de la récupération du calendrier pour ${staff.displayName}:`, err);
      }
    }
    
    return allTimeOff;
  } catch (error) {
    console.error("Erreur fetchBookingTimeOff:", error);
    return [];
  }
}
