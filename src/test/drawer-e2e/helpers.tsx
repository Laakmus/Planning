/**
 * Helpery testowe dla integracyjnych testów OrderDrawer.
 *
 * Zawiera:
 * - createMockApi() — mock klienta API
 * - MockAuthProvider / MockDictionaryProvider — providery kontekstu
 * - makeOrderDetail() / makeOrderDetailDto() — fabryki danych
 * - renderDrawer() — render OrderDrawer z pełnymi providerami
 */

import { createContext, useContext, type ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { Toaster } from "sonner";
import { vi, type Mock } from "vitest";

import type {
  AuthMeDto,
  CompanyDto,
  LocationDto,
  ProductDto,
  TransportTypeDto,
  OrderStatusDto,
  VehicleVariantDto,
  OrderDetailResponseDto,
  OrderDetailDto,
  OrderStopDto,
  OrderItemDto,
} from "@/types";
import type { DictionaryState } from "@/lib/view-models";
import type { ApiClient } from "@/lib/api-client";

// Reimportujemy OrderDrawer (komponent testowany)
import { OrderDrawer } from "@/components/orders/drawer/OrderDrawer";

// ---------------------------------------------------------------------------
// 1. Mock API Client
// ---------------------------------------------------------------------------

/** Typ mockowanego ApiClient — każda metoda to vi.fn(). */
export interface MockApi {
  get: Mock;
  post: Mock;
  put: Mock;
  patch: Mock;
  delete: Mock;
  postRaw: Mock;
}

/** Tworzy mockowany obiekt ApiClient z vi.fn() dla każdej metody. */
export function createMockApi(): MockApi {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postRaw: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// 2. Mock Auth Provider
// ---------------------------------------------------------------------------

/** Domyślny użytkownik testowy (ADMIN). */
export const TEST_USER: AuthMeDto = {
  id: "test-user-id",
  email: "admin@test.pl",
  fullName: "Admin Test",
  phone: null,
  role: "ADMIN",
};

/**
 * Kształt kontekstu Auth — odtwarzamy interfejs AuthContextValue
 * bez importowania go bezpośrednio (jest nieeksportowany w AuthContext.tsx).
 */
interface MockAuthContextValue {
  user: AuthMeDto | null;
  isLoading: boolean;
  api: ApiClient;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthMeDto | null>;
}

/**
 * Tworzymy osobny kontekst, który podmieniamy w providerze.
 * Dzięki temu OrderDrawer (i jego dzieci) korzystające z useAuth()
 * dostaną nasze mocki.
 *
 * WAŻNE: Korzystamy z tego samego kontekstu co produkcyjny AuthProvider.
 * Robimy to przez monkey-patch modułu — patrz poniżej.
 */

// Ponieważ AuthContext jest tworzony wewnątrz modułu i nieeksportowany,
// mockujemy cały moduł @/contexts/AuthContext w testach za pomocą vi.mock.
// Ten provider jest wrapperem zapewniającym odpowiednie wartości.

interface MockAuthProviderProps {
  children: ReactNode;
  user?: AuthMeDto | null;
  mockApi?: MockApi;
}

/**
 * MockAuthProvider — udostępnia useAuth() z mockowymi wartościami.
 *
 * UWAGA: Aby to zadziałało, testy muszą zamockować moduł AuthContext:
 * ```
 * vi.mock("@/contexts/AuthContext", async () => {
 *   const helpers = await import("@/test/drawer-e2e/helpers");
 *   return helpers.authContextMock;
 * });
 * ```
 * Alternatywnie — ten provider nadpisuje kontekst React bezpośrednio.
 */

// Tworzymy własny kontekst, którego użyją testy
const MockAuthContext = createContext<MockAuthContextValue | null>(null);

export function MockAuthProvider({
  children,
  user = TEST_USER,
  mockApi,
}: MockAuthProviderProps) {
  const api = (mockApi ?? createMockApi()) as unknown as ApiClient;

  const value: MockAuthContextValue = {
    user,
    isLoading: false,
    api,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(user),
  };

  return (
    <MockAuthContext.Provider value={value}>
      {children}
    </MockAuthContext.Provider>
  );
}

/** Hook mockowy — do użycia w vi.mock zastępującym useAuth. */
export function useMockAuth(): MockAuthContextValue {
  const ctx = useContext(MockAuthContext);
  if (!ctx) {
    throw new Error(
      "useMockAuth() musi być używany wewnątrz <MockAuthProvider>",
    );
  }
  return ctx;
}

/**
 * Obiekt eksportowany do vi.mock("@/contexts/AuthContext", ...).
 * Zastępuje produkcyjny moduł AuthContext naszym mockiem.
 */
export const authContextMock = {
  AuthProvider: MockAuthProvider,
  useAuth: useMockAuth,
};

// ---------------------------------------------------------------------------
// 3. Mock Dictionary Provider
// ---------------------------------------------------------------------------

// Realistyczne dane słownikowe z seed.sql

export const MOCK_COMPANIES: CompanyDto[] = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    name: "NordMetal Sp. z o.o.",
    type: "INTERNAL",
    taxId: "5270001001",
    isActive: true,
    erpId: null,
    notes: null,
  },
  {
    id: "a0000000-0000-0000-0000-000000000002",
    name: "Recykling Plus S.A.",
    type: "INTERNAL",
    taxId: "5270002002",
    isActive: true,
    erpId: null,
    notes: null,
  },
  {
    id: "a0000000-0000-0000-0000-000000000003",
    name: "TransBud Logistyka",
    type: "CARRIER",
    taxId: "6340003003",
    isActive: true,
    erpId: null,
    notes: null,
  },
  {
    id: "a0000000-0000-0000-0000-000000000004",
    name: "SpeedCargo Sp. z o.o.",
    type: "CARRIER",
    taxId: "7250004004",
    isActive: true,
    erpId: null,
    notes: null,
  },
  {
    id: "a0000000-0000-0000-0000-000000000005",
    name: "Huta Silesia S.A.",
    type: "CLIENT",
    taxId: "6310005005",
    isActive: true,
    erpId: null,
    notes: null,
  },
];

