/**
 * Testy round-trip drawera: zapis → zamknięcie → ponowne otwarcie → weryfikacja danych.
 *
 * Reprodukuje zgłoszony bug: po zapisie i ponownym otwarciu pola carrier company,
 * vehicle type i vehicle volume wyświetlają się puste, mimo że dane SĄ w formData
 * (isDirty=false po wpisaniu tych samych wartości dowodzi, że stan jest poprawny).
 *
 * Strategia:
 * - Mockujemy AuthContext i DictionaryContext na poziomie modułu (vi.hoisted)
 * - Renderujemy OrderDrawer bezpośrednio (nie przez OrdersPage)
 * - Kontrolujemy api.get/put/post żeby symulować flow: load → edit → save → reopen
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OrderDetailResponseDto } from "@/types";

// ---------------------------------------------------------------------------
// Stałe testowe
// ---------------------------------------------------------------------------

const TEST_USER_ID = "u0000000-0000-0000-0000-000000000001";
const TEST_ORDER_ID = "ord-0000-0000-0000-000000000001";

const CARRIER_COMPANY_ID = "a0000000-0000-0000-0000-000000000003";
const CARRIER_COMPANY_NAME = "TransBud Logistyka";

/** Buduje minimalny OrderDetailResponseDto do testów. */
function makeOrderDetail(overrides?: Partial<OrderDetailResponseDto["order"]>): OrderDetailResponseDto {
  return {
    order: {
      id: TEST_ORDER_ID,
      orderNo: "ZT2026/0001",
      statusCode: "robocze",
      transportTypeCode: "PL",
      currencyCode: "PLN",
      priceAmount: null,
      paymentTermDays: null,
      paymentMethod: null,
      totalLoadTons: null,
      totalLoadVolumeM3: null,
      summaryRoute: null,
      firstLoadingDate: null,
      firstLoadingTime: null,
      firstUnloadingDate: null,
      firstUnloadingTime: null,
      lastLoadingDate: null,
      lastLoadingTime: null,
      lastUnloadingDate: null,
      lastUnloadingTime: null,
      transportYear: 2026,
      firstLoadingCountry: null,
      firstUnloadingCountry: null,
      carrierCompanyId: null,
      carrierNameSnapshot: null,
      carrierLocationNameSnapshot: null,
      carrierAddressSnapshot: null,
      shipperLocationId: null,
      shipperNameSnapshot: null,
      shipperAddressSnapshot: null,
      receiverLocationId: null,
      receiverNameSnapshot: null,
      receiverAddressSnapshot: null,
      vehicleTypeText: null,
      vehicleCapacityVolumeM3: null,
      mainProductName: null,
      specialRequirements: null,
      requiredDocumentsText: null,
      generalNotes: null,
      notificationDetails: null,
      confidentialityClause: null,
      complaintReason: null,
      senderContactName: null,
      senderContactPhone: null,
      senderContactEmail: null,
      createdAt: "2026-02-17T10:00:00.000Z",
      createdByUserId: TEST_USER_ID,
      updatedAt: "2026-02-17T10:00:00.000Z",
      updatedByUserId: null,
      lockedByUserId: null,
      lockedAt: null,
      statusName: "Robocze",
      weekNumber: null,
      sentAt: null,
      sentByUserName: null,
      createdByUserName: "Test User",
      updatedByUserName: null,
      lockedByUserName: null,
      ...overrides,
    },
    stops: [
      {
        id: "stop-001",
        kind: "LOADING",
        sequenceNo: 1,
        dateLocal: "2026-02-20",
        timeLocal: "08:00",
        locationId: null,
        locationNameSnapshot: "Magazyn Centralny",
        companyNameSnapshot: "NordMetal",
        addressSnapshot: "ul. Testowa 1",
        notes: null,
      },
      {
        id: "stop-002",
        kind: "UNLOADING",
        sequenceNo: 2,
        dateLocal: "2026-02-21",
        timeLocal: "14:00",
        locationId: null,
        locationNameSnapshot: "Magazyn Docelowy",
        companyNameSnapshot: "Recykling",
        addressSnapshot: "ul. Końcowa 5",
        notes: null,
      },
    ],
    items: [],
  };
}

