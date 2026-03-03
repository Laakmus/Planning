# Tester Agent — Pamięć

## Sesja 24 (2026-03-03) — testy security + access control + ErrorBoundary

### Wykonane
- `src/test/security/env-example.test.ts` — 6 testów:
  - Plik istnieje, brak kluczy Supabase, brak JWT, placeholdery w KEY/SECRET, brak base64 >40 chars, CORS ≠ *
- `src/lib/__tests__/access-control.test.ts` — 8 testów:
  - requireWriteAccess: ADMIN ok, PLANNER ok, READ_ONLY → 403
  - requireAdmin: ADMIN ok, PLANNER → 403, READ_ONLY → 403, Content-Type header, brak details
- `src/components/ui/__tests__/ErrorBoundary.test.tsx` — 6 testów:
  - Renderuje dzieci, domyślny fallback (role=alert), custom fallback, onError callback, retry button, brak fallbacku bez błędu

### Learningi
- React 19 strict mode + concurrent rendering → component render wielokrotnie w dev mode
  - NIE używaj `throwCount++` — zamiast tego obiekt `{ shouldThrow: boolean }` jako flag
- `vi.spyOn(console, "error").mockImplementation(() => {})` — wyciszenie React ErrorBoundary noise
  - Po `vi.restoreAllMocks()` w `afterEach` trzeba ponownie zamockować
- Importy: `requireWriteAccess`, `requireAdmin` z `../api-helpers` (nie z `@/lib/api-helpers`)
- `makeUser(role)` factory pattern — `AuthMeDto` z minimalnym zestawem pól
- Wzorzec AAA (Arrange-Act-Assert) z komentarzami — zgodnie z rules/vitest-unit-testing.mdc
- `readFileSync` + `join(__dirname, ...)` dla testów plików konfiguracyjnych
