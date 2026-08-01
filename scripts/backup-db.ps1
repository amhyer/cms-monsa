# CMS MONSA - Backup Database & Uploads (Windows PowerShell)
# Jalankan via Task Scheduler, mis. tiap hari 02:00:
#   powershell.exe -ExecutionPolicy Bypass -File <path>\scripts\backup-db.ps1
# Menyimpan 14 backup terakhir (rotasi otomatis).

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$BackupDir = Join-Path $Root "backups"
$Retention = 14

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"

# 1) PostgreSQL (produksi) - jika DATABASE_URL postgres, lakukan pg_dump
$dbUrl = $env:DATABASE_URL
if ($dbUrl -like "postgresql://*" -or $dbUrl -like "postgres://*") {
    $m = [regex]::Match($dbUrl, "postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(\w+)")
    if ($m.Success) {
        $user = $m.Groups[1].Value
        $pass = $m.Groups[2].Value
        $host = $m.Groups[3].Value
        $port = if ($m.Groups[4].Value) { $m.Groups[4].Value } else { "5432" }
        $db   = $m.Groups[5].Value
        $env:PGPASSWORD = $pass
        $dump = Join-Path $BackupDir "db-$Stamp.sql"
        & pg_dump -h $host -p $port -U $user -d $db -F c -f $dump
        if ($LASTEXITCODE -ne 0) { throw "pg_dump gagal" }
        Write-Host "Backup PostgreSQL -> $dump"
    } else {
        throw "DATABASE_URL postgres tidak dapat di-parse"
    }
} else {
    # 2) SQLite (dev/testing)
    $dbFile = Join-Path $Root "prisma\db\custom.db"
    if (Test-Path $dbFile) {
        $dump = Join-Path $BackupDir "db-$Stamp.db"
        Copy-Item $dbFile $dump
        Write-Host "Backup SQLite -> $dump"
    } else {
        throw "File database tidak ditemukan: $dbFile"
    }
}

# 3) Uploads (user-generated content)
$uploadDir = Join-Path $Root "public\uploads"
if (Test-Path $uploadDir) {
    $zip = Join-Path $BackupDir "uploads-$Stamp.zip"
    Compress-Archive -Path (Join-Path $uploadDir "*") -DestinationPath $zip
    Write-Host "Backup uploads -> $zip"
}

# 4) Rotasi: hapus backup lebih tua dari $Retention hari
Get-ChildItem $BackupDir -File | Where-Object {
    $_.Name -match "^(db|uploads)-\d{8}-\d{6}\."
} | Sort-Object Name | Group-Object { $_.Name -replace "-(db|uploads)", "" } | ForEach-Object {
    $_.Group | Select-Object -First ([Math]::Max(0, $_.Count - $Retention)) | Remove-Item -Force
}

Write-Host "Backup selesai. Direktori: $BackupDir"