// ---------------------------------------------------------------------------
// Mock api — vi.hoisted() gwarantuje że zmienne są dostępne w fabrykach vi.mock.
// UWAGA: obiekt `mockAuthValue` musi mieć STABILNĄ referencję (ten sam obiekt co render),
// bo OrderDrawer używa `useCallback([api, user])` → nowa referencja api = nowy callback =
// useEffect re-run = infinite loop.
// ---------------------------------------------------------------------------

const {
  mockApiGet,
  mockApiPut,
  mockApiPost,
  mockApiDelete,
  mockApiPatch,
  mockApiPostRaw,
  mockAuthValue,
  mockDictValue,
} = vi.hoisted(() => {
  const _mockApiGet = vi.fn();
  const _mockApiPut = vi.fn();
  const _mockApiPost = vi.fn();
  const _mockApiDelete = vi.fn();
  const _mockApiPatch = vi.fn();
  const _mockApiPostRaw = vi.fn();

  // Stabilna referencja api — nigdy nie tworzymy nowego obiektu
  const stableApi = {
    get: _mockApiGet,
    put: _mockApiPut,
    post: _mockApiPost,
    delete: _mockApiDelete,
    patch: _mockApiPatch,
    postRaw: _mockApiPostRaw,
  };

  const stableUser = { id: "u0000000-0000-0000-0000-000000000001", email: "test@test.pl", fullName: "Test User", phone: null, role: "PLANNER" as const };

  // Stabilne obiekty kontekstów — ta sama referencja w każdym renderze
  const _mockAuthValue = {
    user: stableUser,
    isLoading: false,
    api: stableApi,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  };

  const _mockDictValue = {
    companies: [
      { id: "a0000000-0000-0000-0000-000000000001", name: "NordMetal Sp. z o.o.", isActive: true, erpId: null, taxId: "5270001001", type: "INTERNAL", notes: null },
      { id: "a0000000-0000-0000-0000-000000000002", name: "Recykling Plus S.A.", isActive: true, erpId: null, taxId: "5270002002", type: "INTERNAL", notes: null },
      { id: "a0000000-0000-0000-0000-000000000003", name: "TransBud Logistyka", isActive: true, erpId: null, taxId: "6340003003", type: "CARRIER", notes: null },
      { id: "a0000000-0000-0000-0000-000000000004", name: "SpeedCargo Sp. z o.o.", isActive: true, erpId: null, taxId: "7250004004", type: "CARRIER", notes: null },
    ],
    locations: [],
    products: [],
    transportTypes: [
      { code: "PL", name: "Krajowy", isActive: true, description: null },
      { code: "EXP", name: "Eksport", isActive: true, description: null },
    ],
    orderStatuses: [
      { code: "robocze", name: "Robocze", sortOrder: 1, viewGroup: "CURRENT", isEditable: true },
      { code: "wysłane", name: "Wysłane", sortOrder: 2, viewGroup: "CURRENT", isEditable: false },
      { code: "korekta", name: "Korekta", sortOrder: 3, viewGroup: "CURRENT", isEditable: true },
      { code: "zrealizowane", name: "Zrealizowane", sortOrder: 5, viewGroup: "COMPLETED", isEditable: false },
      { code: "anulowane", name: "Anulowane", sortOrder: 7, viewGroup: "CANCELLED", isEditable: false },
    ],
    vehicleVariants: [
      { code: "MEGA_24T", name: "Mega 24t", vehicleType: "Naczepa mega", capacityTons: 24, capacityVolumeM3: 100, description: null, isActive: true },
      { code: "STAND_24T", name: "Standard 24t", vehicleType: "Naczepa standard", capacityTons: 24, capacityVolumeM3: 90, description: null, isActive: true },
      { code: "SOLO_12T", name: "Solo 12t", vehicleType: "Samochód solo", capacityTons: 12, capacityVolumeM3: 40, description: null, isActive: true },
      { code: "BUS_3T", name: "Bus 3.5t", vehicleType: "Bus", capacityTons: 3.5, capacityVolumeM3: 15, description: null, isActive: true },
    ],
    isLoading: false,
    error: null,
    refreshDictionaries: vi.fn(),
  };

  return {
    mockApiGet: _mockApiGet,
    mockApiPut: _mockApiPut,
    mockApiPost: _mockApiPost,
    mockApiDelete: _mockApiDelete,
    mockApiPatch: _mockApiPatch,
    mockApiPostRaw: _mockApiPostRaw,
    mockAuthValue: _mockAuthValue,
    mockDictValue: _mockDictValue,
  };
});

