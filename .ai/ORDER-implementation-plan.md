# Plan implementacji: OrderView (A4 podgląd z edycją inline)

## Kontekst

Użytkownik chce wdrożyć widok OrderView (podgląd A4 z edycją inline) z prototypu `test/order_test/` do głównego projektu. OrderView to alternatywny widok zlecenia transportowego — wygląda jak drukowany dokument A4, ale pola są edytowalne inline. Otwiera się z drawera przyciskiem "Podgląd" (zamiast "Generuj PDF"). Oba widoki (drawer i OrderView) zapisują niezależnie przez PUT API; sync następuje tylko po zapisie.

Dodatkowo: poprawka labeli pakowania w drawerze (CargoSection) + aktualizacja dokumentacji `.md`.

---

## Decyzje z sesji Q&A (kluczowe)

| # | Decyzja | Wybór |
|---|---------|-------|
| 1 | Model synchronizacji | Kopia formData z drawera → OrderView edytuje kopię → zapis = PUT → powrót do drawera |
| 2 | Kontener | Single Sheet, zamiana zawartości (drawer ↔ OrderView) bez animacji/migania |
| 3 | Szerokość Sheet w trybie OrderView | ~80% ekranu (`sm:max-w-[80vw]`) |
| 4 | Przycisk "Podgląd" | Zastępuje "Generuj PDF" w DrawerFooter. Widoczny tylko gdy `!isNewOrder && !isReadOnly` |
| 5 | Niezapisane zmiany w drawerze przed Podglądem | Dialog: Zapisz / Odrzuć / Anuluj |
| 6 | Po zapisie w OrderView | Zamknij OrderView → powrót do drawera (z odświeżonymi danymi) |
| 7 | Po anulowaniu w OrderView | Powrót do drawera ze stanem sprzed otwarcia OrderView |
| 8 | Lock zlecenia | Pozostaje aktywny przez cały czas (drawer + OrderView) |
| 9 | PUT scope | Pełny PUT — OrderView wysyła WSZYSTKIE pola (nawet ukryte: transportTypeCode, senderContact, itp.) |
| 10 | Autocomplete dane | Z drawera (DictionaryContext) — nie osobne fetche |
| 11 | Inline editory | Skopiowane z prototypu (EditableText, EditableNumber, itp.) |
| 12 | DnD stops | Osobna implementacja per widok (nie współdzielona z drawerem) |
| 13 | Skala A4 | Responsywna (dopasowanie do kontenera), NIE stała scale(1.3345) |
| 14 | Dark mode | A4 dokument zawsze biały, toolbar obsługuje dark mode |
| 15 | Format daty | YYYY-MM-DD (jak prototyp) |
| 16 | Format czasu | HH:MM (bez sekund) |
| 17 | Packaging labels (drawer fix) | Luzem / Bigbag / Paleta / Inne (4 pozycje) |
| 18 | Payment methods | Z drawera: Przelew, Gotówka, Karta |
| 19 | Vehicle types | Z API vehicle_variants (jak drawer) |
| 20 | Stop notes | Pominięte w OrderView |
| 21 | Stop address | Readonly w OrderView |
| 22 | NIP przewoźnika | Pusty tekst gdy brak |
| 23 | Carrier address | Resolve z lokalizacji firmy transportowej (LocationDto, bo CompanyDto nie ma pola address) |
| 24 | Osoba zlecająca | Z kontekstu Auth (zalogowany user) |
| 25 | Klauzula poufności | Pole w DB + API (`confidentiality_clause text` w `transport_orders`). Inicjalizacja: `DEFAULT_CONFIDENTIALITY_CLAUSE` z constants. Edytowalne inline w OrderView, zapisywane w PUT |
| 26 | Keyboard shortcuts | Ctrl+S (zapisz) + Escape (anuluj) |
| 27 | Save error | Toast + zostaw w OrderView |
| 28 | Print styles | Tak — @media print dla A4 |
| 29 | Nowy item → tony | null |
| 30 | Edycja item → tony | Reset do null |
| 31 | PDF | Przycisk w toolbarze OrderView |
| 32 | Email | Zostaje w drawerze (nie w OrderView). Przycisk "Wyślij maila" pozostaje w DrawerFooter obok "Podgląd" |
| 33 | Testy | Bez testów (na razie) |
| 34 | Readonly dla READ_ONLY | Ukryj OrderView (nie pokazuj przycisku Podgląd) |
| 35 | Struktura plików | `src/components/orders/order-view/` |
| 36 | State model | Callback w OrderDrawer (initialData + onSave + onCancel) |
| 37 | Logo | Base64 z constants (user podmieni później) |
| 38 | Notatki licznik | Bez licznika znaków |
| 39 | Add stop buttons | Pod listą (jak prototyp) |

---

## KRYTYCZNY PROBLEM ARCHITEKTONICZNY: Dostęp do formData

### Problem
`formData` (stan formularza) żyje **wewnątrz** `OrderForm.tsx` jako `useState`. `OrderDrawer.tsx` **nie ma bezpośredniego dostępu** do tego stanu. Jedyny punkt dostępu to `submitRef` — ref, który OrderForm rejestruje jako `() => onSave(formData, pendingStatus, complaintReason)`.

### Obecny flow (OrderForm.tsx linia 175-180):
```typescript
useEffect(() => {
  submitRef.current = () => {
    onSave(formData, pendingStatusCode, complaintReason);
  };
}, [formData, pendingStatusCode, complaintReason, onSave, submitRef]);
```

### Rozwiązanie: Dodać `formDataRef` do OrderForm
Dodać drugi ref (`formDataRef: React.RefObject<OrderFormData | null>`) obok istniejącego `submitRef`:

```typescript
// OrderForm.tsx — nowy prop
interface OrderFormProps {
  // ... istniejące props ...
  submitRef: React.RefObject<(() => void) | null>;
  formDataRef: React.RefObject<OrderFormData | null>;  // NOWY
}

// OrderForm.tsx — rejestracja w useEffect
useEffect(() => {
  formDataRef.current = formData;
}, [formData, formDataRef]);
```

W `OrderDrawer.tsx`:
```typescript
const formDataRef = useRef<OrderFormData | null>(null);
// ... przekazanie do OrderForm:
<OrderForm ... formDataRef={formDataRef} />

// Użycie w handleOpenOrderView:
function handleOpenOrderView() {
  const currentFormData = formDataRef.current;
  if (!currentFormData) return;
  // ... reszta logiki
}
```

**To jest jedyna zmiana architektoniczna w istniejących komponentach** — reszta to nowe pliki + modyfikacja props.

