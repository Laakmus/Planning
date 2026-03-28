# Plan migracji autentykacji: SSO + Panel Admina + Restrykcja domenowa

> Data: 2026-02-25
> Autor: Claude Code (orkiestrator + 2 agentów: Backend Architect, Security Auditor)
> Status: **PROPOZYCJA — do zatwierdzenia przez użytkownika**

---

## Spis treści

1. [Podsumowanie wykonawcze](#1-podsumowanie-wykonawcze)
2. [Stan obecny](#2-stan-obecny)
3. [Wymagania](#3-wymagania)
4. [Architektura docelowa](#4-architektura-docelowa)
5. [Opcje SSO w Supabase — analiza](#5-opcje-sso-w-supabase--analiza)
6. [Szczegółowy projekt techniczny](#6-szczegółowy-projekt-techniczny)
7. [Zmiany w bazie danych](#7-zmiany-w-bazie-danych)
8. [Zmiany w kodzie](#8-zmiany-w-kodzie)
9. [Panel administracyjny](#9-panel-administracyjny)
10. [Model zagrożeń i bezpieczeństwo](#10-model-zagrożeń-i-bezpieczeństwo)
11. [Plan wdrożenia (fazy)](#11-plan-wdrożenia-fazy)
12. [Migracja istniejących użytkowników](#12-migracja-istniejących-użytkowników)
13. [Plan rollback](#13-plan-rollback)
14. [Problemy i ryzyka](#14-problemy-i-ryzyka)
15. [Otwarte decyzje](#15-otwarte-decyzje)
16. [Szacowanie pracochłonności](#16-szacowanie-pracochłonności)

---

## 1. Podsumowanie wykonawcze

Projekt zakłada przebudowę systemu autentykacji z obecnego **email+hasło (Supabase Auth)** na **SSO (Microsoft Entra / Google Workspace)** z zachowaniem email+hasło jako fallback awaryjny. Dodatkowo:

- Restrykcja domenowa: tylko **@odylion.com**
- Panel admina w aplikacji do zarządzania użytkownikami
- Pre-approval: admin musi dodać email do allowlisty zanim użytkownik uzyska dostęp
- ~10 użytkowników, darmowy plan Supabase

**Kluczowa decyzja:** Supabase Social/OAuth (Google, Azure) jest dostępne na **planie FREE** — nie wymaga SAML ani płatnego planu. To rekomendowane podejście.

---

## 2. Stan obecny

### 2.1 Architektura auth

| Element | Stan | Plik |
|---------|------|------|
| Login | Email+hasło (`signInWithPassword`) | `src/components/auth/LoginCard.tsx` |
| Session | JWT w localStorage (Supabase SDK) | `src/contexts/AuthContext.tsx` |
| Profil użytkownika | Tabela `user_profiles` z RLS | `supabase/migrations/20260207000000_...sql` |
| Middleware | Injection Supabase client + rate limit | `src/middleware.ts` |
| API auth | `getAuthenticatedUser()` → `getCurrentUser()` | `src/lib/api-helpers.ts`, `auth.service.ts` |
| Role | ADMIN, PLANNER, READ_ONLY | `user_profiles.role` |
| Test user | `admin@test.pl` / `test1234` (ADMIN) | `supabase/seed.sql` |

### 2.2 Znane problemy bezpieczeństwa (z audytu 2026-02-25)

Powiązane z auth — **trzeba naprawić PRZED lub W TRAKCIE migracji**:

| ID | Priorytet | Problem | Powiązanie z migracją |
|----|-----------|---------|----------------------|
| C-04 | CRITICAL | Rate limiter omijany przez fałszywe JWT | Naprawić przed SSO |
| H-05 | HIGH | Token JWT w localStorage (XSS risk) | Rozważyć @supabase/ssr przy okazji |
| H-06 | HIGH | `/orders` bez server-side auth guard | Naprawić w ramach middleware |
| H-07 | HIGH | `getSession()` zamiast `getUser()` | Naprawić w AuthContext |
| H-08 | HIGH | `enable_signup = true` — publiczna rejestracja | Wyłączyć natychmiast |
| M-08 | MEDIUM | User enumeration (różne komunikaty) | Ujednolicić komunikaty |
| B-01 | HIGH/BUG | RLS user_profiles blokuje JOINy — brak imion | Naprawić przy rozszerzeniu RLS |

---

## 3. Wymagania

### 3.1 Funkcjonalne

1. **SSO jako główne logowanie** — przycisk "Zaloguj przez Microsoft" (lub Google)
2. **Email+hasło jako fallback** — dla admina/awaryjny
3. **Restrykcja domeny** — tylko @odylion.com
4. **Pre-approval** — admin dodaje email do allowlisty → użytkownik może się logować
5. **Auto-provisioning** — przy pierwszym SSO login profil tworzony automatycznie
6. **Panel admina w UI** — zarządzanie użytkownikami (dodawanie, role, dezaktywacja)
7. **Brak resetu hasła** w aplikacji (firma zarządza przez IdP)
8. **Brak self-registration** — publiczna rejestracja wyłączona

### 3.2 Niefunkcjonalne

- ~10 użytkowników, darmowy plan Supabase
- Środowisko VPN/ekstranet — bezpieczeństwo priorytet
- Dezaktywacja użytkownika = natychmiastowa utrata dostępu (max 15 min okno)
- Minimum 1 aktywny ADMIN zawsze w systemie
- Audit log wszystkich operacji admin

---

## 4. Architektura docelowa

### 4.1 Diagram flow logowania

```
┌─────────────────────────────────────────────────────────────────┐
│                        EKRAN LOGOWANIA (/)                      │
│                                                                 │
│  ┌───────────────────────────────────────┐                     │
│  │  [🔐 Zaloguj przez Microsoft]         │ ← SSO (primary)     │
│  └───────────────────────────────────────┘                     │
│                                                                 │
│  ──────────────── lub ────────────────                         │
│                                                                 │
│  [Zaloguj hasłem] ← link/przycisk (collapsed)                 │
│    ┌─────────────────────────────────────┐                     │
│    │  Email: [____________]              │ ← Fallback          │
│    │  Hasło: [____________]              │                     │
│    │  [Zaloguj]                          │                     │
│    └─────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
         │ SSO click                    │ Email+password
         ▼                              ▼
┌──────────────────┐          ┌──────────────────────┐
│ Microsoft Entra   │          │ supabase.auth         │
│ Login Page        │          │ .signInWithPassword() │
│ (redirect)        │          └──────────┬───────────┘
└────────┬─────────┘                      │
         │ OIDC callback                  │
         ▼                                │
┌──────────────────────────────────────────────────────┐
│ Supabase Auth                                         │
│  1. Weryfikuje token/credentials                      │
│  2. Auth Hook: before_user_created                    │
│     → sprawdza domenę @odylion.com                    │
│     → sprawdza allowed_emails                         │
│     → odrzuca jeśli brak na liście                    │
│  3. Trigger: after INSERT on auth.users               │
│     → auto-tworzy user_profiles (jeśli allowed)       │
│  4. Generuje JWT (access_token + refresh_token)       │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│ Middleware (src/middleware.ts)                         │
│  → getUser() (walidacja JWT z serwerem)              │
│  → user_profiles.is_active == true?                  │
│  → email endsWith @odylion.com? (defense in depth)   │
│  → rate limiting                                      │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
              /orders — aplikacja
```

### 4.2 Diagram komponentów

```
Nowe/zmienione komponenty:
──────────────────────────

[LoginCard.tsx]          ← ZMIANA: SSO button + collapsed email/password
[AuthContext.tsx]         ← ZMIANA: loginWithSSO(), SSO logout
[/auth/callback.astro]   ← NOWY: OAuth callback page
[middleware.ts]           ← ZMIANA: domain check, server-side guard /orders

[/admin/users.astro]     ← NOWY: strona panelu admin
[UserManagement.tsx]     ← NOWY: komponent React (lista + CRUD)
[UserCreateDialog.tsx]   ← NOWY: dialog dodawania użytkownika
[UserEditDialog.tsx]     ← NOWY: dialog edycji roli/dezaktywacji

[admin-user.service.ts]  ← NOWY: serwis backend (service_role)
[/api/v1/admin/users]    ← NOWY: endpointy REST
[/api/v1/admin/allowed-emails] ← NOWY: endpointy REST

Nowe tabele DB:
──────────────
allowed_emails           ← Pre-approved email list
auth_audit_log           ← Audit log operacji auth/admin
user_profiles            ← ZMIANA: +is_active, +auth_provider

Nowe hooki SQL:
──────────────
before_user_created      ← Walidacja domeny + allowlista (ODRZUCA niezatwierdzonych)
after INSERT auth.users  ← Auto-provisioning user_profiles
custom_access_token      ← Dodaje role do JWT claims + sprawdza blocked_users
prevent_last_admin       ← Chroni przed usunięciem ostatniego admina
```

---

## 5. Opcje SSO w Supabase — analiza

| Podejście | Plan Free? | Złożoność | Rekomendacja |
|-----------|-----------|-----------|--------------|
| **Social OAuth (Google/Azure)** | **TAK** | Niska | **REKOMENDOWANE** |
| SAML SSO | NIE (Pro $25/mies) | Średnia | Overkill dla 10 userów |
| Custom OIDC | TAK | Wysoka | Niepotrzebne |

### Dlaczego OAuth Social Login?

1. **Darmowe** — działa na Free tier Supabase (limit 50k MAU, wystarczy)
2. **Natywne** — `supabase.auth.signInWithOAuth({ provider: 'azure' })` — 1 linia kodu
3. **Google i Microsoft** wbudowane jako gotowe providery
4. **Automatyczne linkowanie** kont — jeden email = jedno konto (SSO + email/password)
5. **Supabase zarządza tokenami** — brak custom kodu na walidację OIDC

### Konfiguracja providera

**Microsoft Entra ID (Azure AD):**
```toml
# supabase/config.toml
[auth.external.azure]
enabled = true
client_id = "env(AZURE_CLIENT_ID)"
secret = "env(AZURE_CLIENT_SECRET)"
# WAŻNE: użyj TENANT_ID (nie "common") → ogranicza do jednego tenanta
url = "https://login.microsoftonline.com/{TENANT_ID}"
```

**Google Workspace (alternatywa):**
```toml
[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret = "env(GOOGLE_CLIENT_SECRET)"
# W Google Cloud Console: ograniczyć do "Internal" (tylko organizacja)
```

**Azure App Registration (wymagane kroki):**
1. Azure Portal → App Registrations → New Registration
2. Redirect URI: `https://YOUR_SUPABASE_URL/auth/v1/callback`
3. API Permissions: `openid`, `email`, `profile`
4. **"Supported account types"** = **"Single tenant"** → tylko @odylion.com
5. Client Secret: wygenerować i zapisać do `.env`

---

## 6. Szczegółowy projekt techniczny

### 6.1 Walidacja domeny @odylion.com — 4 warstwy (defense in depth)

| Warstwa | Mechanizm | Chroni przed |
|---------|-----------|--------------|
| **1. IdP tenant** | Azure single-tenant / Google Internal | Logowaniem z obcego tenanta |
| **2. Auth Hook SQL** | `before_user_created` — exact domain match | Obejściem frontu, bezpośrednim API call |
| **3. API middleware** | Sprawdzenie domeny w JWT email | Legacy kontami, edge cases |
| **4. Frontend** | UX hint (nie security boundary) | Złym UX (user experience) |

**Implementacja warstwy 2 (najważniejsza):**

```sql
CREATE OR REPLACE FUNCTION auth.before_user_created_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_domain TEXT;
  v_allowed BOOLEAN;
BEGIN
  v_email := lower(trim(event->'record'->>'email'));
  v_domain := split_part(v_email, '@', 2);

  -- Exact domain match (nie LIKE, nie endsWith)
  IF v_domain != 'odylion.com' THEN
    RETURN jsonb_build_object('decision', 'reject',
      'message', 'Only @odylion.com emails are allowed');
  END IF;

  -- Odrzuć plus-addressing (jan+admin@odylion.com)
  IF position('+' in split_part(v_email, '@', 1)) > 0 THEN
    RETURN jsonb_build_object('decision', 'reject',
      'message', 'Email aliases with + are not allowed');
  END IF;

  -- Sprawdź allowlistę
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE email = v_email AND is_active = true
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('decision', 'reject',
      'message', 'Email not pre-approved. Contact your administrator.');
  END IF;

  RETURN event;
END;
$$;
```

**Edge cases domen:**

| Case | Przykład | Obrona |
|------|---------|--------|
| Case sensitivity | `Jan@ODYLION.COM` | `lower()` w hooku |
| Plus addressing | `jan+admin@odylion.com` | Odrzuć jeśli local part zawiera `+` |
| Subdomeny | `jan@hr.odylion.com` | Exact match: `split_part(email, '@', 2) = 'odylion.com'` |
| Suffix attack | `jan@odylion.com.evil.com` | Exact match (nie `LIKE '%odylion.com'`) |
| Unicode homoglyph | `jan@odylіon.com` (cyryliczne "i") | IdP tenant restriction eliminuje |

### 6.2 Auto-provisioning profilu

Gdy użytkownik zaloguje się przez SSO po raz pierwszy, trigger automatycznie tworzy `user_profiles`:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_allowed RECORD;
  v_provider TEXT;
BEGIN
  -- Pobierz domyślną rolę z allowlisty
  SELECT * INTO v_allowed FROM public.allowed_emails
  WHERE email = LOWER(NEW.email) AND is_active = true;

  IF v_allowed IS NULL THEN
    RETURN NEW; -- Brak na liście → brak profilu → getCurrentUser() → null → 401
  END IF;

  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

  INSERT INTO public.user_profiles (id, email, full_name, role, is_active, auth_provider)
  VALUES (
    NEW.id,
    LOWER(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             NEW.raw_user_meta_data->>'name',
             split_part(NEW.email, '@', 1)),
    v_allowed.default_role,
    true,
    v_provider
  ) ON CONFLICT (id) DO UPDATE SET
    auth_provider = CASE
      WHEN user_profiles.auth_provider != v_provider THEN 'mixed'
      ELSE user_profiles.auth_provider
    END;

  -- Audit log
  INSERT INTO public.auth_audit_log (event_type, user_id, email, details)
  VALUES ('USER_CREATED', NEW.id, LOWER(NEW.email), jsonb_build_object(
    'provider', v_provider, 'role', v_allowed.default_role, 'auto_provisioned', true
  ));

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
```

### 6.3 Sesje i tokeny

| Parametr | Obecna wartość | Docelowa wartość | Uzasadnienie |
|----------|---------------|------------------|--------------|
| `jwt_expiry` | 3600 (1h) | **900 (15 min)** | Krótsze okno po dezaktywacji konta |
| `session.timebox` | brak | **8h** | Max czas jednej sesji |
| `session.inactivity_timeout` | brak | **2h** | Wylogowanie po bezczynności |
| `enable_signup` | true | **false** | Brak publicznej rejestracji |
| `enable_manual_linking` | ? | **false** | Automatyczne linkowanie SSO+email |

### 6.4 Dezaktywacja użytkownika — timeline

```
t=0    Admin dezaktywuje użytkownika w panelu:
       → user_profiles.is_active = false
       → allowed_emails.is_active = false
       → auth.admin.updateUserById(userId, { ban_duration: '876000h' })

t=0..15min  Istniejący JWT nadal ważny, ALE:
            → Każdy API request sprawdza user_profiles.is_active
            → getCurrentUser() zwraca null → 401
            → Efektywnie: natychmiastowa blokada

t=15min     JWT wygasa, refresh_token odrzucony (ban)
            → Pełna blokada, brak możliwości odnowienia sesji
```

---

## 7. Zmiany w bazie danych

### 7.1 Modyfikacja `user_profiles`

```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS auth_provider text DEFAULT 'email'
  CHECK (auth_provider IN ('email', 'azure', 'google', 'mixed'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active
  ON public.user_profiles (is_active);
```

### 7.2 Nowa tabela: `allowed_emails`

```sql
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  default_role text NOT NULL DEFAULT 'PLANNER'
    CHECK (default_role IN ('ADMIN', 'PLANNER', 'READ_ONLY')),
  is_active boolean NOT NULL DEFAULT true,
  added_by_user_id uuid REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT allowed_emails_email_uq UNIQUE (email)
);

-- RLS
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY allowed_emails_select_authenticated
  ON public.allowed_emails FOR SELECT TO authenticated USING (true);

CREATE POLICY allowed_emails_write_admin
  ON public.allowed_emails FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  ));
```

### 7.3 Nowa tabela: `auth_audit_log`

```sql
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN (
    'LOGIN_SSO', 'LOGIN_PASSWORD', 'LOGIN_FAILED',
    'LOGOUT', 'USER_CREATED', 'USER_DEACTIVATED',
    'USER_REACTIVATED', 'ROLE_CHANGED',
    'ALLOWED_EMAIL_ADDED', 'ALLOWED_EMAIL_REMOVED'
  )),
  user_id uuid,
  target_user_id uuid,
  email varchar(320),
  details jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indeksy
CREATE INDEX idx_auth_audit_log_user ON auth_audit_log (user_id, created_at);
CREATE INDEX idx_auth_audit_log_event ON auth_audit_log (event_type, created_at);

-- RLS: tylko ADMIN czyta
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_audit_log_select_admin ON auth_audit_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- APPEND-ONLY: trigger blokujący UPDATE/DELETE
CREATE TRIGGER auth_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.auth_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();
```

### 7.4 Trigger: ochrona ostatniego admina

```sql
CREATE OR REPLACE FUNCTION public.prevent_last_admin_deactivation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_active_admins int;
BEGIN
  IF (NEW.role != 'ADMIN' AND OLD.role = 'ADMIN')
     OR (NEW.is_active = false AND OLD.is_active = true AND OLD.role = 'ADMIN')
  THEN
    SELECT COUNT(*) INTO v_active_admins FROM public.user_profiles
    WHERE role = 'ADMIN' AND is_active = true AND id != NEW.id;

    IF v_active_admins = 0 THEN
      RAISE EXCEPTION 'Nie można dezaktywować ani zmienić roli ostatniego aktywnego administratora.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_last_admin
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_deactivation();
```

### 7.5 RLS `user_profiles` — rozszerzenie (naprawia też BUG B-01)

```sql
-- Usunięcie starej polityki (blokuje JOINy — BUG B-01)
DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;

-- Nowa: wszyscy authenticated widzą wszystkie profile (potrzebne do JOINów)
CREATE POLICY user_profiles_select_all_authenticated
  ON public.user_profiles FOR SELECT TO authenticated USING (true);

-- ADMIN może modyfikować (dla panelu admin)
CREATE POLICY user_profiles_write_admin
  ON public.user_profiles FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  ));
```

### 7.6 Diagram ERD — nowe tabele

```
┌──────────────────┐     ┌──────────────────────┐
│   auth.users     │     │   allowed_emails     │
│ (Supabase Auth)  │     │                      │
│                  │     │ id                   │
│ id        ──────┐│     │ email    (unique)    │
│ email           ││     │ default_role         │
│ provider        ││     │ is_active            │
│ ...             ││     │ added_by_user_id ────┐
└─────────────────┘│     └──────────────────────┘│
         │         │                              │
         │ trigger │                              │
         ▼         │     ┌──────────────────────┐│
┌──────────────────┐│    │   auth_audit_log     ││
│  user_profiles   │◄────│                      ││
│                  │     │ id                   ││
│ id (=auth.users) │     │ event_type           ││
│ email            │     │ user_id       ───────┘│
│ full_name        │     │ target_user_id ──────┘
│ phone            │     │ email                │
│ role             │     │ details (jsonb)      │
│ is_active  (NEW) │     │ created_at           │
│ auth_provider(NEW)│    └──────────────────────┘
│ created_at       │
│ updated_at       │
└──────────────────┘
```

---

## 8. Zmiany w kodzie

### 8.1 Pliki do modyfikacji

| Plik | Zmiana |
|------|--------|
| `supabase/config.toml` | SSO provider, hooki, session, enable_signup=false |
| `src/contexts/AuthContext.tsx` | `loginWithSSO()`, SSO logout, `getUser()` zamiast `getSession()` |
| `src/components/auth/LoginCard.tsx` | Przycisk SSO + collapsed email/password fallback |
| `src/lib/services/auth.service.ts` | Sprawdzanie `is_active` w `getCurrentUser()` |
| `src/middleware.ts` | Server-side guard /orders, domain check, admin rate limit |
| `src/types/` | Nowe DTO: AdminUserDto, CreateUserCommand, AllowedEmailDto |
| `.env.example` | Nowe zmienne: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID |
| `src/db/database.types.ts` | Regeneracja z nowymi tabelami |

### 8.2 Nowe pliki

| Plik | Opis |
|------|------|
| `supabase/migrations/XXXXXXXX_add_sso_auth.sql` | Migracja DB (all-in-one) |
| `src/pages/auth/callback.astro` | OAuth callback page |
| `src/lib/services/admin-user.service.ts` | Serwis admin (service_role) |
| `src/pages/api/v1/admin/users/index.ts` | GET (lista) + POST (dodaj) |
| `src/pages/api/v1/admin/users/[userId].ts` | PUT (zmień rolę) + DELETE (dezaktywuj) |
| `src/pages/api/v1/admin/allowed-emails/index.ts` | GET + POST |
| `src/pages/api/v1/admin/allowed-emails/[id].ts` | DELETE |
| `src/pages/admin/users.astro` | Strona admin panelu |
| `src/components/admin/UserManagement.tsx` | Główny komponent React |
| `src/components/admin/UserCreateDialog.tsx` | Dialog dodawania |
| `src/components/admin/UserEditDialog.tsx` | Dialog edycji |

### 8.3 Kluczowe zmiany w AuthContext

```typescript
// Nowa metoda loginWithSSO:
const loginWithSSO = useCallback(
  async (provider: 'azure' | 'google'): Promise<void> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'openid email profile',
      },
    });
    if (error) throw new Error('Błąd logowania SSO. Spróbuj ponownie.');
    // Redirect następuje automatycznie
  },
  [supabase],
);

// Zmiana w logout (SSO front-channel logout):
const logout = useCallback(async (): Promise<void> => {
  const session = await supabase.auth.getSession();
  const provider = session?.data?.session?.user?.app_metadata?.provider;

  await supabase.auth.signOut();
  setUser(null);
  tokenRef.current = null;

  if (provider === 'azure') {
    window.location.href = `https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}`;
  } else {
    window.location.href = "/";
  }
}, [supabase]);
```

### 8.4 Kluczowe zmiany w auth.service.ts

```typescript
// getCurrentUser() — dodanie is_active check:
const { data: profile } = await supabase
  .from("user_profiles")
  .select("id, email, full_name, phone, role, is_active")
  .eq("id", authUser.id)
  .maybeSingle();

if (!profile || !profile.is_active) return null; // NOWE: dezaktywowany = brak dostępu
```

### 8.5 Nowa strona callback

```astro
<!-- src/pages/auth/callback.astro -->
---
// OAuth callback — Supabase parsuje session z URL hash automatycznie
---
<html><head><title>Logowanie...</title></head>
<body>
  <script>
    // Supabase JS client automatycznie parsuje #access_token
    window.location.href = '/orders';
  </script>
</body></html>
```

---

## 9. Panel administracyjny

### 9.1 Endpointy API

```
GET    /api/v1/admin/users              — lista użytkowników (profiles + allowed)
POST   /api/v1/admin/users              — dodaj użytkownika
PUT    /api/v1/admin/users/{userId}     — zmień rolę / dane
DELETE /api/v1/admin/users/{userId}     — dezaktywuj (soft delete)
GET    /api/v1/admin/allowed-emails     — lista dozwolonych emaili
POST   /api/v1/admin/allowed-emails     — dodaj email
DELETE /api/v1/admin/allowed-emails/{id} — usuń email
GET    /api/v1/admin/audit-log          — audit log (opcjonalnie)
```

Wszystkie wymagają roli **ADMIN** (`requireAdmin()`).

### 9.2 Scenariusze

**Dodanie nowego użytkownika SSO:**
```
1. Admin → panel → "Dodaj użytkownika"
2. Wpisuje: jan.nowak@odylion.com, rola: PLANNER
3. Backend: INSERT INTO allowed_emails (email, default_role)
4. Jan loguje się SSO → hook akceptuje → profil tworzony automatycznie
```

**Dodanie użytkownika z hasłem (fallback):**
```
1. Admin → checkbox "Utwórz konto z hasłem"
2. Backend (service_role):
   a. supabase.auth.admin.createUser({ email, password, email_confirm: true })
   b. INSERT INTO user_profiles
   c. INSERT INTO allowed_emails
3. Użytkownik może logować się hasłem LUB SSO
```

**Dezaktywacja użytkownika:**
```
1. Admin → "Dezaktywuj" przy użytkowniku
2. Backend:
   a. user_profiles.is_active = false
   b. allowed_emails.is_active = false
   c. auth.admin.updateUserById(userId, { ban_duration: '876000h' })
3. Natychmiastowa blokada (getCurrentUser() → null → 401)
```

### 9.3 Guardy bezpieczeństwa

- Admin **nie może** modyfikować własnego konta (ochrona przed self-demotion)
- Min. 1 aktywny ADMIN zawsze (trigger DB)
- Każda operacja logowana w `auth_audit_log`
- Oddzielny rate limit: 20 write/min dla `/api/v1/admin/*`

### 9.4 Mockup UI

```
┌──────────────────────────────────────────────────────────────┐
│  Zarządzanie użytkownikami                    [+ Dodaj]      │
├──────────────────────────────────────────────────────────────┤
│  Email              │ Imię         │ Rola     │ Status │ ... │
│  jan@odylion.com    │ Jan Nowak    │ PLANNER  │ Aktywny│ [E] │
│  anna@odylion.com   │ Anna Kowal   │ ADMIN    │ Aktywny│ [E] │
│  piotr@odylion.com  │ — (oczekuje) │ READ_ONLY│ Oczek. │ [X] │
└──────────────────────────────────────────────────────────────┘
Legenda: [E] = Edytuj, [X] = Usuń z allowlisty
"Oczekuje" = email na allowliście ale użytkownik jeszcze się nie zalogował
```

---

## 10. Model zagrożeń i bezpieczeństwo

### 10.1 Wektory ataku i mitygacje

| ID | Wektor ataku | Priorytet | Mitygacja |
|----|-------------|-----------|-----------|
| **A1** | Dual-auth confusion (2 UUID dla 1 emaila) | CRITICAL | Automatic identity linking w Supabase (`enable_manual_linking = false`) |
| **A2** | Domain spoofing (alias, subdomena, case) | HIGH | 4-warstwowa walidacja (IdP + hook + middleware + frontend) |
| **A3** | SSO token replay (sesja po dezaktywacji konta) | HIGH | JWT 15 min + is_active check per-request |
| **A4** | Admin privilege escalation | HIGH | `requireAdmin()` + self-edit guard + min 1 admin trigger |
| **A5** | Pre-approval bypass (timing) | MEDIUM | Auth hook `before_user_created` (synchroniczny, atomowy) |
| **A6** | Brute force email/password fallback | MEDIUM | Rate limiter + Supabase built-in protection |
| **A7** | CSRF na endpointach admin | LOW | JWT w header (nie cookie) → CSRF niemożliwy |

### 10.2 Macierz bezpieczeństwa

| Scenariusz | Zabezpieczenie |
|------------|---------------|
| Użytkownik spoza domeny próbuje SSO | Azure tenant (single) + hook domain check → odrzucenie |
| Użytkownik z domeny ale bez pre-approval | `allowed_emails` check w hooku → brak profilu → 401 |
| Dezaktywowany użytkownik | `is_active=false` + auth ban → natychmiast 401 |
| Skradziony JWT | `is_active` check per-request + krótki token (15 min) |
| Admin usunięty | Trigger: min 1 ADMIN constraint |
| SSO provider down | Fallback email/password (dla kont z hasłem) |
| Brute force hasła | Rate limiter (100 write/min) + Supabase built-in |

### 10.3 Rekomendacje priorytetyzowane

#### CRITICAL (napraw przed rozpoczęciem migracji)

| ID | Rekomendacja | Estymacja |
|----|-------------|-----------|
| SSO-C1 | Napraw istniejące CRITICAL z audytu (C-01..C-04) | 30 min |
| SSO-C2 | Auth hook `before_user_created` — domena + allowlista | 1h |
| SSO-C3 | IdP tenant restriction (TENANT_ID zamiast "common") | 15 min |
| SSO-C4 | `enable_signup = false` | 1 min |
| SSO-C5 | Automatic identity linking (dual-auth safety) | 15 min |

#### HIGH (w ramach implementacji)

| ID | Rekomendacja | Estymacja |
|----|-------------|-----------|
| SSO-H1 | JWT expiry → 900 (15 min) | 1 min |
| SSO-H2 | Session timeout (8h timebox, 2h inactivity) | 5 min |
| SSO-H3 | Auto-provisioning trigger | 30 min |
| SSO-H4 | Tabela `allowed_emails` z RLS | 30 min |
| SSO-H5 | Admin panel endpointy | 3-4h |
| SSO-H6 | Admin audit log (append-only) | 30 min |
| SSO-H7 | Guard: self-edit + min 1 admin | 30 min |
| SSO-H8 | Custom access token hook (role w JWT claims) | 1h |
| SSO-H9 | Napraw istniejące HIGH z audytu (H-01..H-08) | 2-3h |

#### MEDIUM (przed produkcją)

| ID | Rekomendacja | Estymacja |
|----|-------------|-----------|
| SSO-M1 | Frontend: SSO button + fallback UI | 1h |
| SSO-M2 | Domain check w middleware (warstwa 3) | 30 min |
| SSO-M3 | Oddzielny rate limit dla admin (20/min) | 15 min |
| SSO-M4 | SSO front-channel logout | 30 min |
| SSO-M5 | Migracja test usera → real admin | 15 min |

#### LOW (nice to have)

| ID | Rekomendacja |
|----|-------------|
| SSO-L1 | MFA (TOTP) dla fallback email/password |
| SSO-L2 | Periodic IdP sync (cron sprawdzający dezaktywowane konta w AD) |
| SSO-L3 | Login history table (IP, user-agent, provider) |
| SSO-L4 | Alert email do admina przy nowym logowaniu SSO |

---

## 11. Plan wdrożenia (fazy)

### Faza 0: Przygotowanie (ZANIM włączysz SSO)

**Cel:** Naprawić istniejące problemy bezpieczeństwa + przygotować infrastrukturę DB.

| # | Zadanie | Domena | Estymacja |
|---|---------|--------|-----------|
| 0.1 | Napraw CRITICAL z audytu (C-01..C-04) | Database + Backend | 30 min |
| 0.2 | `enable_signup = false` w config.toml | Config | 1 min |
| 0.3 | Migracja SQL: `is_active` + `auth_provider` na user_profiles | Database | 15 min |
| 0.4 | Migracja SQL: `allowed_emails` + `auth_audit_log` | Database | 30 min |
| 0.5 | Hooki SQL: before_user_created, auto-provisioning, last-admin | Database | 1h |
| 0.6 | Rozszerzenie RLS user_profiles (naprawia BUG B-01) | Database | 15 min |
| 0.7 | Seed: istniejący admin do allowed_emails | Database | 5 min |
| 0.8 | JWT expiry → 900, session timeouts | Config | 5 min |

**Estymacja Fazy 0:** ~3h

### Faza 1: Backend — Admin API

**Cel:** Endpointy do zarządzania użytkownikami.

| # | Zadanie | Domena | Estymacja |
|---|---------|--------|-----------|
| 1.1 | `admin-user.service.ts` (CRUD, service_role) | Backend | 2h |
| 1.2 | Endpointy `/api/v1/admin/users/*` | Backend | 1.5h |
| 1.3 | Endpointy `/api/v1/admin/allowed-emails/*` | Backend | 1h |
| 1.4 | Zmiany w `auth.service.ts` (is_active check) | Backend | 15 min |
| 1.5 | Nowe typy DTO w `types.ts` | Types | 15 min |
| 1.6 | Zmiany w middleware (server-side guard /orders, domain check) | Backend | 30 min |

**Estymacja Fazy 1:** ~5.5h

### Faza 2: Konfiguracja IdP (wymaga dostępu do Azure/Google)

**Cel:** Skonfigurować SSO provider.

| # | Zadanie | Estymacja |
|---|---------|-----------|
| 2.1 | Azure App Registration (lub Google Cloud Console) | 30 min |
| 2.2 | Konfiguracja providera w Supabase (config.toml + env) | 15 min |
| 2.3 | Test: SSO login lokalnie | 30 min |

**Estymacja Fazy 2:** ~1.5h (ale wymaga admina Azure/Google)

### Faza 3: Frontend

**Cel:** Nowy UI logowania + panel admin.

| # | Zadanie | Domena | Estymacja |
|---|---------|--------|-----------|
| 3.1 | Callback page `/auth/callback` | Frontend | 15 min |
| 3.2 | `loginWithSSO()` w AuthContext | Frontend | 30 min |
| 3.3 | Nowy layout LoginCard (SSO + fallback) | Frontend | 1h |
| 3.4 | SSO logout w AuthContext | Frontend | 30 min |
| 3.5 | Strona `/admin/users` | Frontend | 30 min |
| 3.6 | UserManagement, UserCreateDialog, UserEditDialog | Frontend | 3h |
| 3.7 | Nawigacja: link do panelu admin w AppSidebar (tylko ADMIN) | Frontend | 15 min | ~~AppHeader.tsx usunięty — zastąpiony przez AppSidebar~~ |

**Estymacja Fazy 3:** ~6h

### Faza 4: Testowanie i migracja

| # | Zadanie | Estymacja |
|---|---------|-----------|
| 4.1 | Test SSO flow (z Azure/Google test tenant) | 1h |
| 4.2 | Test email/password fallback | 30 min |
| 4.3 | Test dezaktywacji użytkownika | 30 min |
| 4.4 | Test auto-provisioning | 30 min |
| 4.5 | Migracja test usera → real admin | 15 min |

**Estymacja Fazy 4:** ~3h

---

## 12. Migracja istniejących użytkowników

### Obecny stan

- 1 użytkownik: `admin@test.pl` / `test1234` (ADMIN, UUID: `c94a20d0...`)
- Powiązany z created_by/updated_by w wielu zleceniach

### Plan migracji

```
1. Dodaj prawdziwego admina do allowlisty:
   INSERT INTO allowed_emails (email, default_role)
   VALUES ('twoj_email@odylion.com', 'ADMIN');

2. Nowy admin loguje się przez SSO → profil tworzony automatycznie

3. Po potwierdzeniu że nowy admin działa:
   UPDATE user_profiles SET is_active = false WHERE email = 'admin@test.pl';
   -- NIE usuwaj — zachowaj referencje FK (created_by_user_id)

4. Na produkcji: użyj admin@test.pl tylko jako fallback awaryjny
   (lub dezaktywuj całkowicie)
```

**WAŻNE:** NIE usuwaj konta `admin@test.pl` — tabele `transport_orders`, `order_status_history` itp. mają FK do tego UUID. Dezaktywuj zamiast usuwać.

---

## 13. Plan rollback

| Poziom | Kiedy | Akcja | Downtime |
|--------|-------|-------|----------|
| **1. Wyłącz SSO** | SSO nie działa ale reszta OK | `[auth.external.azure] enabled = false` | Zero (email/password fallback działa) |
| **2. Cofnij UI** | Frontend buggy | Git revert zmian w LoginCard/AuthContext | Zero (przebudowa) |
| **3. Cofnij migrację** | DB problemy | Reverse migration (DROP tabele, REMOVE hooki) | Krótki (migracja) |
| **4. Pełny rollback** | Wszystko źle | Git revert + `supabase db reset` | Dłuższy |

**Kluczowa zaleta:** Email/password fallback sprawia, że rollback SSO jest **trywialny** — po prostu wyłączasz providera. Dlatego **nie usuwaj** email/password flow.

---

## 14. Problemy i ryzyka

### 14.1 Problemy techniczne

| Problem | Impact | Mitygacja |
|---------|--------|-----------|
| Nie wiadomo czy firma ma Microsoft czy Google | Blokuje Fazę 2 | Architektura wspiera oba — decyzja przed Fazą 2 |
| Supabase hosting (local vs cloud) — niezdefiniowany | Wpływa na konfigurację SSO redirect URIs | Config per-env (.env) |
| Auth hooks `before_user_created` — czy Supabase Free je wspiera? | Może wymagać workaroundu | Alternatywa: sprawdzenie w trigger AFTER INSERT |
| Trigger na `auth.users` — Supabase może blokować | Trigger na schema `auth` wymaga owner lub superuser | Testuj na local; cloud może wymagać Dashboard config |
| Session persistence po SSO redirect | Browser może stracić sesję | Callback page + Supabase auto-parsing |

### 14.2 Ryzyka organizacyjne

| Ryzyko | Prawdopodobieństwo | Impact | Mitygacja |
|--------|-------------------|--------|-----------|
| Brak dostępu do Azure AD admin | Średnie | Blokuje SSO | Fallback: Google Workspace |
| Użytkownicy nie chcą SSO | Niskie | UX regression | Email/password zawsze dostępne |
| IdP outage (Microsoft/Google down) | Niskie | Brak logowania SSO | Email/password fallback |
| Migracja podczas pracy użytkowników | Średnie | Przerwa w dostępie | Deploy poza godzinami pracy |

---

## 15. Otwarte decyzje

Przed rozpoczęciem implementacji potrzebne są decyzje:

| # | Decyzja | Opcje | Rekomendacja |
|---|---------|-------|--------------|
| **D-01** | Identity Provider | Microsoft Entra ID vs Google Workspace | Sprawdź co firma używa (Outlook → Microsoft) |
| **D-02** | Supabase hosting (produkcja) | Self-hosted vs Cloud (Free/Pro) | Wpływa na konfigurację SSO redirect URIs |
| **D-03** | Token w localStorage vs cookies | A: `persistSession:false` (sesja ginie po F5) vs B: `@supabase/ssr` (HttpOnly cookie) | B jest bezpieczniejsze ale więcej pracy |
| **D-04** | Czy fallback email+hasło dla wszystkich? | A: Wszystkie konta SSO+password vs B: Tylko admin ma hasło | B jest prostsze i bezpieczniejsze |
| **D-05** | Panel admin — osobna strona czy tab? | A: `/admin/users` (nowa strona) vs B: Zakładka "Admin" w AppSidebar ~~(dawniej AppHeader — usunięty)~~ | A — czystsza separacja |
| **D-06** | Kolejność wdrożenia | A: Najpierw admin panel, potem SSO vs B: Wszystko naraz | A — etapowe, mniej ryzyka |
| **D-07** | Co z admin@test.pl na produkcji? | A: Dezaktywuj vs B: Zmień email na @odylion.com vs C: Zostaw jako emergency | C na dev, A na prod |

---

## 16. Szacowanie pracochłonności

| Faza | Zakres | Estymacja | Agenci |
|------|--------|-----------|--------|
| **Faza 0** | Przygotowanie DB + config | ~3h | Database, Backend |
| **Faza 1** | Admin API endpoints | ~5.5h | Backend, Types |
| **Faza 2** | Konfiguracja IdP | ~1.5h | Admin (ręcznie) |
| **Faza 3** | Frontend (login + admin panel) | ~6h | Frontend |
| **Faza 4** | Testowanie + migracja | ~3h | Tester |
| **RAZEM** | | **~19h** | |

**Uwaga:** Estymacje nie obejmują napraw z audytu bezpieczeństwa (dodatkowe ~3-5h).

---

## Powiązane dokumenty

- **PRD**: `.ai/prd.md` — sekcja 3 (role, uprawnienia)
- **API plan**: `.ai/api-plan.md` — sekcja 3 (uwierzytelnianie i autoryzacja)
- **DB plan**: `.ai/db-plan.md` — sekcja 1.12 (user_profiles), 4.1-4.2 (RLS)
- **Audyt bezpieczeństwa**: `.ai/to_do/security-audit-2026-02-25.md`
- **TODO**: `.ai/to_do/to_do.md`

---

> **Następny krok:** Użytkownik podejmuje decyzje z sekcji 15 (D-01..D-07), po czym rozpoczynamy implementację od Fazy 0.
