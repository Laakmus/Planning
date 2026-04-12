# Project Coordinator Agent — Pamięć

## Sesja 2026-04-09 — Pełny audit projektu

### Stan projektu
- **MVP-complete**: Wszystkie wymagania z PRD §3.1 (zlecenia) i §3.2 (magazyn) zaimplementowane
- **Metryki**: 253 plików TS/TSX, 47 415 linii kodu, 69 plików testów unit (20 909 linii), 9 plików E2E (828 linii), 15 migracji SQL
- **Testy**: 1057 unit + 25 E2E, 0 błędów TypeScript, build OK
- **Ostatni commit**: `88a5190` (Performance: gzip, combined dictionaries, sessionStorage cache, MSAL lazy-load)

### Otwarte TODO
- **HIGH**: H-04 (MS Graph→backend, blocked: Azure AD), H-05 (ERP integration, blocked: Comarch API docs)
- **MEDIUM**: M-13 (CI/CD deploy pipeline, blocked: target infrastructure decision)
- **LOW**: L-12 (migration cleanup), L-13 (6 test assertions)
- **Odroczone**: 17 pozycji (D-03..D-30) — świadome decyzje użytkownika

### Rozbieżności docs↔kod (5 drobnych)
1. `GET /api/v1/dictionaries` (combined endpoint) brak w api-plan.md
2. `locationId` parametr w warehouse/orders brak w api-plan.md §2.16
3. Badge kolory Zał/Roz w PRD §3.2.3 — zweryfikować spójność z kodem
4. Tabela `order_no_counters` — potwierdź aktualność w db-plan.md
5. OrderView (A4) — brak explicit "DONE" statusu w TODO

### Blokery do produkcji
1. **Integracja ERP** (H-05) — jedyny bloker funkcjonalny, wymaga dokumentacji od IT
2. **CI/CD deploy** (M-13) — wymaga decyzji o infrastrukturze
3. **Konfiguracja produkcyjna** — seed users, env vars, DNS (template istnieje)

### Learningi
- Projekt przeszedł 58+ sesji development
- Agent teams: 7 agentów, 6 z pamięcią (types.md pusty)
- Kod stabilny: ostatnie sesje to performance optimization i hardening, nie nowe feature'y
