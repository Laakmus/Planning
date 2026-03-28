# ROOT CAUSE ANALYSIS: CarrierSection Empty Fields Display Bug

## EXECUTIVE SUMMARY

**PRIMARY ISSUE: Race Condition Between Dictionary Loading and OrderForm Mount**

1. DictionaryContext loads vehicleVariants asynchronously via API
2. OrderDrawer opens immediately (does not wait for dictionaries)
3. OrderForm mounts while vehicleVariants is still []
4. CarrierSection useState initializer runs: currentVariant = undefined, selectedVehicleType = ""
5. Select renders with empty uniqueVehicleTypes list (filter removes empty array)
6. vehicleVariants finally load → useEffect updates selectedVehicleType state
7. BUT: Radix UI Select doesn't properly re-sync the visual display (rendering bug in shadcn Select)

---

## DETAILED DATA FLOW

### Phase 1: API → OrderForm (buildInitialForm)
```
Database: vehicle_variant_code = "MEGA_24T"
  ↓
API GET /api/v1/orders/{id}: returns vehicleVariantCode: "MEGA_24T" ✓
  ↓
OrderForm.buildInitialForm(): formData.vehicleVariantCode = "MEGA_24T" ✓
```
**Status**: Data correctly loaded and stored in formData.

### Phase 2: OrderForm → CarrierSection Props
```
<CarrierSection
  formData={formData}  // vehicleVariantCode: "MEGA_24T" ✓
  vehicleVariants={vehicleVariants}  // From useDictionaries() hook
/>
```
**Status**: Data passed correctly to CarrierSection.

### Phase 3: CarrierSection Initialization (CRITICAL RACE CONDITION)
```
MOUNT TIME (first render):

CarrierSection.tsx LINE 46-48:
  const currentVariant = vehicleVariants.find(
    (v) => v.code === formData.vehicleVariantCode,  // formData has "MEGA_24T"
  );

PROBLEM: vehicleVariants array might be EMPTY at mount time!

DictionaryContext loading timeline:
  - User logs in (AuthContext)
  - DictionaryProvider.useEffect triggers loadDictionaries()
  - Promise.all([6 API endpoints]) starts
  - User clicks order → OrderDrawer opens
  - OrderForm mounts (doesn't wait for dictionaries!)
  - useDictionaries() returns incomplete state: vehicleVariants = [] (still loading)
```

**Result of Empty vehicleVariants at Mount:**
```typescript
currentVariant = vehicleVariants.find(...) = undefined  // Empty array, no match
selectedVehicleType = undefined?.vehicleType ?? "" = ""  // EMPTY STRING
volumeInput = undefined?.capacityVolumeM3 ?? "" = ""  // EMPTY STRING

uniqueVehicleTypes = [].filter(...).map(...) = []  // NO OPTIONS IN SELECT
```

### Phase 4: M-08 Fix Attempt (useEffect Synchronization)
```typescript
CarrierSection.tsx LINE 61-71:
  useEffect(() => {
    const variant = vehicleVariants.find(
      (v) => v.code === formData.vehicleVariantCode,
    );
    setSelectedVehicleType(variant?.vehicleType ?? "");
    setVolumeInput(
      variant?.capacityVolumeM3 != null ? String(variant.capacityVolumeM3) : "",
    );
  }, [formData.vehicleVariantCode, vehicleVariants]);
```

**When vehicleVariants finally load from API:**
- Dependency `vehicleVariants` changes
- useEffect fires
- variant = vehicleVariants.find(v => v.code === "MEGA_24T") → returns VehicleVariantDto ✓
- setSelectedVehicleType("Naczepa mega") → state updates
- setVolumeInput("100") → state updates

**BUT: Radix UI Select Rendering Bug**

The problem is Radix UI's `<Select>` (shadcn wrapper) does NOT properly re-sync the displayed value when:
1. Initial render happens with empty options list
2. Options are added later
3. State value is updated to match a new option

