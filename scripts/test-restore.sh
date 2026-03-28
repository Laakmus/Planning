#!/bin/bash
# =============================================================================
# Planning App — Test restore do tymczasowej bazy
# Użycie: ./scripts/test-restore.sh /path/to/planning_YYYYMMDD_HHMMSS.dump
# Cron (cotygodniowo): 0 4 * * 0 root /opt/planning-app/scripts/test-restore.sh /opt/backups/planning/latest.dump
# =============================================================================

set -euo pipefail

LOG_PREFIX="[test-restore]"
TEST_DB="planning_restore_test"
DUMP_FILE="${1:-}"

if [ -z "${DUMP_FILE}" ]; then
  echo "Użycie: $0 <plik.dump>"
  exit 1
fi

if [ ! -f "${DUMP_FILE}" ]; then
  echo "${LOG_PREFIX} BŁĄD: Plik nie istnieje: ${DUMP_FILE}" >&2
  exit 1
fi

# --- Konfiguracja ---
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"

if [ -z "${DB_PASSWORD:-}" ]; then
  echo "${LOG_PREFIX} BŁĄD: Zmienna DB_PASSWORD nie jest ustawiona." >&2
  exit 1
fi

export PGPASSWORD="${DB_PASSWORD}"

echo "${LOG_PREFIX} Start test-restore: $(date -Iseconds)"
echo "${LOG_PREFIX} Plik: ${DUMP_FILE}"

# --- Tworzenie tymczasowej bazy ---
echo "${LOG_PREFIX} Tworzenie tymczasowej bazy: ${TEST_DB}"
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres \
  -c "DROP DATABASE IF EXISTS ${TEST_DB};" \
  -c "CREATE DATABASE ${TEST_DB};"

# --- Restore do tymczasowej bazy ---
echo "${LOG_PREFIX} Przywracanie backupu..."
pg_restore \
  -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TEST_DB}" \
  --no-owner --no-privileges \
  "${DUMP_FILE}" 2>/dev/null || true  # pg_restore zwraca non-zero przy ostrzeżeniach

# --- Weryfikacja tabel ---
echo "${LOG_PREFIX} Weryfikacja kluczowych tabel..."

TABLES=("transport_orders" "order_stops" "order_items" "order_change_log" "companies" "locations" "products" "user_profiles")
ALL_OK=true

for TABLE in "${TABLES[@]}"; do
  COUNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TEST_DB}" \
    -t -A -c "SELECT COUNT(*) FROM public.${TABLE};" 2>/dev/null || echo "ERROR")

  if [ "${COUNT}" = "ERROR" ]; then
    echo "${LOG_PREFIX}   ✗ ${TABLE}: BRAK TABELI"
    ALL_OK=false
  else
    echo "${LOG_PREFIX}   ✓ ${TABLE}: ${COUNT} wierszy"
  fi
done

# --- Cleanup ---
echo "${LOG_PREFIX} Usuwanie tymczasowej bazy: ${TEST_DB}"
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres \
  -c "DROP DATABASE IF EXISTS ${TEST_DB};"

# --- Wynik ---
if [ "${ALL_OK}" = true ]; then
  echo "${LOG_PREFIX} Test-restore PASSED: $(date -Iseconds)"
  exit 0
else
  echo "${LOG_PREFIX} Test-restore FAILED: brakujące tabele." >&2
  exit 1
fi
