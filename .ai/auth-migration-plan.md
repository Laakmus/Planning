# Plan migracji autentykacji: Username + hasło + Panel Admina + Invite Link

> Data: 2026-04-14
> Autor: Claude Code (orkiestrator)
> Status: **ZATWIERDZONY — w trakcie implementacji (branch `feature/username-login-and-graph-email`)**
> Poprzednia wersja: plan SSO `@odylion.com` z 2026-02-25 — **odrzucony, zastąpiony niniejszym planem**

---

## 1. Kierunek

Odejście od email+hasło (obecne) i od planu SSO (stara wersja). Nowy model:

- **Logowanie:** login (username) + hasło. Bez domeny email w formularzu.
- **Tworzenie konta:** tylko przez panel admina. Admin ustawia login+hasło+email+imię/nazwisko+rolę.
- **Invite flow:** system generuje jednorazowy token (TTL 7 dni). Admin kopiuje link z UI i wysyła użytkownikowi poza aplikacją. Użytkownik klika → strona aktywacji → konto aktywne → loguje się loginem+hasłem nadanymi przez admina.
- **Email pozostaje w profilu:** nie do logowania, ale do integracji z Outlook (wysyłka .eml + Microsoft Graph draft).
- **Role:** ADMIN / PLANNER / READ_ONLY (bez zmian).

## 2. Decyzje ustalone

| Decyzja | Wartość | Uzasadnienie |
|---|---|---|
| Format username | 3–32 znaki, `a-z 0-9 . _ -`, lowercase, unique | Prosty, czytelny, case-insensitive (CITEXT) |
| TTL invite tokenu | 7 dni | Balans wygody i bezpieczeństwa |
| Deaktywacja = wylogowanie sesji | Tak | Natychmiastowe odcięcie dostępu |
| Szyfrowanie tokenów MS w DB | pgcrypto `pgp_sym_encrypt` | Ochrona przy wycieku backupu |
| Email provider do wysyłki | Obecny `.eml` + nowa ścieżka Graph draft | Desktop Outlook działa, Web/future-proof przez Graph |
| Azure AD tenant | Własny tenant admina aplikacji | Ty = główny admin, user consent zamiast admin consent |

## 3. Architektura auth

```
[Browser]                   [Planning backend]              [Supabase Auth]
   |                              |                                |
   |  POST /api/v1/auth/login     |                                |
   |  { username, password }      |                                |
   |----------------------------->|  SELECT email FROM             |
   |                              |  user_profiles                 |
   |                              |  WHERE username = ?            |
   |                              |  (przez RPC SECURITY DEFINER)  |
   |                              |                                |
   |                              |  signInWithPassword            |
   |                              |    { email, password }         |
   |                              |------------------------------->|
   |                              |<-------------------------------|
   |                              |  { access_token, refresh_token}|
   |                              |  sprawdź is_active = true      |
   |  { accessToken, user }       |                                |
   |<-----------------------------|                                |
   |                              |                                |
   |  setSession(tokens)          |                                |
   |  (Supabase SDK, middleware   |                                |
   |   nadal pracuje na JWT sub)  |                                |
```

**Middleware bez zmian** — JWT `sub` (UUID) nadal identyfikuje usera. Zmienia się tylko ścieżka zdobycia tokenu.

## 4. Schemat DB — zmiany

**Migracja `YYYYMMDDHHmmss_add_username_and_invite.sql`:**
- `CREATE EXTENSION IF NOT EXISTS citext;`
- `ALTER TABLE user_profiles`:
  - `ADD COLUMN username CITEXT UNIQUE NOT NULL` + CHECK regex
  - `ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT false`
  - `ADD COLUMN invite_token_hash TEXT NULL`
  - `ADD COLUMN invite_expires_at TIMESTAMPTZ NULL`
  - `ADD COLUMN invited_at TIMESTAMPTZ NULL`
  - `ADD COLUMN activated_at TIMESTAMPTZ NULL`
- RLS policies granularne: ADMIN pełny CRUD (INSERT/UPDATE/DELETE własnego i cudzych), user SELECT własny
- RPC `resolve_username_to_email(p_username CITEXT) RETURNS TEXT` — SECURITY DEFINER, zwraca email tylko dla `is_active=true`
- Backfill username (dev/test)

**Migracja `YYYYMMDDHHmmss_add_ms_oauth_tokens.sql`** (Część B):
- `ms_oauth_tokens (user_id UUID PK FK, access_token_encrypted BYTEA, refresh_token_encrypted BYTEA, expires_at TIMESTAMPTZ, scope TEXT, ms_user_id TEXT, ms_email CITEXT, created_at, updated_at)`
- pgcrypto: `pgp_sym_encrypt(token, current_setting('app.encryption_key'))`
- RLS: tylko właściciel SELECT