---

## Nowe pole DB: `confidentiality_clause`

### Wymagania
Klauzula poufności (`confidentialityClause`) ma być zapisywana per zlecenie w bazie danych. Edytowalna inline w OrderView.

### Zmiany wymagane

1. **Migracja DB** — nowa kolumna:
   ```sql
   ALTER TABLE public.transport_orders
     ADD COLUMN confidentiality_clause text DEFAULT NULL;
   ```

2. **Typy** — dodać pole:
   - `OrderDetailDto.confidentialityClause: string | null` (w `src/types.ts`)
   - `OrderFormData.confidentialityClause: string | null` (w `src/lib/view-models.ts`)

3. **API** — dodać pole do:
   - `GET /api/v1/orders/{id}` — zwracać w odpowiedzi
   - `PUT /api/v1/orders/{id}` — przyjmować w body (opcjonalne, Zod `.optional()`)
   - `POST /api/v1/orders` — przyjmować w body (opcjonalne)
   - Walidacja Zod: `z.string().max(2000).nullable().optional()`

4. **Drawer** — dodać do:
   - `buildInitialForm()` w `OrderForm.tsx`: `confidentialityClause: order.confidentialityClause`
   - `handleSave()` w `OrderDrawer.tsx`: wysyłać w PUT body
   - Pole NIE jest widoczne w drawerze (tylko w OrderView), ale musi być w formData żeby nie utracić przy PUT

5. **OrderView** — edytowalne inline:
   - `EditableTextarea` z wartością `data.confidentialityClause`
   - Inicjalizacja nowego zlecenia: `DEFAULT_CONFIDENTIALITY_CLAUSE` z constants

---

## Struktura plików

### Nowe pliki (`src/components/orders/order-view/`)

```
order-view/
├── types.ts              # OrderViewData, OrderViewItem, OrderViewStop, mappers
├── constants.ts          # COMPANY_NAME, DEFAULT_CLAUSE, LOGO_BASE64, limity
├── inline-editors.tsx    # EditableText, EditableNumber, EditableTextarea (94 linii z prototypu)
├── autocompletes.tsx     # 6 autocomplete komponentów (ProductAC, CompanyAC, LocationAC,
│                         # CarrierAC, DocumentsAC, VehicleTypeAC)
├── date-time-pickers.tsx # DatePickerPopover, TimePickerPopover
├── StopRows.tsx          # SortableStopWrapper, StopRow, DnD logic
├── OrderDocument.tsx     # Główny layout A4 (sekcje 1–14)
└── OrderView.tsx         # Kontener: toolbar + dirty detection + keyboard shortcuts
```

### Modyfikowane pliki

| Plik | Zmiana |
|------|--------|
| `src/components/orders/drawer/OrderDrawer.tsx` | Dodanie `formDataRef`, stanu `showOrderView`, handlery open/save/cancel, dynamiczna szerokość Sheet, dialog 3-opcyjny |
| `src/components/orders/drawer/OrderForm.tsx` | Dodanie prop `formDataRef` + useEffect rejestrujący formData |
| `src/components/orders/drawer/DrawerFooter.tsx` | Zamiana `onGeneratePdf` → `onShowPreview`, etykieta "Podgląd" z ikoną Eye. Przycisk "Wyślij maila" **pozostaje bez zmian** |
| `src/components/orders/drawer/CargoSection.tsx` | Fix labeli pakowania: 4 pozycje (Luzem, Bigbag, Paleta, Inne) |

### Zależności (package.json) — WSZYSTKIE JUŻ ZAINSTALOWANE
- `@dnd-kit/core` ^6.3.1 ✓
- `@dnd-kit/sortable` ^10.0.0 ✓
- `@dnd-kit/utilities` ^3.2.2 ✓
- `lucide-react` ✓
- shadcn/ui: `Calendar`, `Command`, `Popover`, `AlertDialog` — już w `src/components/ui/` ✓

---

## Mapowanie pól: OrderFormData ↔ OrderViewData

### Pola bezpośrednie

| OrderFormData | OrderViewData | Kierunek | Logika |
|---------------|---------------|----------|--------|
| — (z `detail.order.orderNo`) | `orderNo` | → readonly | Bezpośrednio |
| — (z `detail.order.createdAt`) | `createdAt` | → readonly | Bezpośrednio (pełny timestamp ISO z API, wyświetlany jako DD.MM.YYYY — tylko data, bez godziny) |
| `carrierCompanyId` | `carrierName` | ↔ | Forward: `companies.find(c => c.id === carrierCompanyId)?.name ?? ""`. Reverse: `companies.find(c => c.name === carrierName)?.id ?? null` |
| — | `carrierAddress` | → readonly | Patrz sekcja "Carrier address resolution" |
| — | `carrierNip` | → readonly | `companies.find(c => c.id === carrierCompanyId)?.taxId ?? ""` |
| `vehicleTypeText` | `vehicleType` | ↔ | Bezpośrednio |
| `vehicleCapacityVolumeM3` | `vehicleVolumeM3` | ↔ | Bezpośrednio |
| `priceAmount` | `priceAmount` | ↔ | Bezpośrednio |
| `currencyCode` | `currencyCode` | ↔ | Bezpośrednio |
| `paymentTermDays` | `paymentTermDays` | ↔ | Bezpośrednio |
| `paymentMethod` | `paymentMethod` | ↔ | Bezpośrednio |
| `requiredDocumentsText` | `documentsText` | ↔ | Bezpośrednio |
| `generalNotes` | `generalNotes` | ↔ | Bezpośrednio |
| — (z `useAuth().user`) | `personName/Email/Phone` | → readonly | `user.name`, `user.email`, brak phone w auth → pusty string |
| `confidentialityClause` | `confidentialityClause` | ↔ | Z API (pole DB `confidentiality_clause`). Nowe zlecenia: `DEFAULT_CONFIDENTIALITY_CLAUSE` z constants. Edytowalna inline |

### Carrier address resolution

**Problem**: `CompanyDto` NIE ma pola `address`. Adres jest w `LocationDto` (powiązane z firmą przez `companyId`).

**Rozwiązanie**: Szukaj pierwszej lokalizacji firmy transportowej:
```typescript
function resolveCarrierAddress(carrierCompanyId: string | null, locations: LocationDto[]): string {
  if (!carrierCompanyId) return "";
  const loc = locations.find(l => l.companyId === carrierCompanyId && l.isActive);
  if (!loc) return "";
  return `${loc.streetAndNumber}, ${loc.postalCode} ${loc.city}`;
}
```

