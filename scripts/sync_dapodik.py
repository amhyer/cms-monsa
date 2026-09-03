#!/usr/bin/env python3
"""
sync_dapodik.py -- Tarik data dari Dapodik Web Service lokal, push ke CMS Vercel.

Usage:
    python scripts/sync_dapodik.py              # sync penuh
    python scripts/sync_dapodik.py --dry-run    # preview tanpa menulis
    python scripts/sync_dapodik.py --endpoint sekolah   # filter endpoint
    python scripts/sync_dapodik.py --ping       # test koneksi ke CMS

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

def push_to_vercel(config: dict[str, str], payload: dict, dry_run: bool = False) -> dict:
    """POST payload ke endpoint ingest di Vercel."""
    url = config["VERCEL_SYNC_URL"]
    if dry_run:
        url += "?mode=dry-run"

    headers = {
        "Content-Type": "application/json",
        "x-api-key": config["SYNC_SECRET_KEY"],
    }

    Log.info(f"POST {url}")
    resp = requests.post(url, json=payload, headers=headers, timeout=120)

    try:
        body = resp.json()
    except ValueError:
        raise RuntimeError(f"Response bukan JSON: {resp.text[:200]}")

    if resp.status_code == 401:
        raise RuntimeError(f"Auth gagal ({resp.status_code}): {body.get('error', body)}")
    if resp.status_code >= 400:
        raise RuntimeError(f"Error {resp.status_code}: {body.get('error', body)}")

    return body


# --- Main --------------------------------------------------------

def print_summary(result: dict) -> None:
    """Tampilkan ringkasan sync."""
    if "error" in result and not isinstance(result.get("sekolah"), dict):
        Log.err(result.get("error", "Unknown error"))
        return

    s = result.get("siswa", {})
    g = result.get("gtk", {})
    r = result.get("rombel", {})
    mode = result.get("mode", "commit")

    tag = f" ({mode})" if mode == "dry-run" else ""
    Log.ok(f"Sinkronisasi selesai{tag}:")
    print(f"  Siswa  -- +{s.get('created', 0)} baru, ~{s.get('updated', 0)} update, "
          f"📁 {s.get('archived', 0)} arsip, [!] {s.get('errors', 0)} error")
    print(f"  Guru   -- +{g.get('created', 0)} baru, ~{g.get('updated', 0)} update, "
          f"📁 {g.get('archived', 0)} arsip, [!] {g.get('errors', 0)} error")
    print(f"  Rombel -- +{r.get('created', 0)} baru, ~{r.get('updated', 0)} update, "
          f"[!] {r.get('errors', 0)} error")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sinkronisasi data Dapodik -> CMS Vercel"
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
        "--ping", action="store_true",
        help="Test koneksi ke CMS Vercel (kirim ping, tanpa data)"
    )
    args = parser.parse_args()

    config = get_config()

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
        if args.endpoint == "all":
            payload = fetch_all(config)
        else:
            rows = fetch_dapodik(config, args.endpoint)
            payload = {args.endpoint: rows}
            # Tambah sekolah minimal agar normalizeDapodikPayload tidak error
            if args.endpoint != "sekolah":
                sekolah_list = fetch_dapodik(config, "sekolah")
                payload["sekolah"] = sekolah_list[0] if sekolah_list else {
                    "nama": "", "npsn": config["NPSN"]
                }
    except requests.exceptions.ConnectionError:
        Log.err("Tidak bisa terhubung ke Dapodik WS lokal.")
        Log.warn("Pastikan Aplikasi Dapodik sedang berjalan di localhost.")
        sys.exit(1)
    except RuntimeError as e:
        Log.err(str(e))
        sys.exit(1)

    Log.info(f"Teralihkan: {len(payload.get('siswa', []))} siswa, "
             f"{len(payload.get('gtk', []))} guru, "
             f"{len(payload.get('rombel', []))} rombel")

    # Push ke Vercel
    try:
        result = push_to_vercel(config, payload, dry_run=args.dry_run)
        print_summary(result)
    except RuntimeError as e:
        Log.err(f"Push gagal: {e}")
        sys.exit(1)
    except requests.exceptions.ConnectionError:
        Log.err("Tidak bisa terhubung ke CMS Vercel.")
        Log.warn("Periksa koneksi internet dan URL VERCEL_SYNC_URL.")
        sys.exit(1)


if __name__ == "__main__":
    main()
