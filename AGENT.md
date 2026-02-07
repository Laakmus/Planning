# AGENT.md

Instrukcje dla agentów AI pracujących z tym projektem.

## Opis projektu

System zleceń transportowych - wewnętrzna aplikacja webowa do planowania i wystawiania zleceń transportowych dla firmy zajmującej się hurtowym skupem złomu metali kolorowych i papieru.

## Komendy

```bash
npm run dev          # Serwer deweloperski (localhost:4321)
npm run build        # Build produkcyjny
npm run preview      # Podgląd builda
npm run lint         # Sprawdź kod (ESLint)
npm run lint:fix     # Napraw błędy ESLint
npm run format       # Formatuj kod (Prettier)
npm run format:check # Sprawdź formatowanie
```

## Stack technologiczny

- **Framework:** Astro 5.x
- **UI:** React + TypeScript
- **Style:** Tailwind CSS
- **Baza danych:** PostgreSQL (Supabase)
- **Node.js:** 24+

## Struktura projektu

```
src/
├── assets/       # Obrazy, ikony, zasoby statyczne
├── components/   # Komponenty Astro i React
├── layouts/      # Layouty stron
└── pages/        # Strony (routing oparty na plikach)

public/           # Pliki statyczne (favicon, itp.)
.ai/              # Dokumentacja projektu (PRD, specyfikacje)
```

## Konwencje kodowania

### Nazewnictwo
- Komponenty: `PascalCase` (np. `OrderList.tsx`, `FilterPanel.astro`)
- Pliki pomocnicze: `kebab-case` (np. `date-utils.ts`)
- Zmienne/funkcje: `camelCase`
- Stałe: `SCREAMING_SNAKE_CASE`

### TypeScript
- Używaj strict mode
- Definiuj typy dla props komponentów
- Unikaj `any` - używaj `unknown` jeśli typ nieznany

### Komponenty
- Komponenty React dla interaktywnych elementów (formularze, filtry)
- Komponenty Astro dla statycznych części strony
- Małe, jednozadaniowe komponenty

### Style
- Używaj klas Tailwind CSS
- Unikaj inline styles
- Dla powtarzalnych stylów twórz komponenty

## Domena biznesowa

### Kluczowe pojęcia
- **Zlecenie transportowe** - dokument opisujący transport towaru
- **Przewoźnik** - firma transportowa realizująca zlecenie
- **Nadawca** - firma, od której odbieramy towar
- **Odbiorca** - firma, do której dostarczamy towar
- **Punkt załadunku/rozładunku** - miejsce na trasie transportu

### Statusy zleceń
- `robocze` - nowe, w trakcie wypełniania
- `wysłane` - zlecenie wysłano do przewoźnika
- `korekta` - zmiany po wysyłce, niewysłane
- `korekta wysłane` - korekta wysłana
- `zrealizowane` - transport zakończony
- `reklamacja` - transport z reklamacją
- `anulowane` - zlecenie anulowane

### Rodzaje transportu
- Krajowy
- Eksport drogowy
- Kontener morski

## Dokumentacja

Pełna specyfikacja wymagań: `.ai/prd.md`