Alternatywnie: użyj `detail.order.carrierAddressSnapshot` (ale z MEMORY wiemy, że jest zawsze null). Dlatego resolve z locations jest jedynym źródłem.

### Items mapping — SZCZEGÓŁOWO

**Forward (formDataToViewData)** — UWAGA: konwersja `null` → `""` dla pól string:
```typescript
function mapItemForward(item: OrderFormItem): OrderViewItem {
  return {
    id: item.id ?? generateId(),
    name: item.productNameSnapshot ?? "",       // null → ""
    notes: item.notes ?? "",                     // null → ""
    packagingType: mapLoadingMethodToPackaging(item.loadingMethodCode),
  };
}
```

**Mapowanie packaging (bidirectional):**
```typescript
const LOADING_TO_PACKAGING: Record<string, PackagingType> = {
  LUZEM: "LUZEM",
  PALETA_BIGBAG: "BIGBAG",
  PALETA: "PALETA",
  KOSZE: "INNA",
};
const PACKAGING_TO_LOADING: Record<PackagingType, string> = {
  LUZEM: "LUZEM",
  BIGBAG: "PALETA_BIGBAG",
  PALETA: "PALETA",
  INNA: "KOSZE",
};
```

**Reverse (viewDataToFormData) — ITEMS:**
```typescript
function mapItemReverse(
  viewItem: OrderViewItem,
  originalItems: OrderFormItem[],
  products: ProductDto[]
): OrderFormItem {
  // Znajdź oryginalny item po id (jeśli istniał)
  const original = originalItems.find(i => i.id === viewItem.id);

  // Znajdź produkt po nazwie
  const product = products.find(p => p.name === viewItem.name);

  // Czy produkt się zmienił? → reset quantityTons do null
  const productChanged = original && product && original.productId !== product?.id;

  return {
    id: original?.id ?? null, // null = nowy item
    productId: product?.id ?? null,
    productNameSnapshot: viewItem.name || null,
    defaultLoadingMethodSnapshot: product?.defaultLoadingMethodCode ?? null,
    loadingMethodCode: PACKAGING_TO_LOADING[viewItem.packagingType ?? "LUZEM"] ?? null,
    quantityTons: productChanged ? null : (original?.quantityTons ?? null),
    notes: viewItem.notes || null,
    _deleted: false,
  };
}
```

**Kluczowe**: Nowe items (których nie ma w `originalItems`) dostają `id: null`, `quantityTons: null`.

### Stops mapping — SZCZEGÓŁOWO

**Forward (formDataToViewData):**
```typescript
function mapStopForward(stop: OrderFormStop, locations: LocationDto[]): OrderViewStop {
  const loc = stop.locationId ? locations.find(l => l.id === stop.locationId) : null;
  return {
    id: stop.id ?? crypto.randomUUID(),
    kind: stop.kind,
    sequenceNo: stop.sequenceNo,
    date: stop.dateLocal,        // YYYY-MM-DD
    time: stop.timeLocal,        // HH:MM
    companyId: loc?.companyId ?? null,
    companyName: stop.companyNameSnapshot ?? loc?.companyName ?? null,
    locationId: stop.locationId,
    locationName: stop.locationNameSnapshot ?? loc?.name ?? null,
    address: stop.addressSnapshot ?? (loc ? `${loc.streetAndNumber}, ${loc.postalCode} ${loc.city}` : null),
    country: loc?.country ?? "",
    place: buildPlaceFallback(stop, loc), // legacy fallback
  };
}
```

**Reverse (viewDataToFormData) — STOPS:**
```typescript
function mapStopReverse(
  viewStop: OrderViewStop,
  originalStops: OrderFormStop[],
  locations: LocationDto[]
): OrderFormStop {
  const original = originalStops.find(s => s.id === viewStop.id);
  const loc = viewStop.locationId ? locations.find(l => l.id === viewStop.locationId) : null;

  return {
    id: original?.id ?? null,
    kind: viewStop.kind,
    sequenceNo: viewStop.sequenceNo,
    dateLocal: viewStop.date,
    timeLocal: viewStop.time,
    locationId: viewStop.locationId,
    locationNameSnapshot: loc?.name ?? viewStop.locationName,
    companyNameSnapshot: loc?.companyName ?? viewStop.companyName,
    addressSnapshot: loc ? `${loc.streetAndNumber}, ${loc.postalCode} ${loc.city}` : viewStop.address,
    notes: original?.notes ?? null, // zachowaj oryginalne notes (pominięte w OrderView)
    _deleted: false,
  };
}
```

### viewDataToFormData — pełny mapper (MERGE z oryginalnym formData)

```typescript
function viewDataToFormData(
  viewData: OrderViewData,
  originalFormData: OrderFormData,
  locations: LocationDto[],
  companies: CompanyDto[],
  products: ProductDto[]
): OrderFormData {
  const carrier = companies.find(c => c.name === viewData.carrierName);

  return {
    // Pola zachowane z oryginału (ukryte w OrderView)
    transportTypeCode: originalFormData.transportTypeCode,
    totalLoadTons: originalFormData.totalLoadTons,
    totalLoadVolumeM3: originalFormData.totalLoadVolumeM3,
    shipperLocationId: originalFormData.shipperLocationId,
    receiverLocationId: originalFormData.receiverLocationId,
    specialRequirements: originalFormData.specialRequirements,
    complaintReason: originalFormData.complaintReason,
    senderContactName: originalFormData.senderContactName,
    senderContactPhone: originalFormData.senderContactPhone,
    senderContactEmail: originalFormData.senderContactEmail,

    // Pola edytowane w OrderView (konwersja "" → null dla API)
    carrierCompanyId: carrier?.id ?? originalFormData.carrierCompanyId,
    vehicleTypeText: viewData.vehicleType || null,
    vehicleCapacityVolumeM3: viewData.vehicleVolumeM3,
    priceAmount: viewData.priceAmount,
    currencyCode: viewData.currencyCode as CurrencyCode,
    paymentTermDays: viewData.paymentTermDays,
    paymentMethod: viewData.paymentMethod || null,
    requiredDocumentsText: viewData.documentsText || null,
    generalNotes: viewData.generalNotes || null,
    confidentialityClause: viewData.confidentialityClause || null,

    // Items
    items: buildMergedItems(viewData.items, originalFormData.items, products),

    // Stops
    stops: buildMergedStops(viewData.stops, originalFormData.stops, locations),
  };
}
```

