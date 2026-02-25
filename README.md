# Planning - System Zleceń Transportowych

Wewnętrzna aplikacja webowa do planowania i wystawiania zleceń transportowych.

## Stack technologiczny

- **Frontend:** Astro 5.x + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend/API:** Astro SSR (Node.js adapter) + TypeScript + Zod (walidacja)
- **Baza danych:** PostgreSQL (Supabase w środowisku testowym, firmowa infrastruktura w produkcji)
- **Dane słownikowe:** Integracja z firmowym ERP (synchronizacja słowników)
- **Testy:** Vitest + Testing Library
- **CI/CD:** GitHub Actions
- **Przeglądarka docelowa:** Chrome (laptopy)

## Wymagania

- Node.js 24+
- npm

## Instalacja

```bash
npm install
```

Skopiuj `.env.example` do `.env` i uzupełnij zmienne środowiskowe (Supabase URL, klucze, CORS origin).

## Skrypty

| Polecenie              | Opis                                      |
| :--------------------- | :---------------------------------------- |
| `npm run dev`          | Uruchamia serwer deweloperski (port 4321) |
| `npm run build`        | Buduje wersję produkcyjną do `./dist/`    |
| `npm run preview`      | Podgląd wersji produkcyjnej               |
| `npm run test`         | Uruchamia testy (Vitest)                  |
| `npm run test:watch`   | Testy w trybie watch                      |
| `npm run lint`         | Sprawdza kod (ESLint)                     |
| `npm run lint:fix`     | Naprawia błędy ESLint                     |
| `npm run format`       | Formatuje kod (Prettier)                  |
| `npm run format:check` | Sprawdza formatowanie                     |

## Struktura projektu

```
/
├── public/                  # Pliki statyczne
├── src/
│   ├── assets/              # Zasoby (obrazy, ikony)
│   ├── components/
│   │   ├── auth/            # Logowanie (LoginCard)
│   │   ├── orders/          # Główny moduł zleceń
│   │   │   ├── drawer/      # Panel szczegółów zlecenia (12 komponentów)
│   │   │   └── history/     # Historia zmian (timeline)
│   │   └── ui/              # Komponenty shadcn/ui
│   ├── contexts/            # React Contexts (Auth, Dictionary)
│   ├── db/                  # Klient Supabase, typy DB
│   ├── hooks/               # Custom hooks (useOrders, useOrderDetail, useOrderHistory)
│   ├── layouts/             # Layouty stron (Astro)
│   ├── lib/
│   │   ├── services/        # Serwisy backendowe (auth, order, lock, history)
│   │   ├── validators/      # Schematy walidacji Zod
│   │   └── ...              # api-client, view-models, utils
│   ├── pages/
│   │   ├── api/v1/          # REST API (orders, auth, dictionaries)
│   │   ├── index.astro      # Strona logowania
│   │   └── orders.astro     # Widok zleceń (React island)
│   ├── styles/              # Style globalne (Tailwind CSS)
│   └── types.ts             # Typy współdzielone (DTO, enums)
├── test/                    # Mockupy HTML (referencja wizualna)
├── .ai/                     # Dokumentacja projektu
├── astro.config.mjs         # Konfiguracja Astro
├── eslint.config.js         # Konfiguracja ESLint
├── tsconfig.json            # Konfiguracja TypeScript
└── package.json
```

## API

REST API dostępne pod `/api/v1/`:

| Endpoint                              | Opis                           |
| :------------------------------------ | :----------------------------- |
| `POST /auth/me`                       | Autentykacja użytkownika       |
| `GET /orders`                         | Lista zleceń (filtrowanie, paginacja) |
| `POST /orders`                        | Tworzenie nowego zlecenia      |
| `GET /orders/:id`                     | Szczegóły zlecenia             |
| `PUT /orders/:id`                     | Aktualizacja zlecenia          |
| `POST /orders/:id/lock`              | Blokada zlecenia do edycji     |
| `DELETE /orders/:id/lock`            | Odblokowanie zlecenia          |
| `PUT /orders/:id/status`             | Zmiana statusu                 |
| `POST /orders/:id/duplicate`         | Duplikowanie zlecenia          |
| `POST /orders/:id/restore`           | Przywracanie zlecenia          |
| `GET /orders/:id/prepare-email`      | Przygotowanie emaila (mailto)  |
| `GET /orders/:id/pdf`                | Pobranie PDF (stub)            |
| `GET /orders/:id/history/changes`    | Historia zmian                 |
| `GET /orders/:id/history/status`     | Historia statusów              |
| `GET /companies`                      | Słownik firm                   |
| `GET /locations`                      | Słownik lokalizacji            |
| `GET /products`                       | Słownik produktów              |
| `GET /transport-types`                | Typy transportu                |
| `GET /order-statuses`                 | Statusy zleceń                 |
| `GET /vehicle-variants`               | Warianty pojazdów              |
| `POST /dictionary-sync/run`          | Synchronizacja słowników z ERP |

## Role użytkowników

| Rola        | Uprawnienia                                      |
| :---------- | :----------------------------------------------- |
| `ADMIN`     | Pełny dostęp + zarządzanie użytkownikami         |
| `PLANNER`   | Tworzenie, edycja, zmiana statusu zleceń         |
| `READ_ONLY` | Tylko podgląd listy i szczegółów zleceń          |

## Dokumentacja

Szczegółowa dokumentacja projektu znajduje się w katalogu `.ai/`:

- `prd.md` - Product Requirements Document
- `db-plan.md` - Schemat bazy danych (tabele, relacje, indeksy, RLS)
- `api-plan.md` - Specyfikacja API
- `ui-plan.md` - Plan interfejsu użytkownika
- `orders-view-implementation-plan.md` - Plan implementacji widoku zleceń
- `rules/tech-stack.md` - Opis stacku technologicznego
- `rules/` - Reguły i konwencje dla kodowania, testów, komponentów UI
