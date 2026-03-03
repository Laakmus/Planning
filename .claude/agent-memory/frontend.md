# Frontend Agent — Pamięć

## Sesja 24 (2026-03-03) — ErrorBoundary

### Wykonane
- `src/components/ui/ErrorBoundary.tsx` — class-based, zero npm deps
  - Props: `children`, `fallback?: ReactNode`, `onError?: (error, info) => void`
  - Domyślny fallback: `role="alert"`, polskie komunikaty, dev-only stack trace, dark mode
  - Przyciski: "Spróbuj ponownie" (reset state) + "Odśwież stronę" (reload)
  - Używa `@/components/ui/button` (shadcn)
- Integracja 2-poziomowa:
  - `OrdersApp.tsx`: `<ErrorBoundary>` wewnątrz ThemeProvider, na zewnątrz AuthProvider
  - `OrdersPage.tsx`: `<ErrorBoundary fallback={...}>` wokół `<OrderDrawer>`

### Learningi
- React 19 nadal wymaga class-based ErrorBoundary (brak hooka)
- ErrorBoundary MUSI być wewnątrz ThemeProvider żeby dark mode fallbacku działał
- ErrorBoundary wokół AuthProvider łapie błędy z dowolnego providera/context
- Custom fallback (ReactNode prop) zastępuje domyślny ekran — używamy go dla drawera
- `import.meta.env.DEV` — Astro/Vite flag do warunkowego renderowania stack trace