**`buildMergedItems`** musi obsłużyć:
1. Items istniejące w oryginale i w viewData → merge (zachowaj quantityTons jeśli produkt nie zmieniony)
2. Items nowe w viewData (brak w oryginale) → `id: null`, `quantityTons: null`
3. Items usunięte w viewData (były w oryginale) → dodaj z `_deleted: true`

**`buildMergedStops`** musi obsłużyć:
1. Stops istniejące → merge (zachowaj notes z oryginału)
2. Stops nowe → `id: null`
3. Stops usunięte → dodaj z `_deleted: true`

---

## Interfejsy komponentów (z prototypu — DO SKOPIOWANIA)

### OrderDocument (prototyp: linia 62-66)
```typescript
interface OrderDocumentProps {
  data: OrderViewData;
  onChange: (data: OrderViewData) => void;
  isReadOnly: boolean;
}
```

### OrderView (prototyp: linia 11-16 + ROZSZERZENIE)
```typescript
interface OrderViewProps {
  initialData: OrderViewData;
  isReadOnly?: boolean;
  onSave?: (data: OrderViewData) => void;
  onCancel?: () => void;
  onGeneratePdf?: () => void; // DODANE — brak w prototypie
}
```

### Inline Editors (prototyp: linie 72-167)

**EditableText** (24 linie):
```typescript
interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  [key: string]: any; // passthrough
}
```
Render: klik → `<input type="text">`, blur → zatwierdź, `disabled` → renderuj `<span>`.

**EditableNumber** (41 linii):
```typescript
interface EditableNumberProps {
  value: number | null;
  onChange: (value: number | null) => void;
  className?: string;
  disabled?: boolean;
  suffix?: string; // np. "m³", "dni"
  [key: string]: any;
}
```
Parse: `/[^0-9.,]/g`, konwersja: `parseFloat(raw.replace(",", "."))`.

**EditableTextarea** (29 linii):
```typescript
interface EditableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  [key: string]: any;
}
```
Render: klik → `<textarea>` z auto-resize, `disabled` → `<span style={{ whiteSpace: "pre-wrap" }}>`.

### Autocompletes — interfejsy (prototyp)

Wszystkie używają shadcn `Command` + `Popover` (już dostępne w `src/components/ui/`).

| Autocomplete | Props | Dane źródłowe |
|-------------|-------|----------------|
| `ProductAutocomplete` | `value: string, onSelect: (product: ProductDto) => void, disabled: boolean` | `DictionaryContext.products` |
| `CompanyAutocomplete` | `value: string \| null, displayName: string, onSelect: (company: CompanyDto) => void, onClear: () => void, disabled: boolean` | `DictionaryContext.companies` (filtr: `isActive`) |
| `CarrierAutocomplete` | `carrierName: string, carrierAddress: string, onSelect: (company: CompanyDto) => void, onClear: () => void` | `DictionaryContext.companies` (filtr: `isActive`, search po name+taxId) |
| `DocumentsAutocomplete` | `value: string, onSelect: (text: string) => void` | `DOCUMENTS_OPTIONS` (stała z constants.ts) |
| `VehicleTypeAutocomplete` | `value: string, onSelect: (type: string) => void, onClear: () => void` | `DictionaryContext.vehicleVariants` → `[...new Set(vv.map(v => v.vehicleType))]` |
| `LocationAutocomplete` | `value: string \| null, displayName: string, companyId: string \| null, onSelect: (location: LocationDto) => void, onClear: () => void, disabled: boolean` | `DictionaryContext.locations` (filtr: `isActive && companyId`) |

**Carrier auto-fill** (po wybraniu firmy w CarrierAutocomplete):
```typescript
onSelect={(company) => {
  const loc = locations.find(l => l.companyId === company.id && l.isActive);
  updateData({
    carrierName: company.name,
    carrierAddress: loc ? `${loc.streetAndNumber}, ${loc.postalCode} ${loc.city}` : "",
    carrierNip: company.taxId ?? "",
  });
}}
```

### DatePickerPopover (prototyp: linie 268-331)
```typescript
interface DatePickerPopoverProps {
  value: string | null;     // YYYY-MM-DD
  onChange: (value: string | null) => void;
  disabled?: boolean;
}
```
Render: button z `CalendarIcon`, klik → `Popover` z shadcn `Calendar` (`mode="single"`). Output: `YYYY-MM-DD`.

### TimePickerPopover (prototyp: linie 182-262)
```typescript
interface TimePickerPopoverProps {
  value: string | null;     // HH:MM
  onChange: (value: string | null) => void;
  disabled?: boolean;
}
```
TIME_SLOTS: `[0..23]h × [0, 30]m` = 48 slotów. Render: `Popover` ze scrollowalną listą. Auto-scroll do aktualnej wartości via `requestAnimationFrame`.

---

## Skalowanie A4 — RESPONSYWNE

### Problem
Prototyp używa `zoom: 1.3345` (stała). Użytkownik chce responsywną skalę.

### Rozwiązanie: CSS `zoom` obliczany z szerokości kontenera

```typescript
// W OrderView.tsx lub OrderDocument.tsx
const containerRef = useRef<HTMLDivElement>(null);
const [zoomFactor, setZoomFactor] = useState(1);

useEffect(() => {
  if (!containerRef.current) return;
  const observer = new ResizeObserver((entries) => {
    const width = entries[0].contentRect.width;
    // A4 base = 595px, padding = 2*16px
    const available = width - 32;
    const factor = Math.min(available / 595, 2); // max 2x zoom
    setZoomFactor(factor);
  });
  observer.observe(containerRef.current);
  return () => observer.disconnect();
}, []);
```

A4 page:
```tsx
<div
  className="w-[595px] min-h-[842px] bg-white shadow-lg"
  style={{
    zoom: zoomFactor,
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#000",
    padding: "32px 34px",
  }}
>
```

---

## DnD Stops — SZCZEGÓŁY IMPLEMENTACJI

