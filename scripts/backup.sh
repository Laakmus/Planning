#!/bin/bash
# =============================================================================
# Planning App — Backup PostgreSQL
# Cron: 0 3 * * * root /opt/planning-app/scripts/backup.sh
# =============================================================================

set -euo pipefail

# --- Konfiguracja (nadpisywalna przez zmienne środowiskowe) ---
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/planning}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${BACKUP_DIR}/planning_${TIMESTAMP}.dump"
LOG_PREFIX="[backup]"

# --- Walidacja ---
if [ -z "${DB_PASSWORD:-}" ]; then
  echo "${LOG_PREFIX} BŁĄD: Zmienna DB_PASSWORD nie jest ustawiona." >&2
  exit 1
fi

# --- Tworzenie katalogu ---
mkdir -p "${BACKUP_DIR}"

echo "${LOG_PREFIX} Start backupu: $(date -Iseconds)"
echo "${LOG_PREFIX} Host: ${DB_HOST}:${DB_PORT}, DB: ${DB_NAME}"

# --- pg_dump ---
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
  --format=custom --compress=9 \
  -f "${DUMP_FILE}"

# --- Checksum ---
CHECKSUM=$(sha256sum "${DUMP_FILE}" | awk '{print $1}')
echo "${CHECKSUM}" > "${DUMP_FILE}.sha256"

# --- Rozmiar ---
DUMP_SIZE=$(du -h "${DUMP_FILE}" | awk '{print $1}')
echo "${LOG_PREFIX} Backup zapisany: ${DUMP_FILE} (${DUMP_SIZE}, SHA256: ${CHECKSUM:0:16}...)"

# --- Retencja: usunięcie starszych niż RETENTION_DAYS ---
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "*.dump" -mtime +${RETENTION_DAYS} -print | wc -l | tr -d ' ')
if [ "${DELETED_COUNT}" -gt 0 ]; then
  find "${BACKUP_DIR}" -name "*.dump" -mtime +${RETENTION_DAYS} -delete
  find "${BACKUP_DIR}" -name "*.dump.sha256" -mtime +${RETENTION_DAYS} -delete
  echo "${LOG_PREFIX} Usunięto ${DELETED_COUNT} starych backupów (> ${RETENTION_DAYS} dni)."
fi

echo "${LOG_PREFIX} Backup zakończony pomyślnie: $(date -Iseconds)"
