#!/usr/bin/env python3
"""
sync_dapodik.py -- Sinkronisasi per-modul: Dapodik Web Service lokal -> CMS Vercel.

Alur (4 bagian diproses berurutan, masing-masing request kecil 1-2 detik):
  1. sekolah       -> POST { dataType: "sekolah", payload: {...} }
  2. gtk           -> POST { dataType: "gtk", payload: [...] }   (per batch)
  3. rombel        -> POST { dataType: "rombel", payload: [...] }
  4. peserta_didik -> POST { dataType: "peserta_didik", payload: [...] } (per batch)
Lalu di akhir: POST /api/dapodik/archive dengan daftar ID lengkap untuk
mengarsipkan data yang sudah tidak ada lagi di Dapodik.

Mengapa per-modul: jika satu bagian gagal, bagian lain yang sudah masuk tetap
aman, dan tiap request jauh di bawah batas waktu Vercel Hobby (~10 detik) --
tidak ada HTTP 504 FUNCTION_INVOCATION_TIMEOUT.

Endpoint tujuan: /api/dapodik/ingest (BUKAN /api/dapodik/sync -- endpoint itu
dipakai dashboard untuk tarik langsung dengan sesi admin).

Usage:
    python scripts/sync_dapodik.py                  # sync penuh 4 modul
    python scripts/sync_dapodik.py --dry-run        # preview tanpa menulis
    python scripts/sync_dapodik.py --module gtk     # hanya satu modul
    python scripts/sync_dapodik.py --batch-size 50  # ukuran batch (default 50)
    python scripts/sync_dapodik.py --no-archive     # lewati pengarsipan
    python scripts/sync_dapodik.py --ping           # test koneksi ke CMS

Env vars (set di .env.local atau shell):
    DAPODIK_BASE_URL   -- base URL Dapodik WS (default: http://localhost:5774/WebService)
    DAPODIK_TOKEN      -- token autentikasi Dapodik Web Service
    NPSN               -- NPSN sekolah
    VERCEL_SYNC_URL    -- URL endpoint ingest di Vercel (berakhir di /ingest)
    SYNC_SECRET_KEY    -- API key untuk autentikasi ke Vercel
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:
    print("ERROR: 'requests' belum terinstall. Jalankan: pip install requests")
    sys.exit(1)

DEFAULT_BATCH_SIZE = 50
MAX_RETRIES = 3
RETRY_STATUS = {429, 502, 503, 504}

# Urutan & pemetaan: nama modul -> (endpoint WS Dapodik, field payload di server)
TARGET_MODULES: dict[str, dict[str, str]] = {
    "sekolah": {"endpoint": "getSekolah", "data_type": "sekolah"},
    "gtk": {"endpoint": "getGtk", "data_type": "gtk"},
    "rombel": {"endpoint": "getRombonganBelajar", "data_type": "rombel"},
    "peserta_didik": {"endpoint": "getPesertaDidik", "data_type": "peserta_didik"},
}


# --- Config ------------------------------------------------------

def load_env(path: str = ".env.local") -> None:
    """Load variabel dari file .env (tanpa overrite yang sudah ada di env)."""
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def get_config() -> dict[str, str]:
    load_env()
    required = ["DAPODIK_TOKEN", "NPSN", "VERCEL_SYNC_URL", "SYNC_SECRET_KEY"]
    config: dict[str, str] = {}
    missing = [k for k in required if not os.environ.get(k, "").strip()]
    if missing:
        print(f"ERROR: Variabel env belum di-set: {', '.join(missing)}")
        print("Lihat docs/SYNC-DAPODIK-PYTHON.md untuk panduan setup.")
        sys.exit(1)
    for k in required:
        config[k] = os.environ[k].strip()
    config["DAPODIK_BASE_URL"] = os.environ.get(
        "DAPODIK_BASE_URL", "http://localhost:5774/WebService"
    ).rstrip("/")
    return config


# --- Logging -----------------------------------------------------

class Log:
    RESET = "\033[0m"
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    DIM = "\033[2m"

    @staticmethod
    def _ts() -> str:
        return datetime.now(timezone.utc).strftime("%H:%M:%S")

    @staticmethod
    def ok(msg: str) -> None:
        print(f"{Log.DIM}{Log._ts()}{Log.RESET} {Log.GREEN}[OK]{Log.RESET} {msg}")

    @staticmethod
    def err(msg: str) -> None:
        print(f"{Log.DIM}{Log._ts()}{Log.RESET} {Log.RED}[X]{Log.RESET} {msg}")

    @staticmethod
    def info(msg: str) -> None:
        print(f"{Log.DIM}{Log._ts()}{Log.RESET} {Log.CYAN}->{Log.RESET} {msg}")

    @staticmethod
    def warn(msg: str) -> None:
        print(f"{Log.DIM}{Log._ts()}{Log.RESET} {Log.YELLOW}[!]{Log.RESET} {msg}")


# --- Dapodik Web Service ----------------------------------------

def fetch_dapodik(config: dict[str, str], module: str) -> list[dict[str, Any]]:
    """GET data satu modul dari Dapodik Web Service lokal."""
    ws_method = TARGET_MODULES[module]["endpoint"]
    url = f"{config['DAPODIK_BASE_URL']}/{ws_method}"
    params = {"npsn": config["NPSN"]}
    headers = {"Authorization": f"Bearer {config['DAPODIK_TOKEN']}"}

    Log.info(f"GET {ws_method} -> {config['DAPODIK_BASE_URL']}")
    resp = requests.get(url, params=params, headers=headers, timeout=30)

    # Dapodik WS lokal sering membungkus error 403 sebagai HTTP 200 dengan
    # teks header HTTP di dalam body:
    #   HTTP/1.0 403 Forbidden\n...\n\n{"success":false,...,"message":"..."}
    # Deteksi pola itu dan parse pesan errornya agar log jelas.
    text = resp.text
    if text.lstrip().startswith("HTTP/"):
        # Dapodik memakai CRLF — cari objek JSON di bagian akhir body.
        match = re.search(r"\{[\s\S]*\}", text)
        msg = "request ditolak (lihat respons mentah di bawah)"
        if match:
            try:
                err = json.loads(match.group(0))
                msg = err.get("message") or msg
            except ValueError:
                pass
        raise RuntimeError(
            f"Dapodik WS menolak request: {msg}\n"
            "Buka Dapodik -> Pengaturan -> Web Services Lokal -> Tambah Aplikasi."
        )

    if resp.status_code == 403:
        raise RuntimeError(
            "HTTP 403 -- Token salah atau aplikasi belum terdaftar di Dapodik.\n"
            "Buka Dapodik -> Pengaturan -> Web Services Lokal -> Tambah Aplikasi."
        )
    resp.raise_for_status()

    try:
        data = resp.json()
    except ValueError:
        raise RuntimeError(
            f"Dapodik membalas bukan JSON (HTTP {resp.status_code}): {resp.text[:200]}"
        )
    rows = data.get("rows", data) if isinstance(data, dict) else data
    if isinstance(rows, dict):
        rows = [rows]  # getSekolah mengembalikan objek tunggal -> bungkus list
    return rows if isinstance(rows, list) else [rows]


# --- Push ke Vercel ----------------------------------------------

def _auth_headers(config: dict[str, str]) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "x-api-key": config["SYNC_SECRET_KEY"],
    }


def _post_with_retry(url: str, payload: dict, headers: dict[str, str]) -> dict:
    """POST dengan retry untuk 429/502/503/504 (backoff eksponensial)."""
    attempt = 0
    while True:
        attempt += 1
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=120)
        except requests.exceptions.ConnectionError:
            if attempt > MAX_RETRIES:
                raise RuntimeError(f"Tidak bisa terhubung ke CMS ({url}).")
            Log.warn(f"Koneksi gagal, coba lagi ({attempt}/{MAX_RETRIES})...")
            time.sleep(2**attempt)
            continue

        if resp.status_code in RETRY_STATUS and attempt <= MAX_RETRIES:
            delay = float(resp.headers.get("Retry-After", 2**attempt))
            Log.warn(
                f"HTTP {resp.status_code} (timeout/rate-limit), "
                f"coba lagi dalam {int(delay)}s ({attempt}/{MAX_RETRIES})..."
            )
            time.sleep(delay)
            continue

        try:
            body = resp.json()
        except ValueError:
            raise RuntimeError(
                f"CMS membalas bukan JSON (HTTP {resp.status_code}): {resp.text[:200]}"
            )

        if resp.status_code == 401:
            raise RuntimeError(f"Auth gagal (401): {body.get('error', body)}")
        if resp.status_code >= 400:
            raise RuntimeError(f"Error {resp.status_code}: {body.get('error', body)}")
        return body


def push_module(
    config: dict[str, str],
    data_type: str,
    payload: Any,
    dry_run: bool = False,
) -> dict:
    """Kirim satu modul ke /api/dapodik/ingest dengan format { dataType, payload }."""
    url = config["VERCEL_SYNC_URL"].rstrip("/")
    if dry_run:
        url += "?mode=dry-run"
    Log.info(f"POST {url} (dataType={data_type})")
    return _post_with_retry(url, {"dataType": data_type, "payload": payload}, _auth_headers(config))


def archive_dapodik(config: dict[str, str], pd_ids: list[str], gtk_ids: list[str]) -> dict:
    """Arsipkan yang tidak muncul lagi: POST /api/dapodik/archive (2-3 query)."""
    base = config["VERCEL_SYNC_URL"].rstrip("/")
    archive_url = base[: base.rfind("/")] + "/archive"
    Log.info(f"POST {archive_url} -- arsip data yang tidak muncul lagi")
    return _post_with_retry(
        archive_url,
        {"pesertaDidikIds": pd_ids, "gtkIds": gtk_ids},
        _auth_headers(config),
    )


# --- Sync per modul ----------------------------------------------

def sync_module(
    config: dict[str, str],
    module: str,
    batch_size: int,
    dry_run: bool,
) -> tuple[list[dict], list[str], list[str]]:
    """
    Tarik satu modul dari Dapodik dan kirim ke Vercel (berbatch bila perlu).
    Mengembalikan (hasil request, daftar peserta_didik_id, daftar nuptk/nip)
    untuk fase archive di akhir.
    """
    print(f"\n{'=' * 50}")
    print(f"  MEMPROSES BAGIAN: {module.upper()}")
    print(f"{'=' * 50}")

    data_type = TARGET_MODULES[module]["data_type"]

    # 1. Ambil dari Dapodik lokal
    try:
        items = fetch_dapodik(config, module)
    except requests.exceptions.ConnectionError:
        Log.err(f"Tidak bisa terhubung ke Dapodik WS lokal (modul {module}).")
        Log.warn("Pastikan Aplikasi Dapodik sedang berjalan di localhost.")
        raise SystemExit(1)
    except RuntimeError as e:
        Log.err(str(e))
        raise SystemExit(1)

    if not items:
        Log.warn(f"Data [{module}] kosong -- dilewati.")
        return [], [], []

    # sekolah dikirim sebagai objek tunggal; lainnya sebagai list per batch
    results: list[dict] = []
    pd_ids: list[str] = []
    gtk_ids: list[str] = []

    if module == "sekolah":
        obj = items[0]
        results.append(push_module(config, data_type, obj, dry_run))
    else:
        batches = [items[i : i + batch_size] for i in range(0, len(items), batch_size)]
        total = len(items)
        print(f"  Total: {total} item | batch: {len(batches)}")
        for idx, batch in enumerate(batches, start=1):
            try:
                r = push_module(config, data_type, batch, dry_run)
                results.append(r)
                print(f"  [OK] Batch {idx}/{len(batches)} [{module}] terkirim ({len(batch)} item)")
            except RuntimeError as e:
                print(f"  [X] Batch {idx}/{len(batches)} [{module}] gagal: {e}")
                raise

    # Kumpulkan ID untuk fase archive
    for item in items:
        if module == "peserta_didik" and item.get("peserta_didik_id"):
            pd_ids.append(str(item["peserta_didik_id"]))
        elif module == "gtk":
            if item.get("nuptk"):
                gtk_ids.append(str(item["nuptk"]))
            elif item.get("nip"):
                gtk_ids.append(str(item["nip"]))

    return results, pd_ids, gtk_ids


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sinkronisasi Dapodik per-modul -> CMS Vercel"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview perubahan tanpa menulis ke database")
    parser.add_argument("--module", choices=list(TARGET_MODULES.keys()),
                        help="Hanya sync satu modul (default: semua 4 modul)")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
                        help=f"Jumlah item per request (default: {DEFAULT_BATCH_SIZE})")
    parser.add_argument("--no-archive", action="store_true",
                        help="Lewati pengarsipan data yang tidak muncul lagi di Dapodik")
    parser.add_argument("--ping", action="store_true",
                        help="Test koneksi ke CMS Vercel (kirim ping, tanpa data)")
    args = parser.parse_args()

    config = get_config()
    batch_size = max(1, min(args.batch_size, 500))

    print(f"\n{'=' * 50}")
    print(f"  Dapodik Sync per-modul -- {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'=' * 50}")

    if args.ping:
        Log.info("Testing koneksi ke CMS...")
        result = _post_with_retry(
            config["VERCEL_SYNC_URL"], {"ping": True}, _auth_headers(config)
        )
        Log.ok(f"CMS merespons: {result.get('message', 'OK')}")
        return

    modules = [args.module] if args.module else list(TARGET_MODULES.keys())

    all_pd_ids: list[str] = []
    all_gtk_ids: list[str] = []

    for module in modules:
        _, pd_ids, gtk_ids = sync_module(config, module, batch_size, args.dry_run)
        all_pd_ids.extend(pd_ids)
        all_gtk_ids.extend(gtk_ids)
        time.sleep(1)  # jeda antar modul agar Dapodik WS rileks

    Log.ok("Semua modul terkirim.")
    if args.module:
        print(f"  (Hanya modul {args.module} -- tidak menjalankan fase archive)")

    # Arsip fase akhir (default aktif untuk sync penuh, non-dry-run)
    if not args.no_archive and not args.dry_run and not args.module:
        try:
            ar = archive_dapodik(config, all_pd_ids, all_gtk_ids)
            Log.ok(f"Arsip selesai: {ar.get('siswaArchived', 0)} siswa, "
                   f"{ar.get('gtkArchived', 0)} guru diarsipkan")
        except RuntimeError as e:
            Log.warn(f"Arsip gagal (data modul sudah terkirim): {e}")


if __name__ == "__main__":
    main()