### Pakiety (JUŻ ZAINSTALOWANE)
```typescript
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

### Constraints (z prototypu linie 1360-1379):
```typescript
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const oldIdx = data.stops.findIndex(s => s.id === active.id);
  const newIdx = data.stops.findIndex(s => s.id === over.id);
  const reordered = arrayMove(data.stops, oldIdx, newIdx);

  // Enforce: first position MUST be LOADING
  if (reordered.length > 0 && reordered[0].kind !== "LOADING") return;

  // Enforce: last position MUST be UNLOADING
  if (reordered.length > 0 && reordered[reordered.length - 1].kind !== "UNLOADING") return;

  // Renumber sequenceNo GLOBALLY (jak w drawerze i prototypie)
  // sequenceNo = pozycja w tablicy (1-based), etykiety L1/U1 obliczane dynamicznie w renderze
  const renumbered = reordered.map((s, i) => ({ ...s, sequenceNo: i + 1 }));

  onChange({ ...data, stops: renumbered });
}
```

### SortableStopWrapper (prototyp linie 961-1005):
- `useSortable()` z id stopu
- Drag handle: `GripVertical` ikona (lucide)
- Disabled w trybie readonly
- `CSS.Transform.toString(transform)` dla animacji drag

---

## Print Styles (z prototypu linie 1417-1436)

Umieścić w `OrderDocument.tsx` jako `<style>` tag lub w osobnym CSS:

```css
@media print {
  /* Ukryj ikony edycji (dropdown arrows, calendar, drag handles) */
  .order-a4-page svg.lucide { display: none !important; }

  /* Ukryj drag handle */
  .order-a4-page [aria-label="Przeciągnij"] { display: none !important; }

  /* Ukryj przyciski usuwania */
  .order-a4-page button[title="Usuń stop"],
  .order-a4-page button[title="Usuń pozycję"] { display: none !important; }

  /* Ukryj elementy z data-no-print */
  [data-no-print] { display: none !important; }

  /* Wyłącz hover/cursor */
  .order-a4-page button { cursor: default !important; }

  /* Usuń shadow */
  .order-a4-page { box-shadow: none !important; }
}
```

Toolbar OrderView (`print:hidden`) — ukryty przy druku.

### Scoped Styles — wymuszenie czarnego tekstu na A4

Z prototypu (linie 1410-1416) — konieczne dla poprawnego wyświetlania w dark mode. Umieścić w OrderDocument.tsx jako `<style>` tag LUB inline style na głównym divie A4:

```css
/* Scoped — wymuszenie czarnego tekstu wewnątrz A4 */
.order-a4-page,
.order-a4-page * {
  color: #000 !important;
}
.order-a4-page input,
.order-a4-page textarea {
  color: #000 !important;
  background: transparent !important;
}
```

Alternatywnie: `style={{ color: "#000", fontFamily: "Arial, Helvetica, sans-serif" }}` na głównym divie A4 (jak w prototypie).

### TIME_SLOTS — zależność TimePickerPopover

TimePickerPopover potrzebuje tablicy time slotów. Dodać do `constants.ts`:

```typescript
/** Sloty czasu dla TimePickerPopover: co 30 minut od 00:00 do 23:30 (48 slotów) */
export const TIME_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});
```

### Layout constants — z prototypu (linie 1246-1249)

Stałe szerokości kolumn tabeli w OrderDocument. Dodać do `constants.ts` lub na górze `OrderDocument.tsx`:

```typescript
export const CELL = "border border-black/30 px-1.5 py-0.5 text-[10px] align-top";
export const LABEL_98 = "w-[98px] font-semibold bg-gray-50 whitespace-nowrap";
export const ROW_526 = "w-[526px]";
export const ROW_449 = "w-[449px]";
```

### Helper functions — brakujące w planie

Z prototypu — potrzebne w StopRows.tsx i OrderDocument.tsx:

```typescript
/** Generuje UUID (używa crypto.randomUUID lub fallback) */
function generateId(): string {
  return crypto.randomUUID();
}

/** Tworzy pusty stop (LOADING lub UNLOADING) */
function createEmptyStop(kind: StopKind, sequenceNo: number): OrderViewStop {
  return {
    id: generateId(),
    kind,
    sequenceNo,
    date: null,
    time: null,
    companyId: null,
    companyName: null,
    locationId: null,
    locationName: null,
    address: null,
    country: "",
    place: "",
  };
}

/** Tworzy pusty item */
function createEmptyItem(): OrderViewItem {
  return {
    id: generateId(),
    name: "",
    notes: "",
    packagingType: "LUZEM",
  };
}
```

### Konwersja null → "" w forward mapperach

**WAŻNE**: `OrderViewData` ma wiele pól jako `string` (nie `string | null`), ale `OrderFormData` przechowuje je jako `string | null`. Forward mapper (`formDataToViewData`) MUSI konwertować `null` → `""`:

```typescript
// Przykład — POPRAWNA konwersja:
carrierName: companies.find(c => c.id === formData.carrierCompanyId)?.name ?? "",
vehicleType: formData.vehicleTypeText ?? "",
documentsText: formData.requiredDocumentsText ?? "",
generalNotes: formData.generalNotes ?? "",
paymentMethod: formData.paymentMethod ?? "",
confidentialityClause: formData.confidentialityClause ?? DEFAULT_CONFIDENTIALITY_CLAUSE,
```

Reverse mapper (`viewDataToFormData`) konwertuje `""` → `null` tam gdzie API oczekuje `null`:
```typescript
vehicleTypeText: viewData.vehicleType || null,
requiredDocumentsText: viewData.documentsText || null,
generalNotes: viewData.generalNotes || null,
confidentialityClause: viewData.confidentialityClause || null,
```

---

## Pole `place` w OrderViewStop

**Co to jest**: Fallback display text, używany gdy `companyName + locationName` są puste.

**Użycie w OrderDocument (prototyp linia 1050)**:
```typescript
const placeDisplay =
  stop.companyName && stop.locationName
    ? `${stop.companyName} — ${stop.locationName}`
    : stop.companyName ? stop.companyName : stop.place;
```

**Inicjalizacja w mapperze**:
```typescript
place: stop.companyNameSnapshot
  ? `${stop.companyNameSnapshot} ${stop.locationNameSnapshot ?? ""} ${stop.addressSnapshot ?? ""}`
  : ""
