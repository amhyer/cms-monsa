#!/usr/bin/env python3
"""
sync_dapodik.py -- Tarik data dari Dapodik Web Service lokal, push ke CMS Vercel.

Usage:
    python scripts/sync_dapodik.py                    # sync penuh (berchunk)
    python scripts/sync_dapodik.py --dry-run          # preview tanpa menulis
    python scripts/sync_dapodik.py --batch-size 50    # chunk lebih kecil
    python scripts/sync_dapodik.py --endpoint siswa   # filter endpoint
    python scripts/sync_dapodik.py --ping             # test koneksi ke CMS

Mengapa berchunk: fungsi serverless Vercel (Hobby) punya batas waktu ~10 detik.
Payload besar (200+ siswa) bisa kena HTTP 504 FUNCTION_INVOCATION_TIMEOUT.
Script ini mengirim data dalam beberapa chunk kecil, lalu mengarsipkan data
yang tidak muncul lagi di Dapodik via POST /api/dapodik/archive.

Env vars (set di .env.local atau shell):
    DAPODIK_BASE_URL   -- base URL Dapodik WS (default: http://localhost:5774/WebService)
    DAPODIK_TOKEN      -- token autentikasi Dapodik Web Service
    NPSN               -- NPSN sekolah
    VERCEL_SYNC_URL    -- URL endpoint ingest di Vercel
    SYNC_SECRET_KEY    -- API key untuk autentikasi ke Vercel
"""

from __future__ import annotations

import argparse
import json
import os
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

DEFAULT_BATCH_SIZE = 100
MAX_RETRIES = 3
RETRY_STATUS = {429, 502, 503, 504}

# --- Config ------------------------------------------------------

def load_env(path: str = ".env.local") -> None:
    """Load variabel dari file .env (tanpa overrite yang sudah ada di env)."""
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def get_config() -> dict[str, str]:
    load_env()
    required = ["DAPODIK_TOKEN", "NPSN", "VERCEL_SYNC_URL", "SYNC_SECRET_KEY"]
    config = {}
    missing = []
    for key in required:
        val = os.environ.get(key, "").strip()
        if not val:
            missing.append(key)
        config[key] = val
    if missing:
        print(f"ERROR: Variabel env belum di-set: {', '.join(missing)}")
        print("Lihat docs/SYNC-DAPODIK-PYTHON.md untuk panduan setup.")
        sys.exit(1)
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

ENDPOINTS = {
    "sekolah": "getSekolah",
    "siswa": "getPesertaDidik",
    "gtk": "getGtk",
    "rombel": "getRombonganBelajar",
}


def fetch_dapodik(config: dict[str, str], endpoint: str) -> list[dict[str, Any]]:
    """GET data dari Dapodik Web Service lokal."""
    ws_method = ENDPOINTS.get(endpoint)
    if not ws_method:
        raise ValueError(f"Endpoint tidak dikenal: {endpoint}")

    url = f"{config['DAPODIK_BASE_URL']}/{ws_method}"
    params = {"npsn": config["NPSN"]}
    headers = {"Authorization": f"Bearer {config['DAPODIK_TOKEN']}"}

    Log.info(f"GET {ws_method} -> {config['DAPODIK_BASE_URL']}")
    resp = requests.get(url, params=params, headers=headers, timeout=30)

    if resp.status_code == 403:
        raise RuntimeError(
            "HTTP 403 -- Token salah atau aplikasi belum terdaftar di Dapodik.\n"
            "Buka Dapodik -> Pengaturan -> Web Services Lokal -> Tambah Aplikasi."
        )
    resp.raise_for_status()

    data = resp.json()
    rows = data.get("rows", data)
    if isinstance(rows, dict):
        rows = [rows]
    return rows if isinstance(rows, list) else [rows]


def fetch_all(config: dict[str, str]) -> dict[str, Any]:
    """Tarik semua data dari Dapodik (sequential -- Dapodik WS tidak tahan paralel)."""
    sekolah_list = fetch_dapodik(config, "sekolah")
    sekolah = sekolah_list[0] if sekolah_list else {"nama": "", "npsn": config["NPSN"]}

    return {
        "sekolah": sekolah,
        "siswa": fetch_dapodik(config, "siswa"),
        "gtk": fetch_dapodik(config, "gtk"),
        "rombel": fetch_dapodik(config, "rombel"),
    }


