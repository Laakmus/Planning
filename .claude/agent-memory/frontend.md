# Frontend Agent — Pamięć

## Sesja 37 (2026-03-07) — setTimeout race condition fix

### Wykonane
- `src/hooks/useOrderDrawer.ts` — usunięcie `setTimeout(100ms)` w `handlePreviewSaveAndGo`
  - Nowy mechanizm: `pendingPreviewRef` (useRef) + useEffect reagujący na zmianę `detail`
  - Po save+loadDetail: flaga `pendingPreviewRef.current = true` → useEffect buduje formData z `detail` i otwiera podgląd
  - Wyekstrahowano `buildFormDataFromDetail()` — helper budujący OrderFormData z OrderDetailResponseDto (DRY)
  - `handlePreviewDiscardAndGo` teraz też używa `buildFormDataFromDetail()` zamiast ~45 linii duplikowanego kodu

### Learningi
- Gdy komponent-dziecko (OrderForm) aktualizuje ref async (useEffect), parent nie powinien polegać na timing hacku (setTimeout) — zamiast tego używaj ref-based flag + useEffect na state który jest źródłem danych
- Po save, dane w `detail` (po loadDetail) = to co user zapisał → można bezpiecznie budować formData z detail zamiast czekać na formDataRef z komponentu-dziecka
- `buildFormDataFromDetail()` jako helper eliminuje duplikację między save-and-go a discard-and-go

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