export const MOCK_LOCATIONS: LocationDto[] = [
  {
    id: "b0000000-0000-0000-0000-000000000001",
    name: "Magazyn Główny",
    companyId: "a0000000-0000-0000-0000-000000000001",
    companyName: "NordMetal Sp. z o.o.",
    city: "Gdańsk",
    country: "PL",
    streetAndNumber: "ul. Portowa 15",
    postalCode: "80-001",
    isActive: true,
    notes: null,
  },
  {
    id: "b0000000-0000-0000-0000-000000000002",
    name: "Oddział Warszawa",
    companyId: "a0000000-0000-0000-0000-000000000001",
    companyName: "NordMetal Sp. z o.o.",
    city: "Warszawa",
    country: "PL",
    streetAndNumber: "ul. Przemysłowa 42",
    postalCode: "02-001",
    isActive: true,
    notes: null,
  },
  {
    id: "b0000000-0000-0000-0000-000000000003",
    name: "Zakład Recyklingu",
    companyId: "a0000000-0000-0000-0000-000000000002",
    companyName: "Recykling Plus S.A.",
    city: "Katowice",
    country: "PL",
    streetAndNumber: "ul. Hutnicza 8",
    postalCode: "40-001",
    isActive: true,
    notes: null,
  },
];

export const MOCK_PRODUCTS: ProductDto[] = [
  {
    id: "c0000000-0000-0000-0000-000000000001",
    name: "Stal walcowana",
    isActive: true,
    description: "Blachy i zwoje stalowe",
    defaultLoadingMethodCode: "PALETA",
  },
  {
    id: "c0000000-0000-0000-0000-000000000002",
    name: "Złom stalowy",
    isActive: true,
    description: "Złom stalowy do recyklingu",
    defaultLoadingMethodCode: "LUZEM",
  },
];

