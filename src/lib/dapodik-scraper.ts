import { chromium, type Locator, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const MODULE_ENDPOINTS = {
  sekolah: { label: "Sekolah", expectedFile: "Sekolah.csv" },
  peserta_didik: { label: "Peserta Didik", expectedFile: "PesertaDidik.csv" },
  gtk: { label: "Guru & Tenaga Kependidikan (GTK)", expectedFile: "GTK.csv" },
  rombongan_belajar: { label: "Rombongan Belajar", expectedFile: "RombonganBelajar.csv" },
} as const;

type ScrapedModule = { name: string; filePath: string; recordCount: number };
type ScrapeResult = { success: boolean; modules: ScrapedModule[]; error?: string };

async function exportModule(page: Page, moduleLabel: string, downloadDir: string): Promise<void> {
  console.log(`Exporting module: ${moduleLabel}`);
  const navPaths = ["/manajemen-data/export", "/export-data", "/manajemen-data", "/data-management", "/export", "/manajemen/export", "/data/export", "/master-data/export"];

  for (const navPath of navPaths) {
    try {
      const response = await page.goto(`${process.env.DAPODIK_URL || "http://localhost:5774"}${navPath}`, { waitUntil: "networkidle", timeout: 10000 });
      if (!response || !response.ok()) continue;
      const hasExport = await page.evaluate(() => document.body.innerText.toLowerCase().includes("export") || document.body.innerText.toLowerCase().includes("unduh") || document.body.innerText.toLowerCase().includes("download") || document.body.innerText.toLowerCase().includes("csv") || document.body.innerText.toLowerCase().includes("excel"));
      if (response.ok() && hasExport) { console.log(`Found export page at ${navPath}`); break; }
    } catch { continue; }
  }

  const exportSelectors = ['button:has-text("Export")', 'button:has-text("Unduh")', 'button:has-text("Download")', 'a:has-text("Export")', 'a:has-text("Unduh")', 'button:has-text("Export Data")', 'button:has-text("Unduh Data")', 'a:has-text("Export Data")', 'a:has-text("Unduh Data")', 'button.export-btn', 'a.export-btn', 'button[data-action="export"]', 'input[type="submit"][value*="Export"]', 'input[type="submit"][value*="Unduh"]'];
  
  for (const sel of exportSelectors) {
    try { const btn = page.locator(sel).first(); if (await btn.count() > 0) { await exportModuleByButton(page, btn.first(), downloadDir); return; } } catch { continue; }
  }
  
  fs.writeFileSync("dapodik-debug.html", await page.content());
  throw new Error("Tidak menemukan halaman/tombol export. Cek dapodik-debug.html untuk debug.");
}

async function exportModuleByButton(page: Page, button: Locator, downloadDir: string): Promise<void> {
  const downloadPromise = page.waitForEvent("download", { timeout: 60000 });
  await button.click();
  const download = await downloadPromise;
  const savePath = path.join(downloadDir, download.suggestedFilename());
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });
  await download.saveAs(savePath);
  await new Promise(r => setTimeout(r, 3000));
  console.log(`Downloaded: ${download.suggestedFilename()} -> ${savePath}`);
}

export async function scrapeDapodikCSV(config: { dapodikUrl: string; username: string; password: string; downloadDir: string; headless?: boolean; timeout?: number }): Promise<ScrapeResult> {
  if (!fs.existsSync(config.downloadDir)) fs.mkdirSync(config.downloadDir, { recursive: true });

  const browser = await chromium.launch({ headless: config.headless ?? true });
  // downloadsPath bukan opsi BrowserContextOptions — file diunduh eksplisit
  // lewat download.saveAs() di exportModuleByButton.
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    console.log(`[DEBUG] Navigating to ${config.dapodikUrl}`);
    await page.goto(config.dapodikUrl, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector('input[name="username"], input[name="email"], input[name="username_login"], input[id="username"]', { timeout: 10000 });

    const userSelectors = ['input[name="username"]', 'input[name="email"]', 'input[name="username_login"]', 'input[id="username"]', 'input[type="text"]'];
    for (const sel of userSelectors) { try { await page.fill(sel, config.username, { timeout: 2000 }); break; } catch { continue; } }

    const passSelectors = ['input[name="password"]', 'input[name="password_login"]', 'input[type="password"]'];
    for (const sel of passSelectors) { try { await page.fill(sel, config.password, { timeout: 2000 }); break; } catch { continue; } }

    const loginSelectors = ['button[type="submit"]', 'button:has-text("Masuk")', 'button:has-text("Login")', 'input[type="submit"]', 'button[type="submit"]'];
    for (const sel of loginSelectors) { try { await page.click(sel, { timeout: 2000 }); break; } catch { continue; } }

    await page.waitForLoadState("networkidle", { timeout: 30000 });

    const currentUrl = page.url();
    if (currentUrl.includes("login") || currentUrl.includes("auth")) { throw new Error("Login gagal: kredensial salah atau halaman login tidak berubah"); }
    console.log("Login berhasil!");

    const modules: ScrapedModule[] = [];

    for (const [key, info] of Object.entries(MODULE_ENDPOINTS)) {
      try {
        await exportModule(page, info.label, config.downloadDir);
        const files = fs.readdirSync(config.downloadDir)
          .filter(f => f.toLowerCase().includes(info.expectedFile.toLowerCase().replace(".csv", "")))
          .map(f => path.join(config.downloadDir, f))
          .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        const latestFile = files[0];
        let recordCount = 0;
        if (latestFile && fs.existsSync(latestFile)) {
          // CSV Dapodik ber-CRLF & berakhiran newline — buang baris kosong agar
          // jumlah record tidak kelebihan satu.
          const lines = fs.readFileSync(latestFile, "utf-8").split(/\r?\n/).filter(l => l.trim().length > 0);
          recordCount = Math.max(0, lines.length - 1);
        }
        modules.push({ name: key, filePath: latestFile || "", recordCount });
        console.log(`✓ ${info.label}: ${recordCount} records`);
      } catch (err) { console.error(`✗ ${info.label} gagal:`, err); }
    }

    if (modules.length === 0) {
      return { success: false, modules: [], error: "Semua modul gagal diexport — lihat log di atas & dapodik-debug.html." };
    }
    return { success: true, modules };
  } catch (err) { return { success: false, modules: [], error: String(err) }; } finally { await browser.close().catch(() => {}); }
}

export async function runDapodikScraper(config: { dapodikUrl: string; username: string; password: string; downloadDir?: string; headless?: boolean }): Promise<ScrapeResult> {
  const downloadDir = config.downloadDir || path.join(process.cwd(), "csv_files");
  return scrapeDapodikCSV({ dapodikUrl: config.dapodikUrl, username: config.username, password: config.password, downloadDir, headless: config.headless ?? true });
}

export { MODULE_ENDPOINTS };