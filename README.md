# Planning - System Zleceń Transportowych

Wewnętrzna aplikacja webowa do planowania i wystawiania zleceń transportowych.

## Stack technologiczny

- **Frontend:** Astro 5.x + React 19 + TypeScript + Tailwind CSS 4
- **Backend/API:** Node.js + TypeScript
- **Baza danych:** PostgreSQL (Supabase w środowisku testowym, firmowa infrastruktura w produkcji)
- **Dane słownikowe:** Integracja z firmowym ERP
- **CI/CD:** GitHub Actions
- **Przeglądarka docelowa:** Chrome (laptopy)

## Wymagania

- Node.js 24+
- npm

## Instalacja

```bash
npm install
```

## Skrypty

| Polecenie            | Opis                                      |
| :------------------- | :---------------------------------------- |
| `npm run dev`        | Uruchamia serwer deweloperski (port 4321) |
| `npm run build`      | Buduje wersję produkcyjną do `./dist/`    |
| `npm run preview`    | Podgląd wersji produkcyjnej               |
| `npm run lint`       | Sprawdza kod (ESLint)                     |
| `npm run lint:fix`   | Naprawia błędy ESLint                     |
| `npm run format`     | Formatuje kod (Prettier)                  |
| `npm run format:check` | Sprawdza formatowanie                   |

## Struktura projektu

```
/
├── public/              # Pliki statyczne
├── src/
│   ├── assets/          # Zasoby (obrazy, ikony)
│   ├── components/      # Komponenty (Astro + React)
│   ├── layouts/         # Layouty stron
│   ├── pages/           # Strony aplikacji (routing Astro)
│   └── styles/          # Style globalne (Tailwind CSS)
├── test/                # Testy
├── .ai/                 # Dokumentacja projektu (PRD, schemat DB, reguły)
├── astro.config.mjs     # Konfiguracja Astro
├── eslint.config.js     # Konfiguracja ESLint
├── tsconfig.json        # Konfiguracja TypeScript
└── package.json
```

## Dokumentacja

Szczegółowa dokumentacja projektu znajduje się w katalogu `.ai/`:

- `prd.md` - Product Requirements Document
- `db-plan.md` - Schemat bazy danych (tabele, relacje, indeksy, RLS)
- `rules/tech-stack.md` - Opis stacku technologicznego
- `rules/` - Reguły i konwencje dla kodowania, testów, komponentów UI