export const MOCK_VEHICLE_VARIANTS: VehicleVariantDto[] = [
  {
    code: "MEGA_24T",
    name: "Mega 24t",
    vehicleType: "Naczepa mega",
    capacityTons: 24.0,
    capacityVolumeM3: 100.0,
    isActive: true,
    description: "Naczepa mega do 24 ton",
  },
  {
    code: "STAND_24T",
    name: "Standard 24t",
    vehicleType: "Naczepa standard",
    capacityTons: 24.0,
    capacityVolumeM3: 90.0,
    isActive: true,
    description: "Naczepa standard 24 ton",
  },
  {
    code: "SOLO_12T",
    name: "Solo 12t",
    vehicleType: "Samochód solo",
    capacityTons: 12.0,
    capacityVolumeM3: 40.0,
    isActive: true,
    description: "Samochód solo do 12 ton",
  },
];

export const MOCK_TRANSPORT_TYPES: TransportTypeDto[] = [
  { code: "PL", name: "Krajowy", isActive: true, description: "Transport krajowy" },
  { code: "EXP", name: "Eksport drogowy", isActive: true, description: "Eksport drogowy" },
  { code: "EXP_K", name: "Kontener morski", isActive: true, description: "Eksport kontenerowy (kontener morski)" },
  { code: "IMP", name: "Import", isActive: true, description: "Import" },
];

export const MOCK_ORDER_STATUSES: OrderStatusDto[] = [
  { code: "robocze", name: "Robocze", viewGroup: "CURRENT", isEditable: true, sortOrder: 1 },
  { code: "wysłane", name: "Wysłane", viewGroup: "CURRENT", isEditable: false, sortOrder: 2 },
  { code: "korekta", name: "Korekta", viewGroup: "CURRENT", isEditable: true, sortOrder: 3 },
  { code: "korekta wysłane", name: "Korekta_w", viewGroup: "CURRENT", isEditable: false, sortOrder: 4 },
  { code: "zrealizowane", name: "Zrealizowane", viewGroup: "COMPLETED", isEditable: false, sortOrder: 5 },
  { code: "reklamacja", name: "Reklamacja", viewGroup: "CURRENT", isEditable: false, sortOrder: 6 },
  { code: "anulowane", name: "Anulowane", viewGroup: "CANCELLED", isEditable: false, sortOrder: 7 },
];

/** Domyślny stan słowników. */
export const MOCK_DICTIONARY_STATE: DictionaryState = {
  companies: MOCK_COMPANIES,
  locations: MOCK_LOCATIONS,
  products: MOCK_PRODUCTS,
  transportTypes: MOCK_TRANSPORT_TYPES,
  orderStatuses: MOCK_ORDER_STATUSES,
  vehicleVariants: MOCK_VEHICLE_VARIANTS,
  isLoading: false,
  error: null,
};

// Kontekst mockowy słowników
interface MockDictionaryContextValue extends DictionaryState {
  refreshDictionaries: () => Promise<void>;
}

const MockDictionaryContext =
  createContext<MockDictionaryContextValue | null>(null);

interface MockDictionaryProviderProps {
  children: ReactNode;
  overrides?: Partial<DictionaryState>;
}

export function MockDictionaryProvider({
  children,
  overrides,
}: MockDictionaryProviderProps) {
  const state: DictionaryState = { ...MOCK_DICTIONARY_STATE, ...overrides };

  const value: MockDictionaryContextValue = {
    ...state,
    refreshDictionaries: vi.fn().mockResolvedValue(undefined),
  };

  return (
    <MockDictionaryContext.Provider value={value}>
      {children}
    </MockDictionaryContext.Provider>
  );
}

/** Hook mockowy — do użycia w vi.mock zastępującym useDictionaries. */
export function useMockDictionaries(): MockDictionaryContextValue {
  const ctx = useContext(MockDictionaryContext);
  if (!ctx) {
    throw new Error(
      "useMockDictionaries() musi być używany wewnątrz <MockDictionaryProvider>",
    );
  }
  return ctx;
}

/**
 * Obiekt eksportowany do vi.mock("@/contexts/DictionaryContext", ...).
 * Zastępuje produkcyjny moduł DictionaryContext naszym mockiem.
 */