// ---------------------------------------------------------------------------
// Mock kontekstów — zwracamy STABILNE obiekty (ta sama referencja)
// ---------------------------------------------------------------------------

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock("@/contexts/DictionaryContext", () => ({
  useDictionaries: () => mockDictValue,
}));

// Mock sonner toast — zapobiegamy błędom renderowania
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Polyfille DOM dla Radix UI (jsdom nie obsługuje ScrollArea/Popover/Select w pełni)
// ---------------------------------------------------------------------------

if (typeof HTMLElement.prototype.scrollTo !== "function") {
  HTMLElement.prototype.scrollTo = vi.fn();
}
if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
}
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = vi.fn();
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = vi.fn();
}
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
// Radix Select wymaga scrollIntoView (jsdom nie implementuje)
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = vi.fn();
}

// ---------------------------------------------------------------------------
// Import komponentu PO mockach
// ---------------------------------------------------------------------------

import { OrderDrawer } from "@/components/orders/drawer/OrderDrawer";

// ---------------------------------------------------------------------------
// Helper: renderowanie drawera z kontrolowanymi propsami
// ---------------------------------------------------------------------------

function DrawerHarness({
  orderId,
  isOpen,
  onClose,
  onOrderUpdated,
}: {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
}) {
  return (
    <OrderDrawer
      orderId={orderId}
      isOpen={isOpen}
      onClose={onClose}
      onOrderUpdated={onOrderUpdated}
    />
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Domyślne zachowanie: lock zawsze OK, unlock zawsze OK
  mockApiPost.mockImplementation((url: string) => {
    if (url.includes("/lock")) return Promise.resolve({ id: TEST_ORDER_ID, lockedByUserId: TEST_USER_ID, lockedAt: new Date().toISOString() });
    if (url.includes("/unlock")) return Promise.resolve({ id: TEST_ORDER_ID, lockedByUserId: null, lockedAt: null });
    return Promise.resolve({});
  });
  mockApiPut.mockResolvedValue({ id: TEST_ORDER_ID, orderNo: "ZT2026/0001", statusCode: "robocze", updatedAt: "2026-02-17T11:00:00.000Z" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Pomocnicze funkcje
// ---------------------------------------------------------------------------

/** Czeka aż drawer się załaduje (zniknie komunikat "Ładowanie zlecenia…"). */
async function waitForDrawerLoaded() {
  await waitFor(() => {
    expect(screen.queryByText("Ładowanie zlecenia…")).not.toBeInTheDocument();
  }, { timeout: 3000 });
}

/** Znajduje przycisk "Zapisz" w drawerze. */
function findSaveButton(): HTMLElement {
  return screen.getByRole("button", { name: /Zapisz/ });
}

/** Sprawdza czy przycisk "Zapisz" jest wyłączony (disabled). */
function expectSaveDisabled() {
  expect(findSaveButton()).toBeDisabled();
}

/** Sprawdza czy przycisk "Zapisz" jest aktywny (enabled). */
function expectSaveEnabled() {
  expect(findSaveButton()).not.toBeDisabled();
}

/**
 * Znajduje combobox (autocomplete / select) w sekcji z daną etykietą.
 * Szuka labela, potem w najbliższym parent div znajduje combobox.
 */
function findComboboxByLabel(labelText: RegExp): HTMLElement {
  const label = screen.getByText(labelText);
  // Idź w górę do kontenera sekcji (div z min-w-0 lub space-y-1) i znajdź combobox
  const container = label.closest("div.min-w-0") ?? label.parentElement;
  if (!container) throw new Error(`Nie znaleziono kontenera dla labela ${labelText}`);
  const combobox = container.querySelector("[role='combobox']");
  if (!combobox) throw new Error(`Nie znaleziono combobox w sekcji ${labelText}`);
  return combobox as HTMLElement;
}

/** Znajduje combobox przewoźnika (AutocompleteField w CarrierSection). */
function findCarrierCombobox(): HTMLElement {
  return findComboboxByLabel(/Nazwa firmy.*przewoźnik/);
}

/** Znajduje combobox typu auta (Select w CarrierSection). */
function findVehicleTypeCombobox(): HTMLElement {
  return findComboboxByLabel(/Typ auta/);
}

// ---------------------------------------------------------------------------
// TESTY
// ---------------------------------------------------------------------------

describe("Carrier company round-trip", () => {
  it("carrier company persists after save and reopen", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOrderUpdated = vi.fn();

    // 1. Pierwszy GET: zlecenie bez przewoźnika
    const initialDetail = makeOrderDetail({ carrierCompanyId: null });
    mockApiGet.mockResolvedValueOnce(initialDetail);

    const { rerender } = render(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={true} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );

    await waitForDrawerLoaded();

    // 2. Otwórz autocomplete przewoźnika
    const carrierCombobox = findCarrierCombobox();
    await user.click(carrierCombobox);

    // 3. Szukaj i wybierz firmę
    await waitFor(() => {
      expect(screen.getByText(CARRIER_COMPANY_NAME)).toBeInTheDocument();
    });
    await user.click(screen.getByText(CARRIER_COMPANY_NAME));

    // 4. Sprawdź czy Save jest aktywny (isDirty=true)
    await waitFor(() => expectSaveEnabled());

    // 5. Kliknij Save
    await user.click(findSaveButton());

    // 6. Sprawdź czy api.put został wywołany z poprawnym carrierCompanyId
    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledTimes(1);
    });
    const putBody = mockApiPut.mock.calls[0][1];
    expect(putBody.carrierCompanyId).toBe(CARRIER_COMPANY_ID);

    // 7. Po zapisie drawer się zamyka (doClose jest wywoływane)
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    // 8. Przygotuj mock na ponowne otwarcie: api.get zwraca dane z ustawionym przewoźnikiem
    const updatedDetail = makeOrderDetail({
      carrierCompanyId: CARRIER_COMPANY_ID,
      carrierNameSnapshot: CARRIER_COMPANY_NAME,
      updatedAt: "2026-02-17T11:00:00.000Z",
    });
    mockApiGet.mockResolvedValueOnce(updatedDetail);
    onClose.mockClear();

    // 9. Zamknij i ponownie otwórz drawer
    rerender(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={false} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );
    rerender(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={true} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );

    await waitForDrawerLoaded();

    // 10. Sprawdź czy nazwa przewoźnika WYŚWIETLA SIĘ w autocomplete
    await waitFor(() => {
      const combobox = findCarrierCombobox();
      expect(combobox).toHaveTextContent(CARRIER_COMPANY_NAME);
    });

    // 11. Sprawdź czy Save jest WYŁĄCZONY (isDirty=false)
    expectSaveDisabled();
  });
});

describe("Vehicle type + volume round-trip", () => {
  it("vehicle type and volume persist after save and reopen", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOrderUpdated = vi.fn();

    // 1. Pierwszy GET: zlecenie bez typu/objętości
    const initialDetail = makeOrderDetail({ vehicleTypeText: null, vehicleCapacityVolumeM3: null });
    mockApiGet.mockResolvedValueOnce(initialDetail);

    const { rerender } = render(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={true} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );

    await waitForDrawerLoaded();

    // 2. Wybierz typ pojazdu "Naczepa mega" z dropdownu Typ auta
    const vehicleTypeSelect = findVehicleTypeCombobox();
    await user.click(vehicleTypeSelect);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Naczepa mega" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("option", { name: "Naczepa mega" }));

    // 3. Wpisz dowolną objętość (85 m³ — niezależne pole)
    const volInput = screen.getByPlaceholderText("m³") as HTMLInputElement;
    await user.clear(volInput);
    await user.type(volInput, "85");

    // 4. Sprawdź czy Save jest aktywny (vehicleTypeText zmienił się z null na "Naczepa mega")
    await waitFor(() => expectSaveEnabled());

    // 5. Kliknij Save
    await user.click(findSaveButton());

    // 6. Sprawdź vehicleTypeText + vehicleCapacityVolumeM3 w PUT body
    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledTimes(1);
    });
    const putBody = mockApiPut.mock.calls[0][1];
    expect(putBody.vehicleTypeText).toBe("Naczepa mega");
    expect(putBody.vehicleCapacityVolumeM3).toBe(85);

    // 7. Drawer się zamyka
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    // 8. Przygotuj mock na ponowne otwarcie z zapisanymi polami
    const updatedDetail = makeOrderDetail({
      vehicleTypeText: "Naczepa mega",
      vehicleCapacityVolumeM3: 85,
      updatedAt: "2026-02-17T11:00:00.000Z",
    });
    mockApiGet.mockResolvedValueOnce(updatedDetail);
    onClose.mockClear();

    // 9. Reopen drawer
    rerender(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={false} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );
    rerender(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={true} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );

    await waitForDrawerLoaded();

    // 10. Sprawdź czy typ auta wyświetla "Naczepa mega"
    await waitFor(() => {
      const vehicleSelect = findVehicleTypeCombobox();
      expect(vehicleSelect).toHaveTextContent("Naczepa mega");
    });

    // 11. Sprawdź czy objętość wyświetla "85"
    const volumeAfterReopen = screen.getByPlaceholderText("m³") as HTMLInputElement;
    expect(volumeAfterReopen.value).toBe("85");

    // 12. Save jest wyłączony
    expectSaveDisabled();
  });

  it("volume input is independent of vehicle type selection", async () => {
    // Objętość m³ to wolne pole liczbowe — niezależne od typu auta.
    // Użytkownik może wpisać dowolną wartość bez matchowania do wariantu.

    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOrderUpdated = vi.fn();

    // 1. Zlecenie bez typu/objętości
    const initialDetail = makeOrderDetail({ vehicleTypeText: null, vehicleCapacityVolumeM3: null });
    mockApiGet.mockResolvedValueOnce(initialDetail);

    render(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={true} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );

    await waitForDrawerLoaded();

    // 2. Wpisz objętość bez wybierania typu (pole powinno być aktywne)
    const volInput = screen.getByPlaceholderText("m³") as HTMLInputElement;
    await user.clear(volInput);
    await user.type(volInput, "42");

    // 3. Save DOSTĘPNY — vehicleCapacityVolumeM3 zmienił się z null na 42
    await waitFor(() => expectSaveEnabled());

    // 4. Kliknij Save i sprawdź PUT body
    await user.click(findSaveButton());
    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledTimes(1);
    });
    const putBody = mockApiPut.mock.calls[0][1];
    expect(putBody.vehicleTypeText).toBeNull();
    expect(putBody.vehicleCapacityVolumeM3).toBe(42);
  });
});

