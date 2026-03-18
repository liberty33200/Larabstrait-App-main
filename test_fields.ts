
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
  const data = `client_id=${process.env.MICROSOFT_CLIENT_ID}&scope=${process.env.DATAVERSE_URL}/.default&client_secret=${process.env.MICROSOFT_CLIENT_SECRET}&grant_type=client_credentials`;

  try {
    const tokenRes = await axios.post(tokenUrl, data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const token = tokenRes.data.access_token;
    const baseUrl = process.env.DATAVERSE_URL;

    const res = await axios.get(`${baseUrl}/api/data/v9.2/cr7e0_gestiontatouages?$top=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        Accept: 'application/json',
        'Prefer': 'odata.include-annotations="*"'
      }
    });

    if (res.data.value && res.data.value.length > 0) {
      console.log("FIELDS FOUND:", Object.keys(res.data.value[0]).filter(k => k.startsWith('cr7e0_')));
    } else {
      console.log("No records found to inspect fields.");
    }
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }
}

test();