export const dictionaryContextMock = {
  DictionaryProvider: MockDictionaryProvider,
  useDictionaries: useMockDictionaries,
};

// ---------------------------------------------------------------------------
// 4. Factory Functions
// ---------------------------------------------------------------------------

/** Stałe UUID dla danych testowych (spójne z seed.sql). */
export const TEST_ORDER_ID = "d0000000-0000-0000-0000-000000000001";
export const TEST_STOP_LOADING_ID = "s0000000-0000-0000-0000-000000000001";
export const TEST_STOP_UNLOADING_ID = "s0000000-0000-0000-0000-000000000002";
export const TEST_ITEM_ID = "i0000000-0000-0000-0000-000000000001";

/** Tworzy OrderDetailDto (nagłówek zlecenia) z domyślnymi wartościami. */
export function makeOrderDetailDto(
  overrides?: Partial<OrderDetailDto>,
): OrderDetailDto {
  return {
    id: TEST_ORDER_ID,
    orderNo: "ZT2026/0001",
    statusCode: "robocze",
    transportTypeCode: "PL",
    currencyCode: "PLN",
    priceAmount: 4500.0,
    paymentTermDays: 30,
    paymentMethod: "Przelew",
    totalLoadTons: 22.5,
    totalLoadVolumeM3: null,
    summaryRoute: "Gdańsk → Katowice",
    firstLoadingDate: "2026-02-20",
    firstLoadingTime: "08:00",
    firstUnloadingDate: "2026-02-21",
    firstUnloadingTime: "14:00",
    lastLoadingDate: "2026-02-20",
    lastLoadingTime: "08:00",
    lastUnloadingDate: "2026-02-21",
    lastUnloadingTime: "14:00",
    transportYear: 2026,
    firstLoadingCountry: "PL",
    firstUnloadingCountry: "PL",
    carrierCompanyId: "a0000000-0000-0000-0000-000000000003",
    carrierNameSnapshot: "TransBud Logistyka",
    carrierLocationNameSnapshot: null,
    carrierAddressSnapshot: null,
    shipperLocationId: null,
    shipperNameSnapshot: null,
    shipperAddressSnapshot: null,
    receiverLocationId: null,
    receiverNameSnapshot: null,
    receiverAddressSnapshot: null,
    vehicleTypeText: "MEGA",
    vehicleCapacityVolumeM3: 100,
    mainProductName: "Stal walcowana",
    specialRequirements: null,
    requiredDocumentsText: "WZ, KPO, kwit wagowy",
    generalNotes: "Pilne — dostarczyć przed weekendem",
    confidentialityClause: null,
    complaintReason: null,
    senderContactName: "Anna Nowak",
    senderContactPhone: "+48 601 222 333",
    senderContactEmail: "anna.nowak@nordmetal.pl",
    createdAt: "2026-02-17T10:00:00.000Z",
    createdByUserId: "c94a20d0-16ca-4f9d-873a-05f31be633ff",
    updatedAt: "2026-02-17T10:00:00.000Z",
    updatedByUserId: null,
    lockedByUserId: null,
    lockedAt: null,
    // Pola z JOINów
    statusName: "Robocze",
    weekNumber: 8,
    sentAt: null,
    sentByUserName: null,
    createdByUserName: "Jan Kowalski",
    updatedByUserName: null,
    lockedByUserName: null,
    ...overrides,
  };
}

/** Domyślne punkty trasy (1 załadunek + 1 rozładunek). */
function makeDefaultStops(): OrderStopDto[] {
  return [
    {
      id: TEST_STOP_LOADING_ID,
      kind: "LOADING",
      sequenceNo: 1,
      dateLocal: "2026-02-20",
      timeLocal: "08:00",
      locationId: "b0000000-0000-0000-0000-000000000001",
      locationNameSnapshot: "Magazyn Główny",
      companyNameSnapshot: "NordMetal Sp. z o.o.",
      addressSnapshot: "ul. Portowa 15, 80-001 Gdańsk, PL",
      notes: null,
    },
    {
      id: TEST_STOP_UNLOADING_ID,
      kind: "UNLOADING",
      sequenceNo: 2,
      dateLocal: "2026-02-21",
      timeLocal: "14:00",
      locationId: "b0000000-0000-0000-0000-000000000003",
      locationNameSnapshot: "Zakład Recyklingu",
      companyNameSnapshot: "Recykling Plus S.A.",
      addressSnapshot: "ul. Hutnicza 8, 40-001 Katowice, PL",
      notes: null,
    },
  ];
}

