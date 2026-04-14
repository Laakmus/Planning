# Types Agent — Pamięć

## Sesja 59 (2026-04-14) — AUTH-MIG Faza A1

### Nowe moduły w `src/types/`
- `auth.types.ts` — DTOs auth (UsernameLoginRequest/Response, ActivateAccount, MsConnectionStatusDto)
- `user-profile.types.ts` — UserProfile + CRUD admina (CreateUserRequest, UpdateUserRequest, ResetPasswordRequest, AdminUserDto, InviteLinkDto, UserListQuery, PaginatedUsers)

### Nowy validator
- `src/lib/validators/auth.validator.ts`:
  - `usernameSchema` — regex `^[a-z0-9._-]{3,32}$` + `.toLowerCase()`
  - `passwordSchema` — min 8, max 128, ≥1 litera + ≥1 cyfra (pragmatyczne, bez wymogu znaków specjalnych)
  - `loginUsernameSchema`, `createUserSchema`, `updateUserSchema` (partial + omit username/password + extend isActive)
  - `resetPasswordSchema`, `activateAccountSchema` (token 32–128)
  - Eksporty typów `z.infer` dla handlerów API
- Walidator nazywany jest `auth.validator.ts` (konwencja jak `order.validator.ts`)

### Konwencje i decyzje
- **Nazewnictwo plików typów:** nowe moduły używają sufiksu `.types` (`auth.types.ts`, `user-profile.types.ts`). Istniejące moduły (`common.ts`, `order.ts`, `dictionary.ts`, `warehouse.ts`) nie mają sufiksu — niespójność zaakceptowana, nowe moduły są opisowe w nazwie
- **UserRole w Zod:** lokalny `z.enum(["ADMIN","PLANNER","READ_ONLY"])` w walidatorze — TS `UserRole` w `common.ts` jest typem (nie runtime enum), więc nie można użyć w Zod bezpośrednio
- **Hub index.ts:** rozszerzony o re-exporty `./auth.types` i `./user-profile.types`
- **AuthMeDto w common.ts** nietknięty — czy rozszerzyć o `username`/`isActive` to decyzja backendu w Fazie A3a (endpoint `/api/v1/auth/me`)

### Do zapamiętania na przyszłość
- Komentarze w typach po polsku, nazwy pól po angielsku
- `npx tsc --noEmit` czysty po każdej zmianie
- Zod `partial().omit().extend()` chain jest preferowany nad ręcznym przepisywaniem schematów