## 5. Endpointy API

### Część A — auth + admin
- `POST /api/v1/auth/login` — `{username, password}` → tokens + user
- `POST /api/v1/auth/activate` — `{token}` → `is_active = true`
- `GET /api/v1/admin/users` — lista (paginacja + search)
- `POST /api/v1/admin/users` — create + invite link
- `PATCH /api/v1/admin/users/:id` — edit (email/fullName/phone/role/isActive)
- `DELETE /api/v1/admin/users/:id` — deaktywacja + signOut
- `POST /api/v1/admin/users/:id/reset-password` — admin ustawia nowe hasło
- `POST /api/v1/admin/users/:id/invite` — regeneracja tokenu

### Część B — Microsoft Graph
- `GET /api/v1/ms-oauth/start` — redirect do Microsoft OAuth
- `GET /api/v1/ms-oauth/callback` — exchange code → tokens
- `GET /api/v1/ms-oauth/status` — czy user ma aktywne połączenie
- `POST /api/v1/ms-oauth/disconnect` — revoke + delete tokens
- `POST /api/v1/orders/:id/prepare-email-graph` — tworzy draft w skrzynce usera, zwraca webLink

## 6. UI

- `LoginCard`: pole "Login" (text, nie email)
- `/activate?token=...`: strona powitalna + przycisk "Aktywuj konto"
- Sidebar sekcja "Administracja" (ADMIN only): link "Użytkownicy"
- `/admin/users`: tabela + dialogi Create / Edit / Reset / InviteLink
- `/settings/email`: "Połącz z Microsoft" / "Rozłącz" + status

## 7. Bezpieczeństwo

- **Invite token:** 32+ bajty `crypto.randomBytes`, hex. W DB tylko **hash SHA-256**, nigdy plain.
- **Rate-limit `/auth/login`:** 10 prób / 15 min na IP (middleware).
- **SECURITY DEFINER RPC:** `resolve_username_to_email` zwraca tylko dla aktywnych userów (brak user enumeration na nieaktywnych).
- **OAuth PKCE + state:** CSRF protection w OAuth flow.
- **MS tokeny:** pgcrypto, klucz z env `APP_ENCRYPTION_KEY`.
- **Deaktywacja:** `supabase.auth.admin.signOut(userId)` + `is_active=false`.
- **Reset hasła admin:** `supabase.auth.admin.updateUserById(id, {password})`.

## 8. Fazy implementacji

| Faza | Zakres | Agent | Nakład |
|---|---|---|---|
| A1 | Types + Zod schemas | types | 2–3 h |
| A2 | DB migracja + seed + regeneracja typów | database | 3–4 h |
| A3a | Backend auth + admin endpoints | backend | 6–8 h |
| A3b | Frontend login + panel admina | frontend | 6–8 h |
| B1 | Entra app registration (USER) | — | 1–2 h usera |
| B2 | DB ms_oauth_tokens | database | 1 h |
| B3 | Backend OAuth + Graph | backend | 5–6 h |
| B4 | Frontend EmailConnection + send-email | frontend | 4–5 h |
| C | E2E + unit testy | tester | 4–5 h |
| D | Reviewer audit | reviewer | 1–2 h |

**Łącznie:** ~35–45 h agentów + ~3–4 h usera.

## 9. Migracja istniejących userów

Projekt na etapie dev — tylko seed testowy (`admin@test.pl` / `test1234`). W seed.sql dodajemy `username='admin'`, `is_active=true`. Brak realnych danych prod.

## 10. Rollback

- Migracja DB: `DROP COLUMN username/is_active/...; DROP RPC resolve_username_to_email` (odwrócić w dół).
- Kod: rewert feature branch do `5fd519a`.
- MS tokens: `DROP TABLE ms_oauth_tokens`.
- Istniejące sesje userów: wygasną naturalnie (1h).

## 11. Powiązania

- Specyfikacja endpointów → `.ai/api-plan.md` (orkiestrator zaktualizuje po Fazie A3a/B3)
- Schemat DB → `.ai/db-plan.md` (po Fazie A2/B2)
- UI → `.ai/ui-plan.md` (po Fazie A3b/B4)
- To-do → `.ai/to_do/to_do.md` (aktualny status)
- Plan implementacyjny → `/Users/jaroslawurbanowicz/.claude/plans/parallel-splashing-stallman.md`
