# Deployment Guide — Planning App

## Spis treści

1. [Wymagania systemowe](#wymagania-systemowe)
2. [Architektura](#architektura)
3. [Konfiguracja środowiska](#konfiguracja-środowiska)
4. [Deployment z Docker](#deployment-z-docker)
5. [Deployment bez Docker](#deployment-bez-docker)
6. [Supabase (self-hosted)](#supabase-self-hosted)
7. [Migracje bazy danych](#migracje-bazy-danych)
8. [Health checks](#health-checks)
9. [Backup i disaster recovery](#backup-i-disaster-recovery)
10. [Monitoring](#monitoring)
11. [Troubleshooting](#troubleshooting)

---

## Wymagania systemowe

| Komponent | Minimum | Rekomendowane |
|-----------|---------|---------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 512 MB (app) + 1 GB (Supabase) | 2 GB (app) + 4 GB (Supabase) |
| Dysk | 10 GB | 50 GB (z backupami) |
| Node.js | 22 LTS | 22 LTS |
| PostgreSQL | 15+ | 15+ (via Supabase) |
| Docker | 24+ | 24+ |
| OS | Linux (Ubuntu 22.04+) | Linux |

## Architektura

```
┌─────────────────┐     ┌──────────────────────┐
│   Przeglądarka   │────▶│   Planning App        │
│   (React SPA)    │     │   (Astro SSR/Node.js) │
└─────────────────┘     │   Port: 4321           │
                        └──────┬───────────────┘
                               │ REST API
                        ┌──────▼───────────────┐
                        │   Supabase            │
                        │   ├─ Kong (API GW)    │
                        │   ├─ PostgREST        │
                        │   ├─ GoTrue (Auth)    │
                        │   └─ PostgreSQL 15    │
                        └──────────────────────┘
```

## Konfiguracja środowiska

### Zmienne środowiskowe (wymagane)

```bash
# Skopiuj template
cp .env.production.example .env

# Uzupełnij wartości:
SUPABASE_URL=http://supabase-kong:8000      # URL wewnętrzny Supabase API
SUPABASE_ANON_KEY=<anon-key>                 # Z supabase status
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # Z supabase status
PUBLIC_SUPABASE_URL=https://your-domain.com   # URL publiczny (przeglądarka)
PUBLIC_SUPABASE_ANON_KEY=<anon-key>
CORS_ORIGIN=https://your-domain.com           # Domena bez trailing slash
HOST=0.0.0.0
PORT=4321
```

### Zmienne opcjonalne (Microsoft Graph API)

```bash
# Wymagane do tworzenia draftów Outlook (bez nich: fallback na .eml)
PUBLIC_MICROSOFT_CLIENT_ID=<app-registration-client-id>
PUBLIC_MICROSOFT_TENANT_ID=<azure-ad-tenant-id>
```

### Checklist przed deployem

- [ ] `CORS_ORIGIN` ustawiony na docelową domenę (nie localhost!)
- [ ] `PUBLIC_SUPABASE_URL` wskazuje na publiczny URL Supabase
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ustawiony (potrzebny do cleanup job)
- [ ] Certyfikat SSL/TLS skonfigurowany (reverse proxy lub Supabase)
- [ ] VPN / firewall skonfigurowany

## Deployment z Docker

### Pierwszy deployment

```bash
# 1. Sklonuj repozytorium
git clone <repo-url> planning-app
cd planning-app

# 2. Skonfiguruj środowisko
cp .env.production.example .env
# Edytuj .env — uzupełnij wszystkie wartości

# 3. Zbuduj i uruchom
docker compose up -d --build

# 4. Sprawdź status
docker compose ps
docker compose logs -f app
```

### Aktualizacja

```bash
# 1. Pobierz zmiany
git pull origin main

# 2. Przebuduj i zrestartuj
docker compose up -d --build

# 3. Weryfikacja
curl -s http://localhost:4321/api/v1/health | jq .
```

### Restart

```bash
docker compose restart app
```

### Logi

```bash
# Bieżące logi
docker compose logs -f app

# Ostatnie 100 linii
docker compose logs --tail=100 app
```

## Deployment bez Docker

```bash
# 1. Zainstaluj Node.js 22 LTS
# 2. Zainstaluj zależności
npm ci --omit=dev

# 3. Zbuduj aplikację
npm run build

# 4. Uruchom
HOST=0.0.0.0 PORT=4321 node dist/server/entry.mjs
```

### Systemd service (Linux)

```ini
# /etc/systemd/system/planning-app.service
[Unit]
Description=Planning App (Astro SSR)
After=network.target

[Service]
Type=simple
User=planning
WorkingDirectory=/opt/planning-app
EnvironmentFile=/opt/planning-app/.env
ExecStart=/usr/bin/node dist/server/entry.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable planning-app
sudo systemctl start planning-app
```

## Supabase (self-hosted)

Planning App wymaga Supabase jako backendu (PostgreSQL + Auth + PostgREST).

### Opcja A: Supabase self-hosted (Docker)

Dokumentacja: https://supabase.com/docs/guides/self-hosting/docker

```bash
# W osobnym katalogu
git clone https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# Edytuj .env — zmień JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
docker compose up -d
```

### Opcja B: Supabase Cloud

1. Utwórz projekt na https://supabase.com
2. Skopiuj klucze z Settings → API
3. Uruchom migracje (patrz sekcja poniżej)

## Migracje bazy danych

### Supabase CLI (rekomendowane)

```bash
# Zainstaluj Supabase CLI
npm install -g supabase

# Połącz z projektem
supabase link --project-ref <project-ref>

# Uruchom migracje
supabase db push

# Opcjonalnie: załaduj dane seed
supabase db reset --linked
```

### Ręcznie (psql)

```bash
# Połącz z bazą produkcyjną
PGPASSWORD=<password> psql -h <host> -p <port> -U postgres -d postgres

# Uruchom migracje w kolejności
\i supabase/migrations/20260207000000_consolidated_schema.sql
\i supabase/migrations/20260301000000_decouple_vehicle_fields.sql
# ... kolejne migracje chronologicznie
```

### Weryfikacja migracji

```sql
-- Sprawdź liczbę tabel
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Oczekiwane: ~13 tabel

-- Sprawdź RLS
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
-- Oczekiwane: 13 tabel z RLS
```

## Health checks

### Endpoint

```
GET /api/v1/health
```

**Odpowiedź 200 (OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-03-19T12:00:00.000Z",
  "db": "connected"
}
```

**Odpowiedź 503 (Service Unavailable):**
```json
{
  "error": "Service Unavailable",
  "message": "Database unavailable",
  "statusCode": 503
}
```

### Monitoring health

```bash
# Prosty check (cron co 5 min)
curl -sf http://localhost:4321/api/v1/health > /dev/null || echo "ALERT: Planning App DOWN"

# Docker wbudowany healthcheck (co 30s)
docker inspect --format='{{.State.Health.Status}}' planning-app
```

## Backup i disaster recovery

### Automatyczne backupy PostgreSQL

```bash
# Cron job (codziennie o 3:00)
# /etc/cron.d/planning-backup
0 3 * * * root /opt/planning-app/scripts/backup.sh
```

**scripts/backup.sh:**
```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/planning"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# pg_dump
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h "${DB_HOST}" -p "${DB_PORT}" -U postgres -d postgres \
  --format=custom --compress=9 \
  -f "${BACKUP_DIR}/planning_${TIMESTAMP}.dump"

# Usuń backupy starsze niż RETENTION_DAYS
find "$BACKUP_DIR" -name "*.dump" -mtime +${RETENTION_DAYS} -delete

echo "Backup completed: planning_${TIMESTAMP}.dump"
```

### Restore

```bash
pg_restore -h <host> -p <port> -U postgres -d postgres \
  --clean --if-exists \
  /opt/backups/planning/planning_20260319_030000.dump
```

### RTO/RPO

| Metryka | Wartość | Opis |
|---------|---------|------|
| RPO | 24h | Utrata danych max 24h (backup dzienny) |
| RTO | 1h | Czas przywrócenia z backupu |

Dla niższego RPO: skonfiguruj WAL archiving lub Supabase Point-in-Time Recovery.

## Monitoring

### Logi strukturalne

Aplikacja loguje błędy w formacie JSON na stderr:

```json
{
  "level": "error",
  "timestamp": "2026-03-19T12:00:00.000Z",
  "context": "[POST /api/v1/orders]",
  "message": "...",
  "stack": "..."
}
```

### Metryki do monitorowania

| Metryka | Alert threshold | Metoda |
|---------|----------------|--------|
| Health endpoint | != 200 przez 3 min | curl + alerting |
| Memory usage | > 400 MB | docker stats |
| CPU usage | > 80% przez 5 min | docker stats |
| Disk usage | > 80% | df -h |
| Błędy 5xx | > 10/min | log parsing |

### Integracja z Sentry (opcjonalne)

Dodaj `SENTRY_DSN` do `.env` — patrz dokumentacja Sentry dla Node.js.

## Troubleshooting

### Aplikacja nie startuje

```bash
# Sprawdź logi
docker compose logs app

# Częste przyczyny:
# 1. Brak .env lub złe wartości
# 2. Supabase nie jest dostępny (sprawdź SUPABASE_URL)
# 3. Port 4321 zajęty
```

### CORS errors w przeglądarce

```bash
# Sprawdź CORS_ORIGIN w .env
# Musi dokładnie odpowiadać origin przeglądarki (protokół + domena + port)
# Przykład: https://planning.firma.pl (bez trailing slash)
```

### Baza danych niedostępna (503)

```bash
# Sprawdź czy Supabase działa
curl -s http://supabase-host:8000/rest/v1/ -H "apikey: <anon-key>"

# Sprawdź połączenie PostgreSQL
PGPASSWORD=postgres psql -h <host> -p <port> -U postgres -d postgres -c "SELECT 1"

# Restart PostgREST (cache schemy)
docker restart supabase_rest_planning
# lub
NOTIFY pgrst, 'reload schema';
```

### Migracje nie działają

```bash
# Sprawdź ostatnią zastosowaną migrację
supabase migration list --linked

# Ręcznie zastosuj brakującą
supabase db push
```

### Rate limiting (429)

Domyślne limity: 1000 GET/min, 100 POST+PUT+DELETE/min per user.
Jeśli użytkownicy raportują 429:

```bash
# Sprawdź logi — kto generuje dużo requestów
docker compose logs app | grep "429"
```
