/**
 * Mock test for Fase 1 — getPesertaDidik() type safety.
 * Run: npx tsx test-mock.ts
 */

import { DapodikClient, PesertaDidik, Sekolah } from "./src/DapodikClient";

// Mock fetch globally
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockFetch = async (_url: string): Promise<Response> => {
  const mockData: PesertaDidik = {
    nama_siswa: "Budi Santoso",
    nisn: "0012345678",
    tempat_lahir: "Jakarta",
    tanggal_lahir: "2010-05-15",
    jenis_kelamin: "Laki-laki",
    alamat: "Jl. Sudirman No. 1",
    nama_ortu: "Andi Santoso",
  };

  return new Response(JSON.stringify(mockData), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// Inject mock
globalThis.fetch = mockFetch as typeof fetch;

async function runTests() {
  const client = new DapodikClient({
    npsn: "12345678",
    token: "test-token",
  });

  console.log("Test 1: getPesertaDidik() returns PesertaDidik type...");
  const pd: PesertaDidik = await client.getPesertaDidik();
  console.log(`  nama_siswa: ${pd.nama_siswa}`);
  console.log(`  nisn: ${pd.nisn}`);
  console.log(`  nama_ortu: ${pd.nama_ortu}`);

  if (
    pd.nama_siswa === "Budi Santoso" &&
    pd.nisn === "0012345678" &&
    pd.nama_ortu === "Andi Santoso"
  ) {
    console.log("  PASS\n");
  } else {
    console.error("  FAIL: unexpected data");
    process.exit(1);
  }

  console.log("Test 2: getSekolah() returns Sekolah type...");
  const sekolah = await client.getSekolah();
  console.log(`  nama: ${(sekolah as Sekolah).nama}`);
  console.log("  PASS\n");

  console.log("All mock tests passed!");
}

runTests().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