# --- Push to Vercel ----------------------------------------------

def chunk_list(items: list, size: int) -> list[list]:
    return [items[i : i + size] for i in range(0, len(items), size)]


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
        except requests.exceptions.ConnectionError as e:
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


def push_to_vercel(config: dict[str, str], payload: dict, dry_run: bool = False) -> dict:
    """POST payload ke endpoint ingest di Vercel."""
    url = config["VERCEL_SYNC_URL"]
    if dry_run:
        url += "?mode=dry-run"
    Log.info(f"POST {url}")
    return _post_with_retry(url, payload, _auth_headers(config))


def push_chunks(
    config: dict[str, str],
    payload: dict[str, Any],
    batch_size: int,
    dry_run: bool = False,
) -> list[dict]:
    """
    Kirim data berchunk agar tiap request selesai di bawah batas waktu Vercel.
    - Request 1: sekolah + GTK + rombel (jumlah kecil).
    - Request 2..n: siswa per chunk.
    Semua chunk memakai archiveUnlisted:false; arsip dilakukan terpisah
    lewat archive_dapodik() setelah semua chunk berhasil.
    """
    sekolah = payload.get("sekolah", {})
    gtk = payload.get("gtk", [])
    rombel = payload.get("rombel", [])
    siswa = payload.get("siswa", [])

    results: list[dict] = []

    # Chunk 1: sekolah + guru + rombel (tanpa siswa)
    if gtk or rombel:
        r = push_to_vercel(
            config,
            {
                "sekolah": sekolah,
                "siswa": [],
                "gtk": gtk,
                "rombel": rombel,
                "archiveUnlisted": False,
            },
            dry_run,
        )
        results.append(r)

    # Chunk 2..n: siswa per batch
    batches = chunk_list(siswa, batch_size)
    for i, batch in enumerate(batches, start=1):
        Log.info(f"Chunk {i}/{len(batches)} -- {len(batch)} siswa")
        r = push_to_vercel(
            config,
            {
                "sekolah": sekolah,
                "siswa": batch,
                "gtk": [],
                "rombel": [],
                "archiveUnlisted": False,
            },
            dry_run,
        )
        results.append(r)

    return results


def archive_dapodik(
    config: dict[str, str],
    payload: dict[str, Any],
    dry_run: bool = False,
) -> dict:
    """
    Arsipkan siswa/guru yang tidak ada lagi di Dapodik.
    Mengirim daftar lengkap ID (peserta_didik_id + NUPTK/NIP) ke
    POST /api/dapodik/archive -- respons cepat (2-3 query).
    """
    base = config["VERCEL_SYNC_URL"].rstrip("/")
    # VERCEL_SYNC_URL berakhir di /ingest -> ganti ke /archive
    archive_url = base[: base.rfind("/")] + "/archive"
    if dry_run:
        archive_url += "?mode=dry-run"

    peserta_didik_ids = [
        s["peserta_didik_id"] for s in payload.get("siswa", []) if s.get("peserta_didik_id")
    ]
    gtk_ids = []
    for g in payload.get("gtk", []):
        if g.get("nuptk"):
            gtk_ids.append(str(g["nuptk"]))
        elif g.get("nip"):
            gtk_ids.append(str(g["nip"]))

    Log.info(f"POST {archive_url} -- arsip data tidak muncul lagi")
    return _post_with_retry(
        archive_url,
        {"pesertaDidikIds": peserta_didik_ids, "gtkIds": gtk_ids},
        _auth_headers(config),
    )


# --- Main --------------------------------------------------------

def print_summary(result: dict) -> None:
    """Tampilkan ringkasan sync."""
    s = result.get("siswa", {})
    g = result.get("gtk", {})
    r = result.get("rombel", {})
    mode = result.get("mode", "commit")

    tag = f" ({mode})" if mode == "dry-run" else ""
    Log.ok(f"Sinkronisasi selesai{tag}:")
    print(f"  Siswa  -- +{s.get('created', 0)} baru, ~{s.get('updated', 0)} update, "
          f"{s.get('archived', 0)} arsip, {s.get('errors', 0)} error")
    print(f"  Guru   -- +{g.get('created', 0)} baru, ~{g.get('updated', 0)} update, "
          f"{g.get('archived', 0)} arsip, {g.get('errors', 0)} error")
    print(f"  Rombel -- +{r.get('created', 0)} baru, ~{r.get('updated', 0)} update, "
          f"{r.get('errors', 0)} error")


