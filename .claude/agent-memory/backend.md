# Backend Agent — Pamięć

## Sesja 50 (2026-04-14) — A3a-2: admin users CRUD (WYKONANE)

### Wykonane pliki
- **NEW** `src/lib/services/user-admin.service.ts` — serwis administracyjny userów:
  - `createAdminSupabaseClient()` — service_role client (auth.admin.* + RLS bypass)
  - `mapRowToAdminUserDto(row)` — mapper snake_case → camelCase
  - `listUsers(supabase, query)` — paginacja + LIKE sanitized search (`%`, `_`, `\`) po username/email/full_name, filtry role/isActive, sort `created_at DESC`
  - `createUser(supabase, req)` — auth.admin.createUser + INSERT user_profiles + invite token (compensation: deleteUser on profile insert failure)
  - `updateUser(supabase, id, data, currentUserId)` — UPDATE + sync email do auth.users + signOut przy deaktywacji (is_active true→false); rzuca `SELF_DEACTIVATION`, `USER_NOT_FOUND`
  - `deactivateUser(supabase, id, currentUserId)` — soft delete (is_active=false) + signOut best-effort
  - `resetUserPassword(supabase, id, newPassword)` — auth.admin.updateUserById
  - `regenerateInvite(supabase, id)` — nowy token + hash + expiry
- **NEW** `src/pages/api/v1/admin/users/index.ts` — GET (lista z Zod query schema inline) + POST (create)
- **NEW** `src/pages/api/v1/admin/users/[id].ts` — PATCH (update) + DELETE (deactivate)
- **NEW** `src/pages/api/v1/admin/users/[id]/reset-password.ts` — POST
- **NEW** `src/pages/api/v1/admin/users/[id]/invite.ts` — POST

### Kontrakty z A3a-1 (importowane, plików nie było w worktree przy starcie)
- `import { requireAdmin } from '@/lib/auth/requireAdmin'` — guard na (context) zwracający auth info albo Response 401/403
- `import { generateInviteToken, hashInviteToken, buildActivateUrl, TOKEN_TTL_DAYS } from '@/lib/services/invite-token.service'`
- Defensywne rzutowanie `authResult` na `{ userId?: string; id?: string }` bo kształt może różnić się od AuthMeDto

### Wzorce użyte z istniejącej bazy
- `createAdminSupabaseClient()` wzorowany na `createServiceRoleClient()` z `cleanup.service.ts`
- Sanitize LIKE: `value.replace(/[%_\\]/g, "\\$&")` — jak w `order-list.service.ts` i `dictionary.service.ts`
- `errorResponse`, `jsonResponse`, `isValidUUID`, `parseJsonBody`, `parseQueryParams`, `logError` z `api-helpers.ts`
- Wzorzec endpointu: safeParse + details `Record<string, string[]>` + try/catch z mapowaniem domain errors na HTTP status (jak w `orders/index.ts`)
- 204 No Content: `new Response(null, { status: 204 })` — dla DELETE i reset-password

### tsc — status
- Błędy WYŁĄCZNIE z braku modułów A1/A2/A3a-1 w worktree (merge naprawi):
  - A1: `types/user-profile.types`, `validators/auth.validator`
  - A2: `database.types.ts` worktree nie ma kolumn `username/is_active/invite_token_hash/invite_expires_at/invited_at/activated_at`
  - A3a-1: `lib/auth/requireAdmin`, `lib/services/invite-token.service`
- Zero regresji w istniejącym kodzie poza moimi nowymi plikami

### Learningi
- Write tool z absolutną ścieżką `Planning/src/...` zapisuje do GŁÓWNEGO repo, nie do worktree — trzeba używać ścieżki `Planning/.claude/worktrees/agent-XXX/src/...` (lub potem przenieść `mv`)
- `supabase.auth.admin.signOut(userId)` — best-effort via `.catch(() => {})` bo failure nie powinien blokować deaktywacji
- `supabase.auth.admin.createUser({ email_confirm: true })` — pomija wysyłkę natywnego email Supabase (mamy własny invite flow)
- PostgREST `.or()` syntax: `field.op.value,field2.op.value` (np. `username.ilike.%x%,email.ilike.%x%`) — brak escapów przecinka, więc sanitize wejścia obowiązkowa

## Sesja 50 (2026-04-14) — A3a-1 Backend-auth: login + activate + guards

### Wykonane
- `src/lib/auth/requireAdmin.ts` — guard ADMIN z klasą `AuthGuardError` (statusCode 401/403); happy-path zwraca `{ userId, role: 'ADMIN' }`. Pobiera usera przez `getCurrentUser(locals.supabase)` — middleware NIE wstrzykuje `locals.user`. Alias `assertAdmin = requireAdmin`.
- `src/lib/auth/rate-limit.ts` — in-memory sliding window (Map<ip, timestamps[]>), 10 prób / 15 min, eviction przy >10k kubełków. Export `checkLoginRateLimit(ip)` + `__resetLoginRateLimit()` (testy).
- `src/lib/services/invite-token.service.ts` — `generateInviteToken()` (randomBytes(32) hex + SHA-256 hash), `hashInviteToken(plain)`, `buildActivateUrl(token, baseUrl)`. `TOKEN_TTL_DAYS = 7`. Używa Node `crypto`.
- `src/pages/api/v1/auth/login.ts` — POST: IP rate-limit → Zod → RPC `resolve_username_to_email` (service_role) → is_active check (403) → `signInWithPassword` (anon client) → odczyt profilu (service_role) → `UsernameLoginResponse`. Komunikaty 401 identyczne dla brak-usera i złe-hasło (anti-enumeration).
- `src/pages/api/v1/auth/activate.ts` — POST: Zod → SHA-256 → lookup po `invite_token_hash` → walidacja wygaśnięcia/is_active → UPDATE z czyszczeniem tokenu → `{ ok: true }`.
- `.env.example` — dodano `PUBLIC_BASE_URL=http://localhost:4321`.

### Learningi — KRYTYCZNE
- **Worktree stale code (ponownie potwierdzone, sesja 32)**: Worktree agenta dostał kod z ostatniego commita, ale artefakty A1 (`auth.types.ts`, `auth.validator.ts`) i A2 (`database.types.ts` z kolumnami username/invite_token) były w głównym working tree jako uncommitted changes. Musiałem skopiować je z main → worktree, żeby `tsc` przeszedł. **Rekomendacja orkiestratora**: commituj A1+A2 przed uruchomieniem A3a w worktree, albo uruchamiaj A3a ręcznie poza worktree.
- **`supabase.rpc(...)` typing**: database.types.ts definiuje `resolve_username_to_email` z `Returns: { email, is_active }[]` — więc `data` to tablica, nie pojedynczy obiekt. Pamiętać przy kolejnych RPC.
- **Middleware nie wstrzykuje `locals.user`** — guard musi pobrać usera samodzielnie przez `getCurrentUser(locals.supabase)`. Jeśli kiedyś dodamy `locals.user` do middleware, refaktor `requireAdmin` będzie trywialny.
- **`AuthGuardError` vs Response pattern**: Zrezygnowałem z `Response | null` na rzecz thrown exception — daje czystszy happy-path (kontrakt `Promise<{ userId, role }>`). Konsumenci (A3a-2) łapią error i mapują na `errorResponse(err.statusCode, err.errorCode, err.message)`.
- **Anti user enumeration**: `/auth/login` zwraca identyczny 401 ("Nieprawidłowy login lub hasło") dla brak-usera w RPC i błąd `signInWithPassword`. Tylko `is_active=false` dostaje wyróżniony 403.
- **Idempotencja activate**: Jeśli konto już aktywne → 400 z komunikatem "Konto już aktywne. Zaloguj się." (NIE 200, żeby odróżnić pierwszą aktywację od duplikatu klika).
- **Service_role clients** tworzone lokalnie w endpointach (brak `supabase.server.ts` w repo). Dwa klienty: admin (service_role, do RPC + user_profiles) i anon (do `signInWithPassword`).

### Wyniki tsc
- `npx tsc --noEmit` → **exit=0** (czysto, po staged A1+A2 outputs w worktree)

### Co zakładam o infrastrukturze
- `@/lib/api-helpers` — używam `errorResponse`, `jsonResponse`, `logError`, `parseJsonBody` (wszystkie istnieją).
- `@/lib/services/auth.service` — używam `getCurrentUser(supabase)`.
- Middleware wstrzykuje `context.locals.supabase` z JWT (user-scoped anon client).
- Brak `src/db/supabase.server.ts` — service_role client tworzony inline przez `createClient<Database>(url, SUPABASE_SERVICE_ROLE_KEY)`.
- A2 dodało RPC `resolve_username_to_email(p_username) RETURNS TABLE(email, is_active)[]` — typy DB już uwzględniają.
- A2 dodało kolumny: `username`, `is_active`, `invite_token_hash`, `invite_expires_at`, `invited_at`, `activated_at`.

## Sesja 49 (2026-03-26) — M-11 Structured logging z pino (WYKONANE)

### Wykonane
- Nowy moduł `src/lib/logger.ts` — pino z pino-pretty w DEV, JSON w produkcji
- `src/lib/api-helpers.ts`: `logError()` używa `logger.error()` zamiast `console.error()`
- `src/lib/services/cleanup.service.ts`: 5x zamiana console.log/error → logger.info/warn/error
- `src/lib/services/__tests__/cleanup.service.test.ts`: mock `@/lib/logger` zamiast `console.log` spy

### Learningi
- `import.meta.env` może nie istnieć w każdym kontekście — bezpieczna detekcja: `typeof import.meta !== "undefined" && import.meta.env?.DEV`
- Testy API mockują `logError` na poziomie modułu `api-helpers` (vi.mock) — zmiana implementacji `logError` nie wymaga zmian w tych testach
- ErrorBoundary.tsx (frontend/React) — NIE zamieniać console.error na pino (pino nie działa w przeglądarce)

## Sesja 33 (2026-03-05) — H-02 rozbicie god service (WYKONANE)

### Wykonane
- `order.service.ts` (2400 linii) rozbity na 6 sub-serwisów + re-export hub (17 linii)
- Sub-serwisy: `order-snapshot`, `order-list`, `order-detail`, `order-create`, `order-update`, `order-misc`
- Re-export hub zapewnia backward compatibility — zero zmian w 15 konsumentach
- 782 testów PASS, 0 błędów TS w sub-serwisach
- Reviewer: PASS na 8/8 punktów checklisty

### Learningi
- Orkiestrator wykonał rozbicie ręcznie (bez worktree) — uniknięto problemów z sesji 32
- Wcześniejsze wpisy odnoszące się do monolitycznego `order.service.ts` → logika w odpowiednich sub-serwisach

## Sesja 32 (2026-03-05) — H-02 próba rozbicia god service (NIEUDANA → naprawione w sesji 33)

### Learningi — KRYTYCZNE
- **Worktree stale code**: Agenci w worktree dostają kod z brancha bazowego, NIE z bieżącego working directory. Jeśli zmiany nie są scommitowane, agent pracuje na starym kodzie.
- **Rekomendacja**: Duże refaktory plikowe wykonywać ręcznie (orkiestrator) lub commitować przed uruchomieniem agentów w worktree.

## Sesja 30 (2026-03-04) — Fix bugów API (audyt 4 agentów)

### Naprawione bugi w `order.service.ts`
- Dodano `notification_details` i `confidentiality_clause` do `TransportOrderRowExtended` — eliminuje `(row as any)` casty
- Usunięto 5x `as any` castów: `getOrderDetail`, `createOrder`, `updateOrder`, `duplicateOrder`, `businessFieldMap`
- Fix `duplicateOrder`: `notification_details: null` → `detail.order.notificationDetails ?? null` (kopiowanie z oryginału)
- Dodano `confidentiality_clause` do `.select()` i inline type w `updateOrder`

### Naprawione bugi w `order.validator.ts`
- `notificationDetails` i `confidentialityClause`: `.nullable().optional()` → `.nullable().default(null)`
- Eliminuje bug: gdy frontend nie wysyła pola, Zod zwraca `null` zamiast `undefined` → poprawne INSERT/UPDATE

### Wzorce — LEKCJE
- Po dodaniu kolumn do DB migracji, ZAWSZE dodaj je też do `TransportOrderRowExtended` — unikaj `(row as any)`
- Nowe pola w walidatorze: użyj `.nullable().default(null)` zamiast `.nullable().optional()` jeśli pole ma być zawsze obecne w wyniku parse
- `businessFieldMap` wymaga `keyof UpdateOrderParams` — upewnij się że nowe pola są w typie Zod

## Sesja 25 (2026-03-03) — Widok magazynowy (warehouse)

### Nowe pliki
- **`src/lib/services/warehouse.service.ts`** — serwis `getWarehouseWeekOrders()` + `getCurrentISOWeek()`
  - Oblicza zakres dat tygodnia ISO (pon-nd) via `getISOWeekMonday()`
  - 2 zapytania Supabase: stopy z datą w zakresie + stopy bez daty
  - PostgREST inner join: `order_stops` → `transport_orders!inner` → `order_items`
  - Filtr statusów: robocze, wysłane, korekta, korekta wysłane, reklamacja
  - Sobota/niedziela przesuwane do piątku z `isWeekend: true`
  - Sortowanie chronologiczne wg `timeLocal` w każdym dniu
  - Podsumowanie: loadingCount/Tons, unloadingCount/Tons
- **`src/pages/api/v1/warehouse/orders.ts`** — GET endpoint
  - Auth guard + sprawdzenie `locationId` (403 gdy brak)
  - Query params: `week` + `year` (opcjonalne, domyślnie bieżący tydzień ISO)
  - Walidacja Zod via `warehouseQuerySchema`
  - Pobiera nazwę lokalizacji z `locations` table

### Zmiany w `order.service.ts`
- **`duplicateOrder()`**: Dodano nullowanie 5 pól awizacji (driver_name, driver_phone, truck_plate, trailer_plate, bdo_number) — dane dyspozycji nie są kopiowane do duplikatu

### Wzorce
- Supabase inner join na order_stops: `transport_orders!inner(...)` — filtruje stopy po statusie zlecenia
- `getDay()` JS: 0=nd, 1=pon; konwersja na indeks tygodniowy: `jsDay === 0 ? 6 : jsDay - 1`
- Typy DB nie zawierają nowych kolumn (driver_name itp.) — użyto `as any` cast na zapytaniach

## Sesja 21 (2026-03-02) — Rozdzielenie pól pojazdu

### Zmiany w `order.service.ts`
- **vehicleVariantCode (FK) usunięty** → zastąpiony przez `vehicleTypeText` (string) + `vehicleCapacityVolumeM3` (number)
- Usunięto join `vehicle_variants(name)` z `selectColumns`
- Usunięto typ `vehicle_variants` z `TransportOrderRow`
- Usunięto walidację `vehicleVariantCode` z `validateForeignKeys()`
- `mapRowToOrderListItemDto`: `vehicleTypeText` z `row.vehicle_type_text`, usunięto `vehicleVariantName`
- `getOrderDetail`: dodano `vehicleCapacityVolumeM3` do mapowania
- `createOrder`/`updateOrder`/`duplicateOrder`: `vehicle_type_text` + `vehicle_capacity_volume_m3` w payload
- `businessFieldMap`: 2 nowe pola zamiast 1 starego

### Migracja DB
- `vehicle_type_text varchar(100)` + `vehicle_capacity_volume_m3 numeric(12,1)` dodane do transport_orders
- FK `transport_orders_vehicle_variant_code_fkey` usunięty (kolumna zostaje)
- Dane zmigrowane z vehicle_variants (UPDATE ... FROM)

## Sesja 18 (2026-03-01) — Rozszerzenie Audit Trail

### Zmiany w `order.service.ts`
- **createOrder()**: Dodano INSERT do `order_change_log` z `field_name: "order_created"` po insertach stops+items
- **updateOrder()**: Dodano snapshoty starych items (`oldItemsMap`) i stops (`oldStopsMap`) PRZED modyfikacjami
  - Logowanie zmian items: `item_added`, `item_removed`, `item[N].product_name/loading_method_code/quantity_tons/notes`
  - Logowanie zmian stops: `stop_added`, `stop_removed` z etykietami `L{seq}: {firma}` / `U{seq}: {firma}`
  - FK resolve: `carrier_company_id`, `shipper_location_id`, `receiver_location_id` → nazwy firm zamiast UUID
  - Helper `resolveFkName()` zdefiniowany wewnątrz `updateOrder()` (nie top-level) — dodatkowe query tylko dla starych FK
- **patchStop()**: Wyłączono `location_id` z generycznego `fieldMap`, dodano specjalną obsługę z resolwem nazw lokalizacji

### Wzorce
- `auditItemNum` liczy numerację 1-based niezależnie od `activeItemIdx`
- `stopSnapshotMap` (po sequenceNo) zawiera snapshoty z batch query — zero dodatkowych queries dla nowych stops
- Dla nowych wartości FK: użyj istniejących snapshotów (`carrierSnapshots`, `shipperSnapshots`, `receiverSnapshots`)
- Dla starych wartości FK: `resolveFkName()` robi query (max 1-2 queries, tylko gdy FK się zmienia)
