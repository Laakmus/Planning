# Code Reviewer Agent — Pamięć

## Sesja 2026-03-26: Drawer→A4 mapper review

### Kontekst
Review 3 bugfixów w mechanizmie OrderDrawer → OrderView (A4 preview):
1. BUG 1: carrier lookup po nazwie → dodano `carrierCompanyId` + `productId` do `OrderViewData`
2. BUG 3: `pendingPreviewRef` nie resetowany przy błędzie → dodano useEffect + reset w doClose
3. BUG 4: duplikacja `buildInitialForm` vs `buildFormDataFromDetail` → zunifikowano w `src/lib/form-mappers.ts`

### Zmienione pliki
- `src/lib/form-mappers.ts` (NOWY) — wspólny mapper DTO→OrderFormData
- `src/components/orders/order-view/types.ts` — dodano carrierCompanyId, productId do typów i mapperów
- `src/components/orders/order-view/OrderDocument.tsx` — onSelect propaguje carrierCompanyId/productId
- `src/components/orders/order-view/constants.ts` — createEmptyItem z productId
- `src/components/orders/order-view/autocompletes.tsx` — ProductAutocomplete onSelect z id
- `src/hooks/useOrderDrawer.ts` — buildFormDataFromDetail używa mapDetailToFormData, pendingPreviewRef reset
- `src/components/orders/drawer/OrderForm.tsx` — buildInitialForm zastąpiony mapDetailToFormData
- `src/components/orders/order-view/__tests__/types.test.ts` — testy zaktualizowane pod nowy flow z ID

### Znalezione problemy
- HIGH: `currencyCode as CurrencyCode` cast bez guardu w form-mappers.ts (przeniesiony ze starego kodu)
- MEDIUM: `s.kind as "LOADING" | "UNLOADING"` cast bez guardu (pre-existing, przeniesiony)
- Pre-existing failing tests: warehouse/report (7 testów) — nie dotyczą tych zmian

### Learningi
- Reverse mappery (ViewData→FormData) powinny zawsze nosić ID-ki obok nazw wyświetlanych — lookup po nazwie jest fragile
- Bidirectional mappery (forward+reverse) wymagają propagacji ID na obu kierunkach + aktualizacji w callbackach UI (onSelect)
- `pendingPreviewRef` pattern (ref + useEffect) wymaga resetów we WSZYSTKICH ścieżkach wyjścia (doClose, error, cancel)
- Testy muszą symulować pełny flow UI (zmiana ID + nazwy razem), nie tylko zmianę nazwy
