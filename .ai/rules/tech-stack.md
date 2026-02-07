## STACK TECHNOLOGICZNY

### Opis projektu

System zleceń transportowych - wewnętrzna aplikacja webowa do planowania i wystawiania zleceń transportowych dla firmy zajmującej się hurtowym skupem złomu metali kolorowych i papieru.

### Frontend

- **Framework:** Astro 5.x
- **UI Components:** React
- **Język:** TypeScript
- **Style:** Tailwind CSS
- **Przeglądarka docelowa:** Chrome (laptopy)

### Backend / API

- **Runtime:** Node.js
- **Język:** TypeScript
- **Baza danych:** PostgreSQL
  - Środowisko testowe: Supabase
  - Środowisko produkcyjne: firmowa infrastruktura
- **Dane słownikowe:** integracja z firmowym ERP (przewoźnicy, nadawcy, odbiorcy, towary, lokalizacje)

### Deployment

- **CI/CD:** GitHub Actions
- **Hosting:** do ustalenia (np. hosting statyczny + backend)

### Środowiska

#### Testowe
- Baza: Supabase (PostgreSQL)
- Dane: przykładowe dane słownikowe
- Cel: testy i porównania z obecnym procesem w Excelu

#### Produkcyjne
- Baza: firmowa infrastruktura PostgreSQL
- Dane: integracja z ERP
- Start: pusta lista zleceń (po akceptacji MVP)

### Wymagania systemowe

- Node.js 24+
- npm
- Dostęp z sieci firmowej lub VPN
