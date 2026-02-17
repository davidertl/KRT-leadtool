#!/bin/bash
# ================================================
# KRT-Leadtool Database Backup Script
# Run via cron: 0 2 * * * /opt/krt-leadtool/scripts/backup.sh
# ================================================

set -euo pipefail

# Load environment
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/../.env"

BACKUP_DIR="${BACKUP_DIR:-/opt/krt-leadtool/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%F_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "[KRT Backup] Starting database backup at $(date)"

# Dump database
docker exec krt-postgres pg_dump \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --no-owner \
  --no-privileges \
  --format=plain \
  | gzip > "${BACKUP_FILE}"

# Verify backup
if [ -s "${BACKUP_FILE}" ]; then
  SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "[KRT Backup] Success: ${BACKUP_FILE} (${SIZE})"
else
  echo "[KRT Backup] ERROR: Backup file is empty!" >&2
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# Rotate old backups
DELETED=$(find "${BACKUP_DIR}" -name "db_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
echo "[KRT Backup] Cleaned up ${DELETED} old backup(s) (>${RETENTION_DAYS} days)"

echo "[KRT Backup] Done at $(date)"