```

---

## Multi-page logic

Prototyp to **pojedynczy div** (nie dzieli na fizyczne strony). Strony obsługiwane przez:
1. `min-h-[842px]` — minimalna wysokość A4
2. Treść rośnie dynamicznie (więcej itemów/stopów → większy div)
3. Przy druku `@media print` — przeglądarka automatycznie dzieli na strony A4

**Padding itemów**:
```typescript
const extraSlotForAddButton = data.items.length < MAX_VISIBLE_ITEMS ? 1 : 0;
const totalVisualSlots = Math.max(MIN_VISIBLE_ITEMS, data.items.length + extraSlotForAddButton);
const paddedItems = [...data.items, ...Array(totalVisualSlots - data.items.length).fill(null)];
```
Puste sloty renderują się jako puste wiersze tabeli (wizualnie wypełniają stronę A4).

---

## UnsavedChangesDialog — ROZSZERZENIE

### Obecny dialog (`src/components/orders/drawer/UnsavedChangesDialog.tsx`):
```typescript
interface UnsavedChangesDialogProps {
  open: boolean;
  onConfirm: () => void;  // "Zamknij bez zapisywania"
  onCancel: () => void;   // "Wróć do edycji"
}
```
2 przyciski: Cancel + Action (destructive).

### Potrzebny dialog "przed podglądem" — 3 opcje:

**NOWY komponent** `PreviewUnsavedDialog` (w `order-view/` lub w `drawer/`):
```typescript
interface PreviewUnsavedDialogProps {
  open: boolean;
  isSaving: boolean;
  onSave: () => void;      // "Zapisz i przejdź do podglądu"
  onDiscard: () => void;   // "Odrzuć zmiany i przejdź"
  onCancel: () => void;    // "Anuluj"
}
```

Render: AlertDialog z 3 przyciskami w footer:
- `AlertDialogCancel` → "Anuluj"
- `<button variant="outline">` → "Odrzuć zmiany"
- `AlertDialogAction` → "Zapisz" (primary)

---

## Przepływy (Flow)

### Flow 1: Otwórz Podgląd (drawer → OrderView)

```
User klika "Podgląd" w DrawerFooter
  → OrderDrawer.handleOpenOrderView()
  → Odczytaj formData z formDataRef.current
  → Sprawdź isDirty w drawerze
  → Jeśli dirty → Pokaż PreviewUnsavedDialog z 3 opcjami:
    → "Zapisz":
        saveToApi(formData) → po sukcesie → re-fetch detail → openOrderView()
    → "Odrzuć zmiany":
        (nie zapisuj, użyj ORIGINAL formData z detali) → openOrderView()
    → "Anuluj":
        zamknij dialog, nic się nie dzieje
  → Jeśli clean → openOrderView()

  openOrderView():
    → preOrderViewFormData = structuredClone(formData) // snapshot
    → orderViewInitialData = formDataToViewData(formData, detail, companies, locations, user)
    → setShowOrderView(true) // zmienia content Sheet
```

### Flow 2: Zapisz w OrderView

```
User klika "Zapisz" w toolbarze (lub Ctrl+S)
  → OrderView wywołuje onSave(currentViewData)
  → OrderDrawer.handleOrderViewSave(viewData):
    → mergedFormData = viewDataToFormData(viewData, originalFormData, locations, companies, products)
    → PUT /api/v1/orders/{id} (payload z mergedFormData — identyczny format jak w obecnym handleSave)
    → BEZ zmiany statusu (pendingStatus = null) — status zmienia się tylko w drawerze
    → Sukces:
      → Toast "Zlecenie zapisane."
      → Re-fetch detali (loadDetail) — odświeży dane drawera
      → setShowOrderView(false) → powrót do drawera
      → onOrderUpdated() → odśwież listę
    → Błąd:
      → Toast error → zostaw w OrderView (user może poprawić i spróbować ponownie)
```

### Flow 3: Anuluj w OrderView

```
User klika "Anuluj" (lub Escape)
  → OrderView sprawdza isDirty (JSON.stringify porównanie)
  → Jeśli dirty → Dialog (shadcn AlertDialog): "Masz niezapisane zmiany. Odrzucić?"
    → "Kontynuuj edycję" → zamknij dialog
    → "Odrzuć zmiany" → OrderView wywołuje onCancel()
  → Jeśli clean → OrderView wywołuje onCancel()

  OrderDrawer.handleOrderViewCancel():
    → setShowOrderView(false) → powrót do drawera
    → Drawer wraca ze stanem sprzed otwarcia (formData nie został zmieniony w drawerze)
    → Szerokość Sheet wraca do 800px
```

### Flow 4: PDF z OrderView

```
User klika "Generuj PDF" w toolbarze OrderView
  → OrderView wywołuje onGeneratePdf()
  → OrderDrawer.handlePdfFromOrderView():
    → api.postRaw(`/api/v1/orders/${orderId}/pdf`, {})
    → Blob download (identycznie jak obecny handleGeneratePdf w OrderDrawer)