def _fetch_payload(config: dict[str, str], endpoint: str) -> dict[str, Any]:
    """Tarik payload dari Dapodik sesuai filter endpoint."""
    if endpoint == "all":
        return fetch_all(config)
    rows = fetch_dapodik(config, endpoint)
    payload: dict[str, Any] = {endpoint: rows}
    # Tambah sekolah minimal agar normalizeDapodikPayload tidak error
    if endpoint != "sekolah":
        sekolah_list = fetch_dapodik(config, "sekolah")
        payload["sekolah"] = sekolah_list[0] if sekolah_list else {
            "nama": "", "npsn": config["NPSN"]
        }
    # Pastikan semua kunci ada (chunking butuh daftar lengkap)
    for key in ("sekolah", "siswa", "gtk", "rombel"):
        payload.setdefault(key, [])
    if "sekolah" in payload and not isinstance(payload["sekolah"], dict):
        payload["sekolah"] = {}
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sinkronisasi data Dapodik -> CMS Vercel (berchunk)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Preview perubahan tanpa menulis ke database"
    )
    parser.add_argument(
        "--endpoint", choices=list(ENDPOINTS.keys()) + ["all"],
        default="all",
        help="Filter endpoint: sekolah|siswa|gtk|rombel|all (default: all)"
    )
    parser.add_argument(
        "--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
        help=f"Jumlah siswa per request (default: {DEFAULT_BATCH_SIZE})"
    )
    parser.add_argument(
        "--no-archive", action="store_true",
        help="Lewati pengarsipan data yang tidak muncul lagi di Dapodik"
    )
    parser.add_argument(
        "--ping", action="store_true",
        help="Test koneksi ke CMS Vercel (kirim ping, tanpa data)"
    )
    args = parser.parse_args()

    config = get_config()
    batch_size = max(1, min(args.batch_size, 500))

    print(f"\n{'=' * 50}")
    print(f"  Dapodik Sync -- {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'=' * 50}\n")

    # Ping test
    if args.ping:
        Log.info("Testing koneksi ke CMS...")
        result = push_to_vercel(config, {"ping": True})
        Log.ok(f"CMS merespons: {result.get('message', 'OK')}")
        return

    # Fetch dari Dapodik
    try:
        payload = _fetch_payload(config, args.endpoint)
    except requests.exceptions.ConnectionError:
        Log.err("Tidak bisa terhubung ke Dapodik WS lokal.")
        Log.warn("Pastikan Aplikasi Dapodik sedang berjalan di localhost.")
        sys.exit(1)
    except RuntimeError as e:
        Log.err(str(e))
        sys.exit(1)

    siswa, gtk, rombel = payload.get("siswa", []), payload.get("gtk", []), payload.get("rombel", [])
    Log.info(f"Teralihkan: {len(siswa)} siswa, {len(gtk)} guru, {len(rombel)} rombel")

    if args.endpoint == "sekolah":
        # Hanya sekolah — satu request kecil
        try:
            result = push_to_vercel(config, payload, dry_run=args.dry_run)
            Log.ok(f"Sekolah tersimpan: {result.get('sekolah', {}).get('updated', '?')} update")
        except RuntimeError as e:
            Log.err(f"Push gagal: {e}")
            sys.exit(1)
        return

    # Push berchunk
    try:
        results = push_chunks(config, payload, batch_size, dry_run=args.dry_run)
    except RuntimeError as e:
        Log.err(f"Push gagal: {e}")
        sys.exit(1)

    # Ringkasan dari chunk terakhir yang berisi data siswa
    last_with_siswa = next(
        (r for r in reversed(results) if r.get("siswa")), results[-1] if results else {}
    )
    print_summary(last_with_siswa)

    # Arsip fase akhir (kecuali --no-archive / dry-run / endpoint non-all)
    if not args.no_archive and not args.dry_run and args.endpoint == "all":
        try:
            ar = archive_dapodik(config, payload)
            Log.ok(f"Arsip selesai: {ar.get('siswaArchived', 0)} siswa, "
                   f"{ar.get('gtkArchived', 0)} guru diarsipkan")
        except RuntimeError as e:
            Log.warn(f"Arsip gagal (data sudah terkirim): {e}")


if __name__ == "__main__":
    main()