# API Endpoint Implementation Plan: Auth

## 1. Przegląd punktu końcowego

Logowanie użytkownika (email + hasło) realizowane jest w całości przez Supabase Auth — frontend wywołuje bezpośrednio `supabase.auth.signInWithPassword()`, co zwraca JWT. Niniejszy plan nie obejmuje endpointu logowania, ponieważ nie jest on częścią naszego REST API — jest wbudowaną funkcją klienta Supabase.

Endpoint `GET /api/v1/auth/me` zwraca dane aktualnie zalogowanego użytkownika — profil i rolę. Służy jako punkt wejścia do sesji — frontend wywołuje go po załadowaniu aplikacji, by ustalić tożsamość i uprawnienia użytkownika.

## 2. Szczegóły żądania

- **Metoda HTTP:** GET
- **URL:** `/api/v1/auth/me`
- **Parametry:** brak
- **Request Body:** brak
- **Wymagane nagłówki:** `Authorization: Bearer <jwt_token>` (Supabase Auth JWT)

## 3. Wykorzystywane typy

- **Response DTO:** `AuthMeDto` (z `src/types.ts`)
  ```typescript
  {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
    role: UserRole; // "ADMIN" | "PLANNER" | "READ_ONLY"
  }
  ```

## 4. Szczegóły odpowiedzi

### Sukces — `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "fullName": "Jan Kowalski",
  "phone": "+48123456789",
  "role": "PLANNER"
}
```

### Błędy
| Kod | Warunek |
|-----|---------|
| `401 Unauthorized` | Brak tokenu, token wygasły lub niepoprawny |

## 5. Przepływ danych

1. Astro middleware wstrzykuje `supabaseClient` do `context.locals.supabase`.
2. Endpoint pobiera sesję użytkownika z `supabase.auth.getUser()` (weryfikacja JWT).
3. Jeśli brak sesji → `401`.
4. Z `user.id` odpytuje tabelę `user_profiles` po PK:
   ```typescript
   const { data, error } = await supabase
     .from('user_profiles')
     .select('id, email, full_name, phone, role')
     .eq('id', user.id)
     .single();
   ```
5. Mapuje `snake_case` → `camelCase` i zwraca `AuthMeDto`.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie:** Weryfikacja JWT przez Supabase Auth (`getUser()`). Nie polegać na `getSession()` — po stronie serwera zawsze `getUser()`.
- **Brak RLS bypass:** Zapytanie działa przez klienta z RLS — użytkownik widzi tylko swój profil (jeśli polityka SELECT ogranicza do `auth.uid()`).
- **Brak danych wrażliwych:** Nie zwracamy tokenu, hasła ani pól wewnętrznych (`created_at`, `updated_at`).

## 7. Obsługa błędów

| Scenariusz | Kod | Odpowiedź |
|------------|-----|-----------|
| Brak/niepoprawny token JWT | 401 | `{ "error": { "code": "UNAUTHORIZED", "message": "Nie jesteś zalogowany" } }` |
| Token poprawny, ale brak profilu w `user_profiles` | 401 | `{ "error": { "code": "PROFILE_NOT_FOUND", "message": "Profil użytkownika nie istnieje" } }` |
| Błąd Supabase (sieć, DB) | 500 | `{ "error": { "code": "INTERNAL_ERROR", "message": "Błąd serwera" } }` |

## 8. Rozważania dotyczące wydajności

- Zapytanie po PK (`user_profiles.id`) — O(1), indeks automatyczny.
- Brak potrzeby cache'owania — endpoint wywoływany raz przy ładowaniu sesji.
- Minimalna ilość danych (5 pól).

## 9. Etapy wdrożenia

### Krok 0: Konfiguracja Astro dla Server Endpoints
Astro domyślnie generuje statyczny output. Aby endpointy API działały, trzeba:
1. Dodać adapter Node.js: `npx astro add node`
2. W `astro.config.mjs` ustawić `output: 'server'` (lub `'hybrid'` jeśli część stron ma pozostać statyczna).

### Krok 1: Middleware — rozszerzenie o autentykację
Rozszerzyć `src/middleware/index.ts`:
- Na ścieżkach `/api/v1/**` odczytywać nagłówek `Authorization`, tworzyć klienta Supabase per-request z tokenem użytkownika (zamiast jednego globalnego `supabaseClient`), aby RLS działał poprawnie.
- Zapisać `context.locals.user` (obiekt z `getUser()`) i `context.locals.supabase`.
- Dla endpointów wymagających zapisu sprawdzić rolę (w kolejnych planach).

### Krok 2: Plik route
Utworzyć `src/pages/api/v1/auth/me.ts`:
```typescript
import type { APIRoute } from 'astro';
import type { AuthMeDto } from '../../../../types';

export const GET: APIRoute = async ({ locals }) => {
  // 1. Sprawdź autentykację
  // 2. Pobierz profil z user_profiles
  // 3. Mapuj na AuthMeDto
  // 4. Zwróć Response JSON
};
```

### Krok 3: Walidacja
- Brak walidacji wejścia (endpoint bez parametrów).
- Walidacja istnienia profilu w `user_profiles`.

### Krok 4: Testy manualne
- Test bez tokenu → 401.
- Test z poprawnym tokenem → 200 + dane profilu.
- Test z tokenem, ale bez profilu w `user_profiles` → 401.