describe("General field round-trip", () => {
  it("general notes persist after save and reopen", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOrderUpdated = vi.fn();

    // 1. Zlecenie bez notatek
    const initialDetail = makeOrderDetail({ generalNotes: null });
    mockApiGet.mockResolvedValueOnce(initialDetail);

    const { rerender } = render(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={true} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );

    await waitForDrawerLoaded();

    // 2. Wpisz tekst w pole notatek
    const notesTextarea = screen.getByPlaceholderText("Dodatkowe uwagi do zlecenia…");
    await user.type(notesTextarea, "Notatki testowe");

    // 3. Save aktywny
    await waitFor(() => expectSaveEnabled());

    // 4. Zapisz
    await user.click(findSaveButton());

    // 5. Sprawdź co poszło w PUT
    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledTimes(1);
    });
    const putBody = mockApiPut.mock.calls[0][1];
    expect(putBody.generalNotes).toBe("Notatki testowe");

    // 6. Zamknięcie
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    // 7. Reopen z zapisanymi notatkami
    const updatedDetail = makeOrderDetail({
      generalNotes: "Notatki testowe",
      updatedAt: "2026-02-17T11:00:00.000Z",
    });
    mockApiGet.mockResolvedValueOnce(updatedDetail);
    onClose.mockClear();

    rerender(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={false} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );
    rerender(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={true} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );

    await waitForDrawerLoaded();

    // 8. Notatki się wyświetlają
    const notesAfterReopen = screen.getByPlaceholderText("Dodatkowe uwagi do zlecenia…") as HTMLTextAreaElement;
    expect(notesAfterReopen.value).toBe("Notatki testowe");

    // 9. Save wyłączony
    expectSaveDisabled();
  });

  it("price amount persists after save and reopen", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOrderUpdated = vi.fn();

    // 1. Zlecenie bez stawki
    const initialDetail = makeOrderDetail({ priceAmount: null });
    mockApiGet.mockResolvedValueOnce(initialDetail);

    const { rerender } = render(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={true} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );

    await waitForDrawerLoaded();

    // 2. Wpisz kwotę w pole stawki (placeholder "0.00")
    const priceInput = screen.getByPlaceholderText("0.00");
    await user.type(priceInput, "5000");

    // 3. Save aktywny
    await waitFor(() => expectSaveEnabled());

    // 4. Zapisz
    await user.click(findSaveButton());

    // 5. Sprawdź PUT body
    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledTimes(1);
    });
    const putBody = mockApiPut.mock.calls[0][1];
    expect(putBody.priceAmount).toBe(5000);

    // 6. Zamknięcie
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    // 7. Reopen z zapisaną stawką
    const updatedDetail = makeOrderDetail({
      priceAmount: 5000,
      updatedAt: "2026-02-17T11:00:00.000Z",
    });
    mockApiGet.mockResolvedValueOnce(updatedDetail);
    onClose.mockClear();

    rerender(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={false} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );
    rerender(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={true} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );

    await waitForDrawerLoaded();

    // 8. Stawka wyświetla się poprawnie
    const priceAfterReopen = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(priceAfterReopen.value).toBe("5000");

    // 9. Save wyłączony
    expectSaveDisabled();
  });
});

