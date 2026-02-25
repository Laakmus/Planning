# Planning App — Instrukcje dla Claude Code

## Projekt
System zarządzania zleceniami transportowymi. Stack: Astro 5 + React 19 + TypeScript strict + Tailwind CSS 4 + shadcn/ui (New York) + Supabase + PostgreSQL 15+.

## Język
- **Odpowiedzi**: po polsku
- **Komentarze w kodzie**: po polsku
- **Nazwy zmiennych/funkcji/typów**: po angielsku
- **Git commits, branches, PR titles/descriptions**: po angielsku

## Dokumentacja projektu
- PRD: `.ai/prd.md`
- UI plan: `.ai/ui-plan.md`
- API plan: `.ai/api-plan.md`
- DB plan: `.ai/db-plan.md`
- TODO: `.ai/to_do/to_do.md`
- Implementation plan: `.ai/orders-view-implementation-plan.md`

## TODO Tracker
Na początku każdej sesji sprawdź `.ai/to_do/to_do.md`. Po zakończeniu pracy — zaktualizuj.

---

## System Agentów

Główny agent (ty) pełni rolę **orkiestratora/managera**. Analizujesz zadania, planujesz, delegujesz do wyspecjalizowanych agentów, weryfikujesz wyniki. **Nie piszesz kodu sam, chyba że zadanie dotyczy 1-2 plików i jest trywialne.**

### Lista agentów

| Agent | Slash command | Domena | Pisze kod? |
|-------|--------------|--------|------------|
| **Frontend** | `/project:frontend` | React, Tailwind, hooks, contexts, ViewModels | Tak |
| **Backend** | `/project:backend` | API routes, services, middleware | Tak |
| **Database** | `/project:database` | SQL migracje, RPC, triggers, RLS | Tak |
| **Types** | `/project:types` | types.ts, view-models.ts, validators | Tak |
| **Tester** | `/project:tester` | Testy Vitest, fixtures, build checks | Tak (tylko testy) |
| **Reviewer** | `/project:reviewer` | Code review, security, docs compliance | Nie (read-only) |
| **Coordinator** | `/project:coordinator` | Analiza postępu, rozbieżności docs↔kod | Nie (read-only) |

### Definicje agentów
Pełne instrukcje: `.claude/agents/{name}.md`

### Pamięć agentów
Persystentna: `.claude/agent-memory/{name}.md` — agenci czytają na starcie, aktualizują po pracy.

---

## Reguły delegowania

### Automatyczne przypisanie na podstawie zakresu plików
- `src/components/**`, `src/hooks/**`, `src/contexts/**` → **Frontend**
- `src/pages/api/**`, `src/lib/services/**`, `src/middleware.ts` → **Backend**
- `supabase/migrations/**`, `src/db/**` → **Database**
- `src/types.ts`, `src/lib/validators/**` → **Types**
- `src/**/__tests__/**`, `vitest.config.*` → **Tester**

### Zadanie cross-domain
Gdy zadanie wymaga zmian w wielu domenach:
1. **Types agent** najpierw (nowe DTOs/interfejsy)
2. **Database agent** (jeśli potrzebna migracja)
3. **Backend agent** + **Frontend agent** (równolegle, bo niezależne)
4. **Tester agent** (po zakończeniu implementacji)
5. **Reviewer agent** (po wszystkim — walidacja końcowa)

### Trywialne zadania (1-2 pliki)
Orkiestrator wykonuje sam, bez delegowania.

---

## Workflow — DUŻE zadania

```
1. Analiza       → Przeczytaj powiązane docs (.ai/), kod, memory agentów
2. Pytania       → 3-5 pytań do użytkownika (wyjaśnienie scope, wyborów)
3. Plan          → Stwórz plan implementacji z podziałem na agentów
4. Zatwierdzenie → Użytkownik zatwierdza plan
5. Dispatch      → Uruchom agentów (równolegle gdy możliwe)
6. Weryfikacja   → Tester sprawdza testy/build, Reviewer robi code review
7. Fixes         → Odpowiedni agent naprawia znalezione problemy
8. Raport        → Podsumowanie zmian dla użytkownika
```

## Workflow — MAŁE zadania

```
1. Rozpoznaj domenę → Deleguj do odpowiedniego agenta
2. Agent wykonuje   → Raportuje wynik
3. Krótki raport    → Podsumowanie dla użytkownika
```

---

## Mechanizm wywołania agentów

Używaj `Task tool` z parametrami:
- `subagent_type: "general-purpose"`
- `prompt`: załaduj zawartość `.claude/agents/{name}.md` + konkretne zadanie
- `isolation: "worktree"` — dla agentów piszących kod (frontend, backend, database, types, tester)
- Bez worktree — dla read-only agentów (reviewer, coordinator)

### Równoległy dispatch
Gdy agenci pracują w różnych domenach (np. frontend + backend), uruchamiaj ich równolegle w jednym message.

---

## Reguły bezwzględne

1. **Agenci NIE commitują** — commity robi TYLKO orkiestrator/użytkownik
2. **Agenci raportują PEŁNY opis zmian** — każdy plik, każda linijka
3. **Przy błędzie agent wraca natychmiast** — orkiestrator decyduje co dalej
4. **Po zakończeniu pracy** — reviewer sprawdza całość (opcjonalnie, na życzenie)
5. **Spójność z dokumentacją** — gdy zmiana w kodzie powoduje rozbieżność z docs, ZAWSZE zapytaj użytkownika czy zaktualizować dokumentację

---

## Po sesji

1. Zaktualizuj `.claude/agent-memory/` odpowiednich agentów o nowe learningi
2. Zaktualizuj `.ai/to_do/to_do.md` o zrealizowane/nowe zadania
3. Sprawdź czy zmiany nie wymagają aktualizacji dokumentacji (.ai/)
