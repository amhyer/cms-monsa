import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
// Branch Neon dibuat dalam hitungan detik; 60s memberi ruang aman untuk
// pembuatan + pruning dalam satu panggilan cron.
export const maxDuration = 60;

const NEON_API_BASE = "https://console.neon.tech/api/v2";

/**
 * Backup database Neon secara berkala (dipanggil Vercel Cron).
 *
 * Strategi backup: membuat BRANCH Neon baru (snapshot point-in-time dari
 * seluruh data) lalu memangkas branch backup lama melebihi BACKUP_RETENTION.
 * Branch Neon adalah mekanisme backup resmi — copy-on-write, murah, dan bisa
 * di-restore kapan saja dari dashboard Neon (Branching → Restore).
 *
 * Environment variables yang dibutuhkan:
 *   CRON_SECRET      — token otorisasi. Vercel Cron mengirim header
 *                      `Authorization: Bearer $CRON_SECRET` otomatis bila
 *                      variabel ini diset di project.
 *   NEON_API_KEY     — API key dari Neon Console (Settings → Developer
 *                      settings → API keys).
 *   NEON_PROJECT_ID  — ID project Neon (ada di URL dashboard, format
 *                      `https://console.neon.tech/app/projects/<ID>`).
 *   BACKUP_RETENTION — (opsional) jumlah backup yang dipertahankan.
 *                      Default 7 (7 hari backup harian).
 *
 * Test manual:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://<project>.vercel.app/api/cron/backup
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.error("[cron:backup] CRON_SECRET belum di-set — backup nonaktif.");
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET belum dikonfigurasi." },
      { status: 503 }
    );
  }

  // Vercel Cron mengirim `Authorization: Bearer $CRON_SECRET` otomatis.
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  if (!apiKey || !projectId) {
    logger.error("[cron:backup] NEON_API_KEY / NEON_PROJECT_ID belum di-set.");
    return NextResponse.json(
      { ok: false, error: "Konfigurasi Neon belum lengkap." },
      { status: 503 }
    );
  }

  const retention = Math.max(
    1,
    Number.parseInt(process.env.BACKUP_RETENTION ?? "7", 10) || 7
  );
  const stamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14); // YYYYMMDDHHMMSS
  const branchName = `backup-${stamp}`;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    // 1) Buat branch backup (snapshot data saat ini).
    const createRes = await fetch(
      `${NEON_API_BASE}/projects/${projectId}/branches`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ branch: { name: branchName } }),
      }
    );
    if (!createRes.ok) {
      const body = await createRes.text();
      logger.error({ status: createRes.status, body }, "[cron:backup] Gagal buat branch");
      return NextResponse.json(
        { ok: false, error: `Gagal membuat branch (${createRes.status}).` },
        { status: 502 }
      );
    }
    const created = (await createRes.json()) as {
      branch: { id: string; name: string };
    };

    // 2) Pruning: hapus branch backup lama di luar retention.
    const listRes = await fetch(
      `${NEON_API_BASE}/projects/${projectId}/branches`,
      { headers }
    );
    let pruned: string[] = [];
    if (listRes.ok) {
      const list = (await listRes.json()) as {
        branches: Array<{ id: string; name: string; created_at: string }>;
      };
      const backups = list.branches
        .filter((b) => b.name?.startsWith("backup-"))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)); // terbaru dulu
      const toDelete = backups.slice(retention);
      for (const b of toDelete) {
        const delRes = await fetch(
          `${NEON_API_BASE}/projects/${projectId}/branches/${b.id}`,
          { method: "DELETE", headers }
        );
        if (delRes.ok) pruned.push(b.name);
        else
          logger.error({ branch: b.name, status: delRes.status }, "[cron:backup] Gagal hapus branch");
      }
    } else {
      logger.warn("[cron:backup] Pruning dilewati — gagal list branch.");
    }

    return NextResponse.json({
      ok: true,
      backup: { id: created.branch.id, name: created.branch.name },
      pruned,
      retention,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    logger.error({ err: e }, "[cron:backup] Error");
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 502 }
    );
  }
}