describe("isDirty behavior after reopen", () => {
  it("re-entering same carrier value keeps isDirty false", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOrderUpdated = vi.fn();

    // 1. Zlecenie Z ustawionym przewoźnikiem
    const detail = makeOrderDetail({
      carrierCompanyId: CARRIER_COMPANY_ID,
      carrierNameSnapshot: CARRIER_COMPANY_NAME,
    });
    mockApiGet.mockResolvedValueOnce(detail);

    render(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={true} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );

    await waitForDrawerLoaded();

    // 2. Przewoźnik wyświetla się poprawnie
    const carrierCb = findCarrierCombobox();
    expect(carrierCb).toHaveTextContent(CARRIER_COMPANY_NAME);

    // 3. Save jest wyłączony (nic nie zmieniono)
    expectSaveDisabled();

    // 4. Otwórz autocomplete i wybierz TEGO SAMEGO przewoźnika
    await user.click(carrierCb);
    // W autocomplete nazwa firmy pojawia się zarówno w triggerze jak i w liście opcji — klikamy opcję
    await waitFor(() => {
      expect(screen.getAllByText(CARRIER_COMPANY_NAME).length).toBeGreaterThanOrEqual(2);
    });
    // Ostatni element to opcja w liście
    const matches = screen.getAllByText(CARRIER_COMPANY_NAME);
    await user.click(matches[matches.length - 1]);

    // 5. Save POWINIEN POZOSTAĆ WYŁĄCZONY (te same dane = isDirty=false)
    // To dowodzi, że dane SĄ w formData — po prostu nie wyświetlały się w UI
    expectSaveDisabled();
  });

  it("re-entering same general notes value keeps isDirty false", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOrderUpdated = vi.fn();

    // 1. Zlecenie z notatkami
    const detail = makeOrderDetail({ generalNotes: "Oryginalne uwagi" });
    mockApiGet.mockResolvedValueOnce(detail);

    render(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={true} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );

    await waitForDrawerLoaded();

    // 2. Notatki się wyświetlają
    const textarea = screen.getByPlaceholderText("Dodatkowe uwagi do zlecenia…") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Oryginalne uwagi");

    // 3. Save wyłączony
    expectSaveDisabled();

    // 4. Wyczyść pole i wpisz te same dane
    await user.clear(textarea);
    await user.type(textarea, "Oryginalne uwagi");

    // 5. Save powinien być wyłączony (te same dane)
    expectSaveDisabled();
  });
});