The `<SelectValue>` placeholder remains visible because:
- Radix checks if `value` matches any `<SelectItem value={...}>`
- At initial render: no items exist (uniqueVehicleTypes was [])
- `<SelectValue placeholder="..." />` displayed
- When options later appear, Radix doesn't force re-evaluation of whether the value matches

---

## ROOT CAUSE: Missing Dependency on Dictionary Loading State

**Critical Finding:**
```typescript
// OrderForm.tsx LINE 127:
const { companies, locations, products, transportTypes, vehicleVariants } = useDictionaries();

// ← OrderForm NEVER checks if dictionaries are STILL LOADING!
// ← No guard against vehicleVariants being empty while async fetch is in progress!
```

**DictionaryContext provides:**
```typescript
export interface DictionaryContextValue extends DictionaryState {
  companies: CompanyDto[];
  vehicleVariants: VehicleVariantDto[];
  isLoading: boolean;  // ← THIS IS AVAILABLE BUT UNUSED!
  error: null;
}
```

**OrderForm should:**
```typescript
const { vehicleVariants, isLoading } = useDictionaries();

if (isLoading) {
  // Wait or disable CarrierSection until dictionaries load
  // OR: Show skeleton/loading state
}
```

But it doesn't. It blindly uses vehicleVariants even when empty.

---

## Why isDirty Mechanism Shows Values Already Exist

The isDirty check compares formData (which HAS vehicleVariantCode from API) against originalRef.

```typescript
// OrderForm.tsx LINE 152-162:
function computeDirty(fd: OrderFormData, ...): boolean {
  return (
    JSON.stringify(fd) !== JSON.stringify(originalRef.current)
    // ...
  );
}
```

originalRef captures:
```
vehicleVariantCode: "MEGA_24T"  ← captured from API response
```

If user tries to change the value, formData STILL has "MEGA_24T", so isDirty = false (no visible change).

This is WHY the user sees: "System already has those values, but I can't see them on the form."

---

## Why AutocompleteField Also Shows Empty

Same root cause: carrierCompanyId is in formData, but:
- AutocompleteField might not have the matching company in its `items` prop
- OR: companies array is empty when AutocompleteField mounts
- Same race condition, different component

---

## Confirmation Points

From code review:

1. **DictionaryContext** (LINE 114-121):
   - Loads dictionaries async on user login
   - Does NOT block OrderDrawer from opening

2. **OrderDrawer** (LINE 161-174):
   - Immediately opens and calls `loadDetail(orderId)`
   - Mounts `<OrderForm>` immediately
   - No wait for `DictionaryProvider` to finish loading

3. **OrderForm** (LINE 127):
   - Uses `useDictionaries()` without checking `isLoading`
   - Passes potentially-empty vehicleVariants to CarrierSection

4. **CarrierSection** (LINE 46-48, 73-78):
   - Uses vehicleVariants.find() assuming array is populated
   - Builds uniqueVehicleTypes from potentially-empty array
   - M-08 useEffect relies on vehicleVariants changing, but doesn't force Radix Select re-render

5. **Radix UI Select Bug**:
   - Once rendered with no options, re-rendering with options + state update doesn't force value re-display
   - The `<SelectValue>` placeholder persists instead of showing the matched option

---

## Summary Table

| Component | Check | Status |
|-----------|-------|--------|
| API Response | vehicleVariantCode present | ✓ CORRECT |
| OrderForm.formData | vehicleVariantCode captured | ✓ CORRECT |
| isDirty detector | Sees vehicleVariantCode in formData | ✓ CORRECT |
| CarrierSection.props | Receives vehicleVariantCode | ✓ CORRECT |
| DictionaryContext | vehicleVariants loaded async | ⚠ TIMING ISSUE |
| CarrierSection.mount | vehicleVariants empty on init | ✗ RACE CONDITION |
| Select.render | No options, placeholder shown | ✗ RENDERING BUG |
| Select.useEffect | State updates but UI doesn't sync | ✗ RADIX UI BUG |

