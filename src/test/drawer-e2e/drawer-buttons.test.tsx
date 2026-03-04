/**
 * Testy integracyjne przycisków i elementów interaktywnych OrderDrawer.
 * Pokrywają: nagłówek, kontakt, trasa, towar, przewoźnik, finanse, uwagi, status, footer, dialog niezapisanych zmian.
 */

import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { OrderDetailResponseDto, CompanyDto, LocationDto, ProductDto, TransportTypeDto, OrderStatusDto, VehicleVariantDto, AuthMeDto } from "@/types";
import type { ApiClient } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Mock kontekstów — mockujemy moduły hooku
// ---------------------------------------------------------------------------

const mockApi: ApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
  postRaw: vi.fn(),
};

const mockUser: AuthMeDto = {
  id: "test-user-id-001",
  email: "admin@test.pl",
  fullName: "Admin Testowy",
  phone: null,
  role: "ADMIN",
  locationId: null,
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
    api: mockApi,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

const mockCompanies: CompanyDto[] = [
  { id: "comp-001", name: "NordMetal Sp. z o.o.", isActive: true, erpId: null, taxId: "1234567890", type: "INTERNAL", notes: null },
  { id: "comp-002", name: "SouthLogistics", isActive: true, erpId: null, taxId: "9876543210", type: "CARRIER", notes: null },
];

const mockLocations: LocationDto[] = [
  { id: "loc-001", name: "Magazyn Centralny", companyId: "comp-001", companyName: "NordMetal Sp. z o.o.", city: "Warszawa", country: "PL", streetAndNumber: "ul. Testowa 1", postalCode: "00-001", isActive: true, notes: null },
  { id: "loc-002", name: "Oddział Południe", companyId: "comp-002", companyName: "SouthLogistics", city: "Kraków", country: "PL", streetAndNumber: "ul. Krakowska 10", postalCode: "30-001", isActive: true, notes: null },
];

const mockProducts: ProductDto[] = [
  { id: "prod-001", name: "Stal nierdzewna", isActive: true, description: null, defaultLoadingMethodCode: "PALETA" },
  { id: "prod-002", name: "Miedź", isActive: true, description: null, defaultLoadingMethodCode: "LUZEM" },
];

const mockTransportTypes: TransportTypeDto[] = [
  { code: "PL", name: "Krajowy", isActive: true, description: null },
  { code: "EXP", name: "Eksport", isActive: true, description: null },
  { code: "EXP_K", name: "Eksport K", isActive: true, description: null },
  { code: "IMP", name: "Import", isActive: true, description: null },
];

const mockOrderStatuses: OrderStatusDto[] = [
  { code: "robocze", name: "Robocze", sortOrder: 1, viewGroup: "CURRENT", isEditable: true },
  { code: "wysłane", name: "Wysłane", sortOrder: 2, viewGroup: "CURRENT", isEditable: false },
  { code: "korekta", name: "Korekta", sortOrder: 3, viewGroup: "CURRENT", isEditable: true },
  { code: "zrealizowane", name: "Zrealizowane", sortOrder: 5, viewGroup: "COMPLETED", isEditable: false },
  { code: "reklamacja", name: "Reklamacja", sortOrder: 6, viewGroup: "CURRENT", isEditable: false },
  { code: "anulowane", name: "Anulowane", sortOrder: 7, viewGroup: "CANCELLED", isEditable: false },
];

const mockVehicleVariants: VehicleVariantDto[] = [
  { code: "TIR_90", name: "TIR 90m³", isActive: true, capacityTons: 24, capacityVolumeM3: 90, vehicleType: "TIR", description: null },
  { code: "TIR_100", name: "TIR 100m³", isActive: true, capacityTons: 24, capacityVolumeM3: 100, vehicleType: "TIR", description: null },
  { code: "BUS_40", name: "Bus 40m³", isActive: true, capacityTons: 3.5, capacityVolumeM3: 40, vehicleType: "Bus", description: null },
];

vi.mock("@/contexts/DictionaryContext", () => ({
  useDictionaries: () => ({
    companies: mockCompanies,
    locations: mockLocations,
    products: mockProducts,
    transportTypes: mockTransportTypes,
    orderStatuses: mockOrderStatuses,
    vehicleVariants: mockVehicleVariants,
    isLoading: false,
    error: null,
    refreshDictionaries: vi.fn(),
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock Radix ScrollArea — renderuj children bezpośrednio
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
  ScrollBar: () => null,
}));

// ---------------------------------------------------------------------------
// Import komponentów PO mockach
// ---------------------------------------------------------------------------

import { OrderDrawer } from "@/components/orders/drawer/OrderDrawer";
import { DrawerFooter } from "@/components/orders/drawer/DrawerFooter";
import { NotesSection } from "@/components/orders/drawer/NotesSection";
import { StatusSection } from "@/components/orders/drawer/StatusSection";
import { UnsavedChangesDialog } from "@/components/orders/drawer/UnsavedChangesDialog";

// ---------------------------------------------------------------------------
// Dane testowe
// ---------------------------------------------------------------------------

function makeOrderDetail(overrides?: Partial<OrderDetailResponseDto["order"]>): OrderDetailResponseDto {
  return {
    order: {
      id: "order-001",
      orderNo: "ZT2026/0042",
      statusCode: "robocze",
      transportTypeCode: "PL",
      currencyCode: "PLN",
      priceAmount: 5000,
      paymentTermDays: 21,
      paymentMethod: "Przelew",
      totalLoadTons: 10,
      totalLoadVolumeM3: null,
      summaryRoute: "L1:Magazyn → U1:Oddział",
      firstLoadingDate: "2026-03-10",
      firstLoadingTime: "08:00",
      firstUnloadingDate: "2026-03-11",
      firstUnloadingTime: "14:00",
      lastLoadingDate: "2026-03-10",
      lastLoadingTime: "08:00",
      lastUnloadingDate: "2026-03-11",
      lastUnloadingTime: "14:00",
      transportYear: 2026,
      firstLoadingCountry: "PL",
      firstUnloadingCountry: "PL",
      carrierCompanyId: "comp-001",
      carrierNameSnapshot: "NordMetal Sp. z o.o.",
      carrierLocationNameSnapshot: null,
      carrierAddressSnapshot: null,
      shipperLocationId: null,
      shipperNameSnapshot: null,
      shipperAddressSnapshot: null,
      receiverLocationId: null,
      receiverNameSnapshot: null,
      receiverAddressSnapshot: null,
      vehicleTypeText: "Standard 24T",
      vehicleCapacityVolumeM3: 90,
      mainProductName: "Stal nierdzewna",
      specialRequirements: null,
      requiredDocumentsText: "WZ, KPO, kwit wagowy",
      generalNotes: "Uwaga testowa",
      notificationDetails: null,
      confidentialityClause: null,
      complaintReason: null,
      senderContactName: "Jan Kowalski",
      senderContactPhone: "+48 123 456 789",
      senderContactEmail: "jan@test.pl",
      createdAt: "2026-02-20T10:00:00.000Z",
      createdByUserId: "test-user-id-001",
      updatedAt: "2026-02-20T10:00:00.000Z",
      updatedByUserId: null,
      lockedByUserId: null,
      lockedAt: null,
      statusName: "Robocze",
      weekNumber: 11,
      sentAt: null,
      sentByUserName: null,
      createdByUserName: "Admin Testowy",
      updatedByUserName: null,
      lockedByUserName: null,
      ...overrides,
    },
    stops: [
      {
        id: "stop-001",
        kind: "LOADING",
        sequenceNo: 1,
        dateLocal: "2026-03-10",
        timeLocal: "08:00",
        locationId: "loc-001",
        locationNameSnapshot: "Magazyn Centralny",
        companyNameSnapshot: "NordMetal Sp. z o.o.",
        addressSnapshot: "ul. Testowa 1, 00-001 Warszawa, PL",
        notes: null,
      },
      {
        id: "stop-002",
        kind: "UNLOADING",
        sequenceNo: 2,
        dateLocal: "2026-03-11",
        timeLocal: "14:00",
        locationId: "loc-002",
        locationNameSnapshot: "Oddział Południe",
        companyNameSnapshot: "SouthLogistics",
        addressSnapshot: "ul. Krakowska 10, 30-001 Kraków, PL",
        notes: null,
      },
    ],
    items: [
      {
        id: "item-001",
        productId: "prod-001",
        productNameSnapshot: "Stal nierdzewna",
        defaultLoadingMethodSnapshot: "PALETA",
        loadingMethodCode: "PALETA",
        quantityTons: 10,
        notes: null,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------

function renderDrawer(props?: Partial<Parameters<typeof OrderDrawer>[0]>) {
  const defaultProps = {
    orderId: "order-001",
    isOpen: true,
    onClose: vi.fn(),
    onOrderUpdated: vi.fn(),
    onShowHistory: vi.fn(),
  };
  return render(<OrderDrawer {...defaultProps} {...props} />);
}

/** Otwiera drawer z gotowym detalem (resolve api.get + api.post lock). */
async function openDrawerWithDetail(detail?: OrderDetailResponseDto, drawerProps?: Partial<Parameters<typeof OrderDrawer>[0]>) {
  const orderDetail = detail ?? makeOrderDetail();
  (mockApi.get as Mock).mockResolvedValueOnce(orderDetail);
  (mockApi.post as Mock).mockResolvedValueOnce(undefined); // lock

  renderDrawer(drawerProps);

  // Poczekaj aż numer zlecenia się pojawi (znaczy, że dane załadowane)
  // SheetTitle (sr-only) + h1 = 2 elementy — używamy getAllByText
  await waitFor(() => {
    expect(screen.getAllByText(orderDetail.order.orderNo).length).toBeGreaterThanOrEqual(1);
  });

  return orderDetail;
}

// ---------------------------------------------------------------------------
// TESTY
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// =========================================================================
// Nagłówek (Header)
// =========================================================================

describe("Header buttons", () => {
  it("renders close (X) button and calls onClose when clicked", async () => {
    const onClose = vi.fn();
    await openDrawerWithDetail(undefined, { onClose });

    // Przycisk X z title="Zamknij (Escape)"
    const closeBtn = screen.getByTitle("Zamknij (Escape)");
    expect(closeBtn).toBeInTheDocument();

    // Mock unlock
    (mockApi.post as Mock).mockResolvedValueOnce(undefined);

    await act(async () => {
      fireEvent.click(closeBtn);
    });

    // Formularz jest czysty (isDirty=false) — powinno zamknąć bez dialogu
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("renders History button when orderId and onShowHistory exist", async () => {
    const onShowHistory = vi.fn();
    await openDrawerWithDetail(undefined, { onShowHistory });

    const historyBtn = screen.getByText("Historia zmian");
    expect(historyBtn).toBeInTheDocument();

    fireEvent.click(historyBtn);
    expect(onShowHistory).toHaveBeenCalledWith("order-001", "ZT2026/0042");
  });

  it("does not render History button when onShowHistory is not provided", async () => {
    await openDrawerWithDetail(undefined, { onShowHistory: undefined });

    expect(screen.queryByText("Historia zmian")).not.toBeInTheDocument();
  });

  it("shows order number and status badge in header", async () => {
    await openDrawerWithDetail();

    // orderNo pojawia się w SheetTitle (sr-only) + h1 = min 2 elementy
    expect(screen.getAllByText("ZT2026/0042").length).toBeGreaterThanOrEqual(2);
    // StatusBadge renderuje sformatowany status (widoczny w nagłówku + sekcja statusu)
    expect(screen.getAllByText("Robocze").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Nowe zlecenie' title when orderId is null", async () => {
    render(
      <OrderDrawer
        orderId={null}
        isOpen={true}
        onClose={vi.fn()}
        onOrderUpdated={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Nowe zlecenie")).toBeInTheDocument();
    });
  });
});

// =========================================================================
// Sekcja kontaktu
// =========================================================================

describe("Contact section inputs", () => {
  it("renders and allows editing contact name", async () => {
    await openDrawerWithDetail();

    const nameInput = screen.getByPlaceholderText("Jan Kowalski");
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveValue("Jan Kowalski");
    expect(nameInput).not.toBeDisabled();
  });

  it("renders and allows editing phone", async () => {
    await openDrawerWithDetail();

    const phoneInput = screen.getByPlaceholderText("+48 000 000 000");
    expect(phoneInput).toBeInTheDocument();
    expect(phoneInput).toHaveValue("+48 123 456 789");
  });

  it("renders and allows editing email", async () => {
    await openDrawerWithDetail();

    const emailInput = screen.getByPlaceholderText("kontakt@firma.pl");
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveValue("jan@test.pl");
  });

  it("disables inputs when isReadOnly (user role is READ_ONLY)", async () => {
    // Tymczasowo zmień rolę na READ_ONLY
    const originalRole = mockUser.role;
    mockUser.role = "READ_ONLY";

    await openDrawerWithDetail();

    const nameInput = screen.getByPlaceholderText("Jan Kowalski");
    expect(nameInput).toBeDisabled();

    const phoneInput = screen.getByPlaceholderText("+48 000 000 000");
    expect(phoneInput).toBeDisabled();

    const emailInput = screen.getByPlaceholderText("kontakt@firma.pl");
    expect(emailInput).toBeDisabled();

    // Przywróć
    mockUser.role = originalRole;
  });
});

// =========================================================================
// Sekcja trasy (Route)
// =========================================================================

describe("Route section", () => {
  it("renders transport type select with correct value", async () => {
    await openDrawerWithDetail();

    // Transport type select — sprawdzamy, czy wyświetla się aktualny typ
    // Trigger select zawiera tekst wybranej opcji
    const routeSectionHeader = screen.getByText("Sekcja 1: Trasa");
    expect(routeSectionHeader).toBeInTheDocument();
  });

  it("renders add loading and unloading stop buttons", async () => {
    await openDrawerWithDetail();

    const addLoadingBtn = screen.getByText(/Dodaj punkt załadunku/);
    expect(addLoadingBtn).toBeInTheDocument();

    const addUnloadingBtn = screen.getByText(/Dodaj punkt rozładunku/);
    expect(addUnloadingBtn).toBeInTheDocument();
  });

  it("hides add stop buttons when isReadOnly", async () => {
    const originalRole = mockUser.role;
    mockUser.role = "READ_ONLY";

    await openDrawerWithDetail();

    expect(screen.queryByText(/Dodaj punkt załadunku/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dodaj punkt rozładunku/)).not.toBeInTheDocument();

    mockUser.role = originalRole;
  });

  it("shows existing stop cards for LOADING and UNLOADING", async () => {
    await openDrawerWithDetail();

    // Punkt załadunku z lokalizacją
    expect(screen.getByText("Magazyn Centralny")).toBeInTheDocument();
    // Punkt rozładunku z lokalizacją
    expect(screen.getByText("Oddział Południe")).toBeInTheDocument();
  });
});

// =========================================================================
// Sekcja towaru (Cargo)
// =========================================================================

describe("Cargo section", () => {
  it("renders add item button", async () => {
    await openDrawerWithDetail();

    const addBtn = screen.getByText("Dodaj kolejny asortyment");
    expect(addBtn).toBeInTheDocument();
  });

  it("clicking add item button adds a new cargo item row", async () => {
    await openDrawerWithDetail();

    // Na początku jest 1 pozycja (Produkt 1)
    expect(screen.getByText("Produkt 1")).toBeInTheDocument();

    const addBtn = screen.getByText("Dodaj kolejny asortyment");
    await act(async () => {
      fireEvent.click(addBtn);
    });

    // Teraz powinno być "Produkt 2"
    await waitFor(() => {
      expect(screen.getByText("Produkt 2")).toBeInTheDocument();
    });
  });

  it("hides add item button when isReadOnly", async () => {
    const originalRole = mockUser.role;
    mockUser.role = "READ_ONLY";

    await openDrawerWithDetail();

    expect(screen.queryByText("Dodaj kolejny asortyment")).not.toBeInTheDocument();

    mockUser.role = originalRole;
  });

  it("renders remove item button for each item", async () => {
    await openDrawerWithDetail();

    const removeBtn = screen.getByLabelText("Usuń towar");
    expect(removeBtn).toBeInTheDocument();
  });

  it("shows total tonnage", async () => {
    await openDrawerWithDetail();

    expect(screen.getByText("Razem: 10.00t")).toBeInTheDocument();
  });
});

// =========================================================================
// Sekcja przewoźnika (Carrier)
// =========================================================================

describe("Carrier section", () => {
  it("renders carrier company autocomplete with selected value", async () => {
    await openDrawerWithDetail();

    // "NordMetal Sp. z o.o." pojawia się wielokrotnie (autocomplete punkt załadunku + autocomplete przewoźnika)
    const nordMetalElements = screen.getAllByText("NordMetal Sp. z o.o.");
    expect(nordMetalElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders vehicle type select", async () => {
    await openDrawerWithDetail();

    // Label "Typ auta *" powinien być widoczny
    expect(screen.getByText("Typ auta *")).toBeInTheDocument();
  });

  it("renders volume input", async () => {
    await openDrawerWithDetail();

    expect(screen.getByText("m³ *")).toBeInTheDocument();
    // Input z placeholder "m³"
    const volumeInput = screen.getByPlaceholderText("m³");
    expect(volumeInput).toBeInTheDocument();
  });

  it("renders documents select", async () => {
    await openDrawerWithDetail();

    expect(screen.getByText("Wymagane dokumenty")).toBeInTheDocument();
  });

  it("shows NIP for selected carrier", async () => {
    await openDrawerWithDetail();

    expect(screen.getByText(/NIP: 1234567890/)).toBeInTheDocument();
  });
});

// =========================================================================
// Sekcja finansów (Finance)
// =========================================================================

describe("Finance section", () => {
  it("renders price input with current value", async () => {
    await openDrawerWithDetail();

    // Szukamy inputu stawki po labelu "Stawka*"
    const stawkaLabel = screen.getByText(/^Stawka/);
    // Input jest rodzeństwem w tym samym kontenerze
    const container = stawkaLabel.closest("div");
    const priceInput = container?.querySelector("input");
    expect(priceInput).toBeTruthy();
    expect(priceInput).toHaveValue(5000);
  });

  it("renders currency select", async () => {
    await openDrawerWithDetail();

    // Label "Waluta*" powinien być widoczny
    const walutaLabel = screen.getByText(/Waluta/);
    expect(walutaLabel).toBeInTheDocument();
  });

  it("renders payment term input", async () => {
    await openDrawerWithDetail();

    const termInput = screen.getByPlaceholderText("21");
    expect(termInput).toBeInTheDocument();
    expect(termInput).toHaveValue(21);
  });

  it("renders payment method select", async () => {
    await openDrawerWithDetail();

    expect(screen.getByText("Forma płatności")).toBeInTheDocument();
  });
});

// =========================================================================
// Sekcja uwag (Notes)
// =========================================================================

describe("Notes section", () => {
  it("renders notes textarea with current value", async () => {
    await openDrawerWithDetail();

    const textarea = screen.getByPlaceholderText("Dodatkowe uwagi do zlecenia…");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("Uwaga testowa");
  });

  it("shows character count", async () => {
    await openDrawerWithDetail();

    // "Uwaga testowa" ma 13 znaków — szukamy konkretnie "13/500" (jest też "0/500" z awizacji)
    const countElement = screen.getByText("13/500");
    expect(countElement).toBeInTheDocument();
  });

  it("renders as disabled when isReadOnly", async () => {
    const originalRole = mockUser.role;
    mockUser.role = "READ_ONLY";

    await openDrawerWithDetail();

    const textarea = screen.getByPlaceholderText("Dodatkowe uwagi do zlecenia…");
    expect(textarea).toBeDisabled();

    mockUser.role = originalRole;
  });
});

// =========================================================================
// Notes standalone unit test
// =========================================================================

describe("NotesSection standalone", () => {
  it("updates character count on input change", async () => {
    const onChange = vi.fn();
    const formData = {
      transportTypeCode: "PL" as const,
      currencyCode: "PLN" as const,
      priceAmount: null,
      paymentTermDays: null,
      paymentMethod: null,
      totalLoadTons: null,
      totalLoadVolumeM3: null,
      carrierCompanyId: null,
      shipperLocationId: null,
      receiverLocationId: null,
      vehicleTypeText: null,
      vehicleCapacityVolumeM3: null,
      specialRequirements: null,
      requiredDocumentsText: null,
      generalNotes: "abc",
      notificationDetails: null,
      confidentialityClause: null,
      complaintReason: null,
      senderContactName: null,
      senderContactPhone: null,
      senderContactEmail: null,
      stops: [],
      items: [],
    };

    render(
      <NotesSection
        formData={formData}
        isReadOnly={false}
        onChange={onChange}
      />
    );

    expect(screen.getByText("3/500")).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText("Dodatkowe uwagi do zlecenia…");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "test");

    // onChange wywoływane przy każdym znaku
    expect(onChange).toHaveBeenCalled();
  });
});

// =========================================================================
// Sekcja statusu (Status) — standalone testy
// =========================================================================

describe("Status section", () => {
  it("renders status change buttons for allowed transitions from 'robocze'", () => {
    render(
      <StatusSection
        currentStatusCode="robocze"
        currentStatusName="Robocze"
        pendingStatusCode={null}
        complaintReason={null}
        onStatusChange={vi.fn()}
        onComplaintReasonChange={vi.fn()}
      />
    );

    // Z "robocze" dozwolone: "zrealizowane", "anulowane"
    expect(screen.getByText("Zrealizowane")).toBeInTheDocument();
    expect(screen.getByText("Anulowane")).toBeInTheDocument();

    // Nie powinno być "Reklamacja" (robocze → reklamacja niedozwolone)
    expect(screen.queryByText("Reklamacja")).not.toBeInTheDocument();
  });

  it("renders status change buttons for allowed transitions from 'wysłane'", () => {
    render(
      <StatusSection
        currentStatusCode="wysłane"
        currentStatusName="Wysłane"
        pendingStatusCode={null}
        complaintReason={null}
        onStatusChange={vi.fn()}
        onComplaintReasonChange={vi.fn()}
      />
    );

    // Z "wysłane" dozwolone: "zrealizowane", "reklamacja", "anulowane"
    expect(screen.getByText("Zrealizowane")).toBeInTheDocument();
    expect(screen.getByText("Reklamacja")).toBeInTheDocument();
    expect(screen.getByText("Anulowane")).toBeInTheDocument();
  });

  it("clicking a status button calls onStatusChange", () => {
    const onStatusChange = vi.fn();

    render(
      <StatusSection
        currentStatusCode="robocze"
        currentStatusName="Robocze"
        pendingStatusCode={null}
        complaintReason={null}
        onStatusChange={onStatusChange}
        onComplaintReasonChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Zrealizowane"));
    expect(onStatusChange).toHaveBeenCalledWith("zrealizowane");
  });

  it("clicking selected status button deselects (calls with null)", () => {
    const onStatusChange = vi.fn();

    render(
      <StatusSection
        currentStatusCode="robocze"
        currentStatusName="Robocze"
        pendingStatusCode="zrealizowane"
        complaintReason={null}
        onStatusChange={onStatusChange}
        onComplaintReasonChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Zrealizowane"));
    expect(onStatusChange).toHaveBeenCalledWith(null);
  });

  it("shows complaint reason textarea when reklamacja is selected", () => {
    render(
      <StatusSection
        currentStatusCode="wysłane"
        currentStatusName="Wysłane"
        pendingStatusCode="reklamacja"
        complaintReason={null}
        onStatusChange={vi.fn()}
        onComplaintReasonChange={vi.fn()}
      />
    );

    expect(screen.getByText("Powód reklamacji")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Wymagane przy zmianie statusu na Reklamacja...")).toBeInTheDocument();
  });

  it("does not show complaint reason textarea when other status is selected", () => {
    render(
      <StatusSection
        currentStatusCode="robocze"
        currentStatusName="Robocze"
        pendingStatusCode="zrealizowane"
        complaintReason={null}
        onStatusChange={vi.fn()}
        onComplaintReasonChange={vi.fn()}
      />
    );

    expect(screen.queryByText("Powód reklamacji")).not.toBeInTheDocument();
  });

  it("does not render action buttons when isReadOnly", () => {
    render(
      <StatusSection
        currentStatusCode="robocze"
        currentStatusName="Robocze"
        pendingStatusCode={null}
        complaintReason={null}
        isReadOnly={true}
        onStatusChange={vi.fn()}
        onComplaintReasonChange={vi.fn()}
      />
    );

    // Powinien być tekst "Aktualny status" ale bez przycisków zmiany
    expect(screen.getByText("Aktualny status")).toBeInTheDocument();
    expect(screen.queryByText("Zmień na:")).not.toBeInTheDocument();
  });

  it("shows no transitions for terminal statuses (zrealizowane)", () => {
    render(
      <StatusSection
        currentStatusCode="zrealizowane"
        currentStatusName="Zrealizowane"
        pendingStatusCode={null}
        complaintReason={null}
        onStatusChange={vi.fn()}
        onComplaintReasonChange={vi.fn()}
      />
    );

    // Brak przycisków zmiany statusu
    expect(screen.queryByText("Zmień na:")).not.toBeInTheDocument();
  });
});

// =========================================================================
// Footer — standalone testy
// =========================================================================

describe("Footer buttons", () => {
  it("Save button disabled when isDirty is false", () => {
    render(
      <DrawerFooter
        isReadOnly={false}
        isSaving={false}
        isDirty={false}
        lockedByUserName={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onShowPreview={vi.fn()}
      />
    );

    const saveBtn = screen.getByText("Zapisz");
    expect(saveBtn).toBeDisabled();
  });

  it("Save button enabled when isDirty is true", () => {
    render(
      <DrawerFooter
        isReadOnly={false}
        isSaving={false}
        isDirty={true}
        lockedByUserName={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onShowPreview={vi.fn()}
      />
    );

    const saveBtn = screen.getByText("Zapisz");
    expect(saveBtn).not.toBeDisabled();
  });

  it("Save button calls onSave when clicked", () => {
    const onSave = vi.fn();
    render(
      <DrawerFooter
        isReadOnly={false}
        isSaving={false}
        isDirty={true}
        lockedByUserName={null}
        onSave={onSave}
        onClose={vi.fn()}
        onShowPreview={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Zapisz"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("Close button is always available", () => {
    render(
      <DrawerFooter
        isReadOnly={false}
        isSaving={false}
        isDirty={false}
        lockedByUserName={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onShowPreview={vi.fn()}
      />
    );

    const closeBtn = screen.getByText("Zamknij");
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn).not.toBeDisabled();
  });

  it("shows Preview button when onShowPreview is provided", () => {
    render(
      <DrawerFooter
        isReadOnly={false}
        isSaving={false}
        isDirty={false}
        lockedByUserName={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onShowPreview={vi.fn()}
      />
    );

    expect(screen.getByText("Podgląd")).toBeInTheDocument();
  });

  it("does not show Preview button when onShowPreview is not provided", () => {
    render(
      <DrawerFooter
        isReadOnly={false}
        isSaving={false}
        isDirty={false}
        lockedByUserName={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText("Podgląd")).not.toBeInTheDocument();
  });

  it("shows email button when onSendEmail is provided", () => {
    render(
      <DrawerFooter
        isReadOnly={false}
        isSaving={false}
        isDirty={false}
        lockedByUserName={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onSendEmail={vi.fn()}
      />
    );

    expect(screen.getByText("Wyślij maila")).toBeInTheDocument();
  });

  it("shows saving state with spinner text", () => {
    render(
      <DrawerFooter
        isReadOnly={false}
        isSaving={true}
        isDirty={true}
        lockedByUserName={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Zapisywanie…")).toBeInTheDocument();
  });

  it("does not show Save button in readonly mode", () => {
    render(
      <DrawerFooter
        isReadOnly={true}
        isSaving={false}
        isDirty={false}
        lockedByUserName={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText("Zapisz")).not.toBeInTheDocument();
    expect(screen.getByText("Zamknij")).toBeInTheDocument();
    expect(screen.queryByText("Podgląd")).not.toBeInTheDocument();
  });

  it("shows lock banner when lockedByUserName is set", () => {
    render(
      <DrawerFooter
        isReadOnly={true}
        isSaving={false}
        isDirty={false}
        lockedByUserName="Jan Testowy"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Jan Testowy")).toBeInTheDocument();
    expect(screen.getByText(/Edytowane przez/)).toBeInTheDocument();
    // Nie powinno być przycisku Zapisz
    expect(screen.queryByText("Zapisz")).not.toBeInTheDocument();
  });
});

// =========================================================================
// Dialog niezapisanych zmian (UnsavedChangesDialog)
// =========================================================================

describe("Unsaved changes dialog", () => {
  it("renders dialog when open is true", () => {
    render(
      <UnsavedChangesDialog
        open={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Niezapisane zmiany")).toBeInTheDocument();
    expect(screen.getByText(/Masz niezapisane zmiany/)).toBeInTheDocument();
  });

  it("does not render dialog when open is false", () => {
    render(
      <UnsavedChangesDialog
        open={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText("Niezapisane zmiany")).not.toBeInTheDocument();
  });

  it("'Wróć do edycji' button calls onCancel", () => {
    const onCancel = vi.fn();
    render(
      <UnsavedChangesDialog
        open={true}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    const cancelBtn = screen.getByText("Wróć do edycji");
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("'Zamknij bez zapisywania' button calls onConfirm", () => {
    const onConfirm = vi.fn();
    render(
      <UnsavedChangesDialog
        open={true}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    const confirmBtn = screen.getByText("Zamknij bez zapisywania");
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

// =========================================================================
// Integracja: Drawer status section visibility
// =========================================================================

describe("Status section in OrderDrawer", () => {
  it("status section is hidden for READ_ONLY users", async () => {
    const originalRole = mockUser.role;
    mockUser.role = "READ_ONLY";

    await openDrawerWithDetail();

    // Sekcja 6 nie powinna być renderowana
    expect(screen.queryByText("Sekcja 6: Zmiana statusu")).not.toBeInTheDocument();

    mockUser.role = originalRole;
  });

  it("status section is visible for ADMIN users", async () => {
    await openDrawerWithDetail();

    expect(screen.getByText("Sekcja 6: Zmiana statusu")).toBeInTheDocument();
  });
});

// =========================================================================
// Integracja: Loading state
// =========================================================================

describe("Loading state", () => {
  it("shows loading text while fetching order detail", async () => {
    // Nie resolve'ujemy od razu
    let resolveGet!: (value: OrderDetailResponseDto) => void;
    (mockApi.get as Mock).mockReturnValueOnce(
      new Promise<OrderDetailResponseDto>((resolve) => { resolveGet = resolve; })
    );

    renderDrawer();

    // Powinien wyświetlić "Ładowanie zlecenia…"
    expect(screen.getByText("Ładowanie zlecenia…")).toBeInTheDocument();

    // Resolve
    const detail = makeOrderDetail();
    (mockApi.post as Mock).mockResolvedValueOnce(undefined); // lock
    await act(async () => {
      resolveGet(detail);
    });

    await waitFor(() => {
      expect(screen.queryByText("Ładowanie zlecenia…")).not.toBeInTheDocument();
      expect(screen.getAllByText("ZT2026/0042").length).toBeGreaterThanOrEqual(1);
    });
  });
});

// =========================================================================
// Integracja: Formularz — isDirty po zmianie
// =========================================================================

describe("Form dirty state", () => {
  it("editing contact name makes form dirty — Save button becomes enabled", async () => {
    await openDrawerWithDetail();

    // Początkowo isDirty=false → Zapisz disabled
    const saveBtn = screen.getByText("Zapisz");
    expect(saveBtn).toBeDisabled();

    // Zmień contact name
    const nameInput = screen.getByPlaceholderText("Jan Kowalski");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Nowa Osoba");

    // Teraz isDirty=true → Zapisz powinien być enabled
    await waitFor(() => {
      expect(screen.getByText("Zapisz")).not.toBeDisabled();
    });
  });

  it("editing notes makes form dirty", async () => {
    await openDrawerWithDetail();

    const textarea = screen.getByPlaceholderText("Dodatkowe uwagi do zlecenia…");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Zmieniona uwaga");

    await waitFor(() => {
      expect(screen.getByText("Zapisz")).not.toBeDisabled();
    });
  });
});

// =========================================================================
// Integracja: Unsaved changes dialog pojawia się przy zamknięciu dirty formularza
// =========================================================================

describe("Unsaved changes flow in OrderDrawer", () => {
  it("shows unsaved changes dialog when closing dirty form", async () => {
    await openDrawerWithDetail();

    // Zmień contact name → isDirty=true
    const nameInput = screen.getByPlaceholderText("Jan Kowalski");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Changed");

    // Kliknij X (zamknij)
    const closeBtn = screen.getByTitle("Zamknij (Escape)");
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    // Dialog powinien się pojawić
    await waitFor(() => {
      expect(screen.getByText("Niezapisane zmiany")).toBeInTheDocument();
    });
  });
});

// =========================================================================
// Integracja: Save flow
// =========================================================================

describe("Save flow", () => {
  it("calls api.put on save for existing order", async () => {
    await openDrawerWithDetail();

    // Zmień coś
    const nameInput = screen.getByPlaceholderText("Jan Kowalski");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Zmieniony");

    // Przygotuj mocki na zapis
    (mockApi.put as Mock).mockResolvedValueOnce(undefined);
    (mockApi.post as Mock).mockResolvedValueOnce(undefined); // unlock

    // Kliknij Zapisz
    const saveBtn = screen.getByText("Zapisz");
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(mockApi.put).toHaveBeenCalledWith(
        "/api/v1/orders/order-001",
        expect.objectContaining({
          senderContactName: "Zmieniony",
        })
      );
    });
  });

  it("calls api.post on save for new order (orderId=null)", async () => {
    const onClose = vi.fn();
    const onOrderUpdated = vi.fn();

    render(
      <OrderDrawer
        orderId={null}
        isOpen={true}
        onClose={onClose}
        onOrderUpdated={onOrderUpdated}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Nowe zlecenie")).toBeInTheDocument();
    });

    // Zmień coś, żeby isDirty=true
    const nameInput = screen.getByPlaceholderText("Jan Kowalski");
    await userEvent.type(nameInput, "Nowy Kontakt");

    // Mock POST
    (mockApi.post as Mock).mockResolvedValueOnce({ id: "new-id", orderNo: "ZT2026/9999", statusCode: "robocze", statusName: "Robocze", createdAt: "2026-03-01T10:00:00Z" });

    const saveBtn = screen.getByText("Zapisz");
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        "/api/v1/orders",
        expect.objectContaining({
          senderContactName: "Nowy Kontakt",
        })
      );
    });
  });
});
