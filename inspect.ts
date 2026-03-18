import { fetchDataverse } from "./dataverseService";
import dotenv from "dotenv";
dotenv.config();

async function inspect() {
  try {
    const data = await fetchDataverse("cr7e0_gestiontatouages");
    if (data && data.length > 0) {
      console.log("Fields in cr7e0_gestiontatouages:");
      console.log(Object.keys(data[0]).filter(k => k.startsWith("cr7e0_")));
      console.log("Sample record:", JSON.stringify(data[0], null, 2));
    } else {
      console.log("No records found.");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

inspect();
