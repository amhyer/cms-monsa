import { DapodikClient } from "./src/DapodikClient";
import { loadConfig } from "./config";

const config = loadConfig();
const client = new DapodikClient(config);

async function main() {
  try {
    const sekolah = await client.getSekolah();
    console.log("Berhasil!", sekolah);
  } catch (err) {
    console.error("Gagal:", err);
  }
}

main();
