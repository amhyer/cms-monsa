# CMS MONSA - Backup Scripts

## Overview

Automated backup system for PostgreSQL database and user uploads.

## Files

| File | Purpose |
|------|---------|
| `backup-db.sh` | Main backup script (Linux/macOS) |
| `backup-db.ps1` | Main backup script (Windows PowerShell) |
| `backup-cron.sh` | Cron wrapper with logging |
| `docker-compose.cron.yml` | Docker Compose override for cron service |
| `cms-monsa-backup.service` | systemd service file |
| `cms-monsa-backup.timer` | systemd timer for daily backups |

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Start with cron service
docker compose -f docker-compose.yml -f docker-compose.cron.yml up -d

# Check logs
docker compose logs -f cron

# Manual backup
docker compose exec cron /app/scripts/backup-db.sh
```

### Option 2: Linux (systemd)

```bash
# Copy service files
sudo cp scripts/cms-monsa-backup.service /etc/systemd/system/
sudo cp scripts/cms-monsa-backup.timer /etc/systemd/system/

# Enable and start timer
sudo systemctl daemon-reload
sudo systemctl enable cms-monsa-backup.timer
sudo systemctl start cms-monsa-backup.timer

# Check status
sudo systemctl status cms-monsa-backup.timer
sudo systemctl list-timers | grep cms-monsa
```

### Option 3: Linux (crontab)

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 02:00)
0 2 * * * cd /srv/cms-monsa && ./scripts/backup-db.sh >> /var/log/cms-monsa-backup.log 2>&1
```

### Option 4: Windows (Task Scheduler)

```powershell
# Open Task Scheduler
taskschd.msc

# Create Basic Task
- Name: CMS MONSA Daily Backup
- Trigger: Daily at 02:00
- Action: Start a Program
  - Program: powershell.exe
  - Arguments: -ExecutionPolicy Bypass -File C:\path\to\scripts\backup-db.ps1
```

## Backup Contents

| Type | Description | Retention |
|------|-------------|-----------|
| Database | PostgreSQL dump (`.sql`) | 14 backups |
| Uploads | Tarball of `public/uploads/` directory | 14 backups |

## Backup Location

```
backups/
├── db-20260807-020000.sql      # PostgreSQL dump
├── uploads-20260807-020000.tar.gz  # Uploads tarball
└── ...
```

## Restore Instructions

### PostgreSQL

```bash
# Stop the application
docker compose stop app

# Restore database
PGPASSWORD=your_password pg_restore -h localhost -p 5432 -U postgres -d cms_mongisidi -c backups/db-YYYYMMDD-HHMMSS.sql

# Start the application
docker compose start app
```

### Uploads

```bash
# Restore uploads
tar -xzf backups/uploads-YYYYMMDD-HHMMSS.tar.gz -C public/
```

## Monitoring

### Check Backup Logs

```bash
# Docker
docker compose logs cron

# systemd
journalctl -u cms-monsa-backup.service

# crontab
tail -f /var/log/cms-monsa-backup.log
```

### Verify Backups

```bash
# List recent backups
ls -lh backups/

# Check backup size
du -sh backups/

# Verify PostgreSQL dump
pg_restore --list backups/db-YYYYMMDD-HHMMSS.sql
```

## Troubleshooting

### Backup Fails

1. Check DATABASE_URL is set correctly
2. Verify PostgreSQL is running and accessible
3. Check disk space in backups directory
4. Review logs for error messages

### Cron Job Not Running

1. Verify cron service is running: `systemctl status cron`
2. Check crontab: `crontab -l`
3. Verify script permissions: `ls -la scripts/backup-db.sh`
4. Check system logs: `grep CRON /var/log/syslog`

### Docker Cron Not Running

1. Check container status: `docker compose ps cron`
2. View logs: `docker compose logs cron`
3. Restart container: `docker compose restart cron`
