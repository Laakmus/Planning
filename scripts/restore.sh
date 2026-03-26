#!/bin/bash
# =============================================================================
# Planning App — Restore PostgreSQL z backupu
# Użycie: ./scripts/restore.sh /path/to/planning_YYYYMMDD_HHMMSS.dump [--dry-run]
# =============================================================================

set -euo pipefail

LOG_PREFIX="[restore]"

# --- Argumenty ---
DUMP_FILE="${1:-}"
DRY_RUN="${2:-}"

if [ -z "${DUMP_FILE}" ]; then
  echo "Użycie: $0 <plik.dump> [--dry-run]"
  echo "  --dry-run  Wyświetla zawartość backupu bez przywracania"
  exit 1
fi

if [ ! -f "${DUMP_FILE}" ]; then
  echo "${LOG_PREFIX} BŁĄD: Plik nie istnieje: ${DUMP_FILE}" >&2
  exit 1
fi

# --- Konfiguracja ---
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"

if [ -z "${DB_PASSWORD:-}" ]; then
  echo "${LOG_PREFIX} BŁĄD: Zmienna DB_PASSWORD nie jest ustawiona." >&2
  exit 1
fi

# --- Walidacja checksum (jeśli .sha256 istnieje) ---
if [ -f "${DUMP_FILE}.sha256" ]; then
  EXPECTED=$(cat "${DUMP_FILE}.sha256")
  ACTUAL=$(sha256sum "${DUMP_FILE}" | awk '{print $1}')
  if [ "${EXPECTED}" != "${ACTUAL}" ]; then
    echo "${LOG_PREFIX} BŁĄD: Checksum nie pasuje! Backup może być uszkodzony." >&2
    echo "${LOG_PREFIX}   Oczekiwany: ${EXPECTED}" >&2
    echo "${LOG_PREFIX}   Rzeczywisty: ${ACTUAL}" >&2
    exit 1
  fi
  echo "${LOG_PREFIX} Checksum OK."
fi

# --- Dry run: tylko lista zawartości ---
if [ "${DRY_RUN}" = "--dry-run" ]; then
  echo "${LOG_PREFIX} DRY RUN — zawartość backupu:"
  PGPASSWORD="${DB_PASSWORD}" pg_restore --list "${DUMP_FILE}"
  echo "${LOG_PREFIX} DRY RUN zakończony. Żadne dane nie zostały zmienione."
  exit 0
fi

# --- Potwierdzenie interaktywne ---
echo ""
echo "========================================"
echo "  UWAGA: Przywracanie nadpisze bazę!"
echo "  Host: ${DB_HOST}:${DB_PORT}"
echo "  Baza: ${DB_NAME}"
echo "  Plik: ${DUMP_FILE}"
echo "========================================"
echo ""
read -p "Czy kontynuować? (wpisz TAK): " CONFIRM

if [ "${CONFIRM}" != "TAK" ]; then
  echo "${LOG_PREFIX} Anulowano."
  exit 0
fi

# --- Restore ---
echo "${LOG_PREFIX} Start restore: $(date -Iseconds)"

PGPASSWORD="${DB_PASSWORD}" pg_restore \
  -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
  --clean --if-exists \
  "${DUMP_FILE}"

echo "${LOG_PREFIX} Restore zakończony pomyślnie: $(date -Iseconds)"
echo "${LOG_PREFIX} Sprawdź dane: psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME}"