```

---

## Fazy implementacji — SZCZEGÓŁOWE INSTRUKCJE

### Faza 0: Typy, stałe, mappers, migracja DB
**Pliki:** `src/components/orders/order-view/types.ts`, `src/components/orders/order-view/constants.ts`, `supabase/migrations/`, `src/types.ts`, `src/lib/view-models.ts`
**Agent:** Types + Database

0. **Migracja DB** (`supabase/migrations/YYYYMMDD_add_confidentiality_clause.sql`):
   ```sql
   ALTER TABLE public.transport_orders
     ADD COLUMN confidentiality_clause text DEFAULT NULL;
   ```
   + Dodać `confidentialityClause` do:
   - `OrderDetailDto` w `src/types.ts` (`confidentialityClause: string | null`)
   - `OrderFormData` w `src/lib/view-models.ts` (`confidentialityClause: string | null`)
   - Zod schemas w `create.ts` i `[orderId]/index.ts` (PUT) — `z.string().max(2000).nullable().optional()`
   - SELECT w `order.service.ts` (getOrderById, getOrders)
   - `buildInitialForm()` w `OrderForm.tsx`

1. **`types.ts`** (order-view):
   - Skopiować z `test/order_test/types.ts`: interfejsy `OrderViewData`, `OrderViewItem`, `OrderViewStop`, `OrderViewProps`, typy `PackagingType`, `CurrencyCode`, `StopKind`
   - Usunąć interfejsy testowe: `TestProduct`, `TestCompany`, `TestLocation` (nie potrzebne — używamy `CompanyDto`, `LocationDto`, `ProductDto` z `@/types`)
   - Rozszerzyć `OrderViewProps` o `onGeneratePdf?: () => void`
   - Dodać eksportowane funkcje mapperów: `formDataToViewData()`, `viewDataToFormData()`, `mapLoadingMethodToPackaging()`, `mapPackagingToLoadingMethod()`
   - Dodać pomocnicze: `resolveCarrierAddress()`, `buildPlaceFallback()`
   - **Forward mapper**: konwersja `null` → `""` dla pól non-nullable w OrderViewData
   - **Reverse mapper**: konwersja `""` → `null` dla pól nullable w OrderFormData
   - **Pełna logika mapperów opisana wyżej w sekcji "Mapowanie pól"**

2. **`constants.ts`**:
   - Skopiować z `test/order_test/constants.ts`
   - Zmienić `PAYMENT_METHODS` → `["Przelew", "Gotówka", "Karta"] as const`
   - USUNĄĆ `VEHICLE_TYPE_OPTIONS` (pobieramy z API)
   - **DODAĆ**: `TIME_SLOTS` (48 slotów co 30 min, potrzebne dla TimePickerPopover)
   - **DODAĆ**: Layout constants: `CELL`, `LABEL_98`, `ROW_526`, `ROW_449` (szerokości kolumn tabeli A4)
   - **DODAĆ**: Helper functions: `generateId()`, `createEmptyStop()`, `createEmptyItem()`
   - Bez zmian: `COMPANY_NAME`, `CONDITIONS_HEADER`, `DEFAULT_CONFIDENTIALITY_CLAUSE`, `DOCUMENTS_OPTIONS`, `LOGO_BASE64`, `MIN_VISIBLE_ITEMS=8`, `MAX_VISIBLE_ITEMS=15`, `MAX_LOADING_STOPS=8`, `MAX_UNLOADING_STOPS=3`

### Faza 1: Inline editors + autocompletes + date/time pickers
**Pliki:** 3 nowe pliki w `order-view/`
**Agent:** Frontend

1. **`inline-editors.tsx`** (94 linie):
   - Skopiować z `test/order_test/OrderDocument.tsx` linie 72-167
   - Eksportować: `EditableText`, `EditableNumber`, `EditableTextarea`
   - Bez zmian w logice (identyczne jak prototyp)

2. **`autocompletes.tsx`** (~400 linii):
   - Skopiować z prototypu linie 337-955 (6 autocomplete funkcji)
   - **Zmienić import danych**: zamiast `TEST_PRODUCTS/TEST_COMPANIES/TEST_LOCATIONS` → przyjmować dane jako props
   - Każdy autocomplete dostaje dane przez props (nie z kontekstu — kontekst używany w OrderDocument):
     ```typescript
     function ProductAutocomplete({ value, onSelect, disabled, products }: {
       value: string;
       onSelect: (product: ProductDto) => void;
       disabled: boolean;
       products: ProductDto[];
     })
     ```
   - `VehicleTypeAutocomplete` — dane z props `vehicleTypes: string[]` (unikalne typy z vehicleVariants)
   - Carrier auto-fill: po wybraniu firmy → resolve address z locations, resolve NIP z company

3. **`date-time-pickers.tsx`** (~160 linii):
   - Skopiować z prototypu `TimePickerPopover` (linie 182-262) i `DatePickerPopover` (linie 268-331)
   - Używają shadcn `Calendar` (`@/components/ui/calendar`) i `Popover` (`@/components/ui/popover`) — oba JUŻ istnieją

### Faza 2: StopRows + OrderDocument
**Pliki:** 2 nowe pliki w `order-view/`
**Agent:** Frontend

1. **`StopRows.tsx`** (~200 linii):
   - Skopiować z prototypu: `SortableStopWrapper` (linie 961-1005) + `StopRow` logic
   - DnD: `DndContext` + `SortableContext` z `@dnd-kit`
   - Constraints: first=LOADING, last=UNLOADING
   - Renumbering po każdym drag
   - Props: `stops, onStopsChange, isReadOnly, locations, companies` (dane z DictionaryContext)
   - Przyciski "Dodaj załadunek"/"Dodaj rozładunek" z atrybutem `data-no-print`

2. **`OrderDocument.tsx`** (~1500-2000 linii):
   - Skopiować layout z prototypu (linie 1438-2240)
   - **Props**: `{ data, onChange, isReadOnly }` (jak prototyp)
   - **Usunąć**: import `TEST_PRODUCTS/TEST_COMPANIES/TEST_LOCATIONS`
   - **Dodać**: prop `dictionaries: { companies, locations, products, vehicleVariants }` LUB `useDictionaries()` z kontekstu
   - **Zalecenie**: użyć `useDictionaries()` bezpośrednio w OrderDocument (prostsze, dane i tak w pamięci)
   - Wszystkie sekcje jak opisane w prototypie
   - CSS klasa `order-a4-page` na głównym divie A4 (potrzebna dla print styles)
   - Responsywne skalowanie: `ResizeObserver` → dynamiczny `zoom`
   - **Print styles**: `<style>` tag z regułami `@media print` (opisanymi wyżej)
   - Zawsze białe tło: `bg-white` (bez `dark:`)

### Faza 3: OrderView container
**Plik:** `order-view/OrderView.tsx`
**Agent:** Frontend

Skopiować z `test/order_test/OrderView.tsx` (192 linie), dostosować:

**Toolbar layout** (z prototypu linie 92-126):
- Lewo: tytuł "Podgląd zlecenia {orderNo}" + badge "Niezapisane zmiany" (amber, gdy isDirty)
- Prawo: "Generuj PDF" (outline) + "Anuluj" (secondary) + "Zapisz zmiany" (primary, disabled gdy !isDirty)
- Klasa: `print:hidden`

**State**:
```typescript
const [data, setData] = useState<OrderViewData>(initialData);
const originalDataRef = useRef<OrderViewData>(initialData);
const isDirty = JSON.stringify(data) !== JSON.stringify(originalDataRef.current);
```

**Keyboard shortcuts** (prototyp linie 66-85):
- `Ctrl+S` / `Cmd+S` → `onSave?.(data)` (jeśli isDirty && !isReadOnly)
- `Escape` → sprawdź dirty → dialog lub `onCancel?.()`

**Confirmation dialog**: shadcn `AlertDialog` z 2 przyciskami ("Kontynuuj edycję" / "Odrzuć zmiany")

**Dark mode**: toolbar z `dark:` klasami, ale `<OrderDocument>` renderuje się z białym tłem (zawsze)

**Render**:
```tsx
<div className="flex flex-col h-full">
  <toolbar className="print:hidden ...">...</toolbar>
  <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-4 print:p-0 print:bg-white">
    <OrderDocument data={data} onChange={setData} isReadOnly={isReadOnly} />
  </div>
  {showConfirmDialog && <AlertDialog>...</AlertDialog>}
