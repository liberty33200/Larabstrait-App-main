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
  const dataverseUrl = process.env.DATAVERSE_URL;
  if (!dataverseUrl) {
    throw new Error("DATAVERSE_URL is not defined");
  }

  const tokenRequest = {
    scopes: [`${dataverseUrl}/.default`],
  };

  try {
    const clientApp = getCCA();
    const response = await clientApp.acquireTokenByClientCredential(tokenRequest);
    return response?.accessToken;
  } catch (error) {
    console.error("Error acquiring token:", error);
    throw error;
  }
}

export async function fetchDataverse(entityName: string, select?: string, filter?: string, expand?: string) {
  const token = await getAccessToken();
  const baseUrl = process.env.DATAVERSE_URL;
  // Si entityName est vide, on appelle la racine de l'API
  const url = entityName ? `${baseUrl}/api/data/v9.2/${entityName}` : `${baseUrl}/api/data/v9.2/`;
  
  console.log(`Appel Dataverse: ${url}`);
  
  const params: any = {};
  if (select) params["$select"] = select;
  if (filter) params["$filter"] = filter;
  if (expand) params["$expand"] = expand;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
        Prefer: "odata.include-annotations=\"*\""
      },
      params
    });
    return response.data.value || response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    console.error(`Erreur Dataverse pour ${entityName || 'root'}:`, errorMessage);
    throw new Error(errorMessage);
  }
}

export async function updateDataverse(entityName: string, id: string, data: any) {
  const token = await getAccessToken();
  const baseUrl = process.env.DATAVERSE_URL;
  const url = `${baseUrl}/api/data/v9.2/${entityName}(${id})`;
  
  console.log(`Mise à jour Dataverse: ${url}`);
  
  try {
    const response = await axios.patch(url, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
        Prefer: "return=representation"
      }
    });
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    console.error(`Erreur mise à jour Dataverse pour ${entityName} (${id}):`, errorMessage);
    throw new Error(errorMessage);
  }
}

export async function createDataverse(entityName: string, data: any) {
  const token = await getAccessToken();
  const baseUrl = process.env.DATAVERSE_URL;
  const url = `${baseUrl}/api/data/v9.2/${entityName}`;
  
  console.log(`Création Dataverse: ${url}`);
  
  try {
    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
        Prefer: "return=representation"
      }
    });
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    console.error(`Erreur création Dataverse pour ${entityName}:`, errorMessage);
    throw new Error(errorMessage);
  }
}

export async function deleteDataverse(entityName: string, id: string) {
  const token = await getAccessToken();
  const baseUrl = process.env.DATAVERSE_URL;
  const url = `${baseUrl}/api/data/v9.2/${entityName}(${id})`;
  
  console.log(`Suppression Dataverse: ${url}`);
  
  try {
    await axios.delete(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
      }
    });
    return true;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    console.error(`Erreur suppression Dataverse pour ${entityName} (${id}):`, errorMessage);
    throw new Error(errorMessage);
  }
}