describe("Multiple fields round-trip", () => {
  it("carrier + notes + price all persist after save and reopen", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOrderUpdated = vi.fn();

    // 1. Puste zlecenie
    const initialDetail = makeOrderDetail();
    mockApiGet.mockResolvedValueOnce(initialDetail);

    const { rerender } = render(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={true} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );

    await waitForDrawerLoaded();

    // 2. Ustaw przewoźnika
    const carrierCombobox = findCarrierCombobox();
    await user.click(carrierCombobox);
    await waitFor(() => expect(screen.getByText(CARRIER_COMPANY_NAME)).toBeInTheDocument());
    await user.click(screen.getByText(CARRIER_COMPANY_NAME));

    // 3. Wpisz notatki
    const notesTextarea = screen.getByPlaceholderText("Dodatkowe uwagi do zlecenia…");
    await user.type(notesTextarea, "Ważne info");

    // 4. Wpisz stawkę
    const priceInput = screen.getByPlaceholderText("0.00");
    await user.type(priceInput, "3500");

    // 5. Save aktywny
    await waitFor(() => expectSaveEnabled());

    // 6. Zapisz
    await user.click(findSaveButton());

    // 7. Sprawdź PUT body
    await waitFor(() => expect(mockApiPut).toHaveBeenCalledTimes(1));
    const putBody = mockApiPut.mock.calls[0][1];
    expect(putBody.carrierCompanyId).toBe(CARRIER_COMPANY_ID);
    expect(putBody.generalNotes).toBe("Ważne info");
    expect(putBody.priceAmount).toBe(3500);

    // 8. Drawer zamknięty
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    // 9. Reopen ze wszystkimi danymi
    const updatedDetail = makeOrderDetail({
      carrierCompanyId: CARRIER_COMPANY_ID,
      carrierNameSnapshot: CARRIER_COMPANY_NAME,
      generalNotes: "Ważne info",
      priceAmount: 3500,
      updatedAt: "2026-02-17T11:00:00.000Z",
    });
    mockApiGet.mockResolvedValueOnce(updatedDetail);
    onClose.mockClear();

    rerender(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={false} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );
    rerender(
      <DrawerHarness orderId={TEST_ORDER_ID} isOpen={true} onClose={onClose} onOrderUpdated={onOrderUpdated} />
    );

    await waitForDrawerLoaded();

    // 10. Weryfikacja wszystkich pól
    await waitFor(() => {
      expect(findCarrierCombobox()).toHaveTextContent(CARRIER_COMPANY_NAME);
    });

    const notesAfter = screen.getByPlaceholderText("Dodatkowe uwagi do zlecenia…") as HTMLTextAreaElement;
    expect(notesAfter.value).toBe("Ważne info");

    const priceAfter = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    expect(priceAfter.value).toBe("3500");

    // 11. Save wyłączony
    expectSaveDisabled();
  });
});