</div>
```

### Faza 4: Integracja z OrderDrawer
**Pliki:** `OrderDrawer.tsx`, `OrderForm.tsx`, `DrawerFooter.tsx`, nowy `PreviewUnsavedDialog.tsx`
**Agent:** Frontend

1. **`OrderForm.tsx`** — minimalna zmiana:
   - Dodać prop `formDataRef: React.RefObject<OrderFormData | null>`
   - Dodać useEffect: `formDataRef.current = formData`
   - ~5 linii zmian

2. **`OrderDrawer.tsx`** — główne zmiany:
   - Import `OrderView` z `../order-view/OrderView`
   - Import `formDataToViewData`, `viewDataToFormData` z `../order-view/types`
   - Nowe stany: `showOrderView`, `showPreviewUnsavedDialog`
   - Nowy ref: `formDataRef`
   - Refactor `handleSave`: wydzielić `saveToApi(formData: OrderFormData): Promise<boolean>` (reusable bez zamykania drawera)
   - Nowe handlery: `handleOpenOrderView`, `handleOrderViewSave`, `handleOrderViewCancel`, `handlePdfFromOrderView`
   - `saveToApi` re-uses PUT logic z obecnego handleSave, ale:
     - Nie wywołuje `doClose()` (nie zamyka drawera)
     - Nie zmienia statusu (`pendingStatus = null`)
     - Zwraca `true/false` dla sukcesu/błędu
   - Sheet: dynamiczna klasa `sm:max-w-[80vw]` vs `sm:max-w-[800px]` z `cn()`
   - Warunkowy render: `showOrderView ? <OrderView .../> : <drawer content/>`
   - **OrderView props**: `initialData` tworzony w momencie otwarcia, NIE reactywnie

3. **`DrawerFooter.tsx`**:
   - Zmiana prop: `onGeneratePdf` → `onShowPreview`
   - Etykieta: "Podgląd" (zamiast "Generuj PDF")
   - Ikona: `Eye` (zamiast `FileText`). Import z lucide-react
   - `onSendEmail` **pozostaje bez zmian** — obok "Podgląd"
   - Warunek: `onShowPreview` przekazywany jako undefined gdy `isNewOrder || isReadOnly`

4. **`PreviewUnsavedDialog.tsx`** (nowy, w `drawer/` obok UnsavedChangesDialog):
   - 3 opcje: Zapisz / Odrzuć / Anuluj
   - Pełny interfejs opisany wyżej w sekcji "UnsavedChangesDialog — ROZSZERZENIE"

### Faza 5: Fix labeli pakowania w drawerze
**Plik:** `src/components/orders/drawer/CargoSection.tsx`
**Agent:** Frontend (trivial fix, orkiestrator może sam)

Zmienić `LOADING_METHODS` (linia 29-34):
```ts
// PRZED:
{ code: "PALETA", label: "Paleta" },
{ code: "PALETA_BIGBAG", label: "Paleta / BigBag" },
{ code: "LUZEM", label: "Luzem" },
{ code: "KOSZE", label: "Kosze" },

// PO:
{ code: "LUZEM", label: "Luzem" },
{ code: "PALETA_BIGBAG", label: "Bigbag" },
{ code: "PALETA", label: "Paleta" },
{ code: "KOSZE", label: "Inne" },
```

### Faza 6: Aktualizacja dokumentacji
**Pliki:** `.ai/order.md`, `.ai/prd.md`, `.ai/api-plan.md`, `.ai/ui-plan.md`, `.ai/to_do/to_do.md`
**Agent:** Orkiestrator

- **order.md**: Dodać sekcję o OrderView, klauzuli poufności (edytowalna lokalnie), packaging labels
- **prd.md**: Dodać opis OrderView (podgląd A4), przycisk "Podgląd", packaging labels fix
- **ui-plan.md**: Dodać sekcję o OrderView (struktura plików, komponenty, flow)
- **api-plan.md**: Notatka że OrderView używa tego samego PUT endpoint
- **to_do.md**: Zaktualizować zrealizowane/nowe zadania

---

## Kolejność wykonania agentów

```
1. Database agent    → Faza 0a (migracja DB: confidentiality_clause)
   Types agent       → Faza 0b (types.ts + view-models.ts + order-view/types.ts + constants.ts z mapperami)
   Backend agent     → Faza 0c (API: dodanie confidentialityClause do Zod schemas + SELECT)
2. Frontend agent A  → Faza 1-3 (nowe pliki: editors, autocompletes, pickers, StopRows, OrderDocument, OrderView)
   Frontend agent B  → Faza 5 (fix CargoSection) — RÓWNOLEGLE z powyższym
3. Frontend agent    → Faza 4 (integracja: OrderDrawer, OrderForm, DrawerFooter, PreviewUnsavedDialog)
4. Orkiestrator      → Faza 6 (dokumentacja)
```

**Zależności:**
- Faza 0a/0b/0c mogą iść RÓWNOLEGLE (DB + typy + API niezależne)
- Faza 1-3 zależy od Fazy 0b (importuje typy i stałe)
- Faza 4 zależy od Faz 0-3 (importuje OrderView, mappery)
- Faza 5 jest NIEZALEŻNA (może iść równolegle z czymkolwiek)
- Faza 6 na końcu (opisuje wynik)

---

## Weryfikacja

1. **Build check**: `npm run build` — zero błędów TypeScript
2. **Manual test drawer**:
   - Otwórz istniejące zlecenie → sprawdź czy "Podgląd" + "Wyślij maila" są w footerze
   - Nowe zlecenie → "Podgląd" nie widoczne, "Wyślij maila" widoczne (jeśli status pozwala)
   - READ_ONLY role → "Podgląd" nie widoczne
3. **Manual test OrderView**:
   - Klik "Podgląd" (bez dirty) → Sheet poszerza się do 80vw, widać A4 dokument z danymi zlecenia
   - Klik "Podgląd" (z dirty) → Dialog 3-opcyjny (Zapisz/Odrzuć/Anuluj) działa poprawnie
   - Edytuj pola w OrderView → dirty indicator (amber badge) w toolbarze
   - Ctrl+S → zapisuje via PUT, toast, wraca do drawera z odświeżonymi danymi
   - Escape → dialog "Masz niezapisane zmiany" jeśli dirty, natychmiastowe wyjście jeśli clean
   - PDF button w toolbarze → pobiera PDF blob
4. **Packaging fix**: Otwórz drawer → Sekcja Towar → sprawdź 4 opcje: Luzem, Bigbag, Paleta, Inne
5. **DnD stops**: Przeciągnij stop w OrderView → numeracja L1-L8/U1-U3 się aktualizuje, first=LOADING/last=UNLOADING zachowane
6. **Autocompletes**: Firma → auto-fill adres + NIP. Produkt → zmiana resettuje packaging. Lokalizacja → filtrowanie po firmie.
7. **Print**: Ctrl+P z otwartego OrderView → toolbar ukryty, sam A4 dokument na wydruku, brak ikon edycji
8. **Dark mode**: Włącz dark → toolbar dark, A4 dokument ZAWSZE biały
9. **Responsive**: Zmień rozmiar okna → A4 skaluje się (zoom zmienia dynamicznie)