/** Domyślna pozycja towarowa. */
function makeDefaultItems(): OrderItemDto[] {
  return [
    {
      id: TEST_ITEM_ID,
      productId: "c0000000-0000-0000-0000-000000000001",
      productNameSnapshot: "Stal walcowana",
      defaultLoadingMethodSnapshot: "PALETA",
      loadingMethodCode: "PALETA",
      quantityTons: 22.5,
      notes: null,
    },
  ];
}

/**
 * Tworzy pełną odpowiedź OrderDetailResponseDto (order + stops + items).
 * Pozwala nadpisywać poszczególne części.
 */
export function makeOrderDetail(overrides?: {
  order?: Partial<OrderDetailDto>;
  stops?: OrderStopDto[];
  items?: OrderItemDto[];
}): OrderDetailResponseDto {
  return {
    order: makeOrderDetailDto(overrides?.order),
    stops: overrides?.stops ?? makeDefaultStops(),
    items: overrides?.items ?? makeDefaultItems(),
  };
}

// ---------------------------------------------------------------------------
// 5. renderDrawer Helper
// ---------------------------------------------------------------------------

/** Props komponentu OrderDrawer. */
interface OrderDrawerProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
  onShowHistory?: (orderId: string, orderNo: string) => void;
}

interface RenderDrawerOptions {
  /** Mockowy ApiClient — jeśli nie podano, tworzony automatycznie. */
  mockApi?: MockApi;
  /** Nadpisania użytkownika (np. rola READ_ONLY). */
  user?: AuthMeDto | null;
  /** Nadpisania słowników. */
  dictionaryOverrides?: Partial<DictionaryState>;
  /** Dodatkowe opcje renderowania z @testing-library. */
  renderOptions?: Omit<RenderOptions, "wrapper">;
}

/**
 * Renderuje OrderDrawer opakowany we wszystkie potrzebne providery
 * (MockAuthProvider + MockDictionaryProvider + Sonner Toaster).
 *
 * Zwraca mockApi oraz wynik renderowania z @testing-library.
 */
export function renderDrawer(
  props?: Partial<OrderDrawerProps>,
  options?: RenderDrawerOptions,
) {
  const mockApi = options?.mockApi ?? createMockApi();

  // Domyślne props OrderDrawer
  const drawerProps: OrderDrawerProps = {
    orderId: TEST_ORDER_ID,
    isOpen: true,
    onClose: vi.fn(),
    onOrderUpdated: vi.fn(),
    onShowHistory: vi.fn(),
    ...props,
  };

  // Domyślna konfiguracja API mock — GET /api/v1/orders/:id zwraca detail
  if (!mockApi.get.getMockImplementation()) {
    mockApi.get.mockResolvedValue(makeOrderDetail());
  }
  // POST lock domyślnie sukces
  if (!mockApi.post.getMockImplementation()) {
    mockApi.post.mockResolvedValue({ id: drawerProps.orderId, lockedByUserId: "test-user-id", lockedAt: new Date().toISOString() });
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MockAuthProvider user={options?.user ?? TEST_USER} mockApi={mockApi}>
        <MockDictionaryProvider overrides={options?.dictionaryOverrides}>
          {children}
          <Toaster />
        </MockDictionaryProvider>
      </MockAuthProvider>
    );
  }

  const renderResult = render(
    <OrderDrawer {...drawerProps} />,
    {
      wrapper: Wrapper,
      ...options?.renderOptions,
    },
  );

  return {
    mockApi,
    ...renderResult,
    // Eksponujemy props, żeby testy mogły sprawdzać callbacki
    drawerProps,
  };
}
