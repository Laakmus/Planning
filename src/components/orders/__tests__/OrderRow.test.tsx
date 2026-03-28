/**
 * Testy komponentu OrderRow.
 *
 * Pokrywa:
 * - Renderuje dane zlecenia (numer, status, transport, towar, carrier)
 * - Poprawne tło wiersza wg statusu (ROW_BG)
 * - Lock indicator gdy zlecenie zablokowane przez innego użytkownika
 * - onClick wywołuje handler
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { OrderRow } from "../OrderRow";
import type { OrderListItemDto } from "@/types";
import type { ListViewMode, ViewGroup, OrderStatusCode } from "@/lib/view-models";

// ---- Mocki ----

// Mock AuthContext — OrderRow używa useAuth() do porównania lockedByUserId
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "current-user-id", email: "admin@test.pl", fullName: "Admin", role: "ADMIN" },
    api: {},
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

// Mock format-utils — uproszczamy formatowanie dat
vi.mock("@/lib/format-utils", () => ({
  formatDate: (d: string) => d,
  formatDateTimeShort: (d: string | null, t: string | null) => `${d ?? ""} ${t ?? ""}`.trim(),
}));

// Mock sub-komponenty — izolujemy testy OrderRow od złożoności potomnych
vi.mock("../LocationsCell", () => ({
  LocationsCell: ({ kind }: { kind: string }) => (
    <span data-testid={`locations-${kind}`}>{kind}</span>
  ),
  DatesCell: ({ kind }: { kind: string }) => (
    <span data-testid={`dates-${kind}`}>{kind}</span>
  ),
}));

vi.mock("../RouteSummaryCell", () => ({
  RouteSummaryCell: () => <span data-testid="route-summary">Route</span>,
}));

vi.mock("../LockIndicator", () => ({
  LockIndicator: ({ lockedByUserName }: { lockedByUserName: string | null }) =>
    lockedByUserName ? (
      <span data-testid="lock-indicator">{lockedByUserName}</span>
    ) : null,
}));

vi.mock("../StatusBadge", () => ({
  StatusBadge: ({ statusName }: { statusCode: string; statusName: string }) => (
    <span data-testid="status-badge">{statusName}</span>
  ),
}));

// Mock OrderRowContextMenu — przepuszczamy dzieci w table-compatible wrapperze
vi.mock("../OrderRowContextMenu", () => ({
  OrderRowContextMenu: ({ children }: { children: React.ReactNode }) => children,
}));

// ---- Cleanup ----
beforeEach(() => {
  cleanup();
});
afterEach(() => {
  cleanup();
});

// ---- Fixtures ----

function makeOrder(overrides: Partial<OrderListItemDto> = {}): OrderListItemDto {
  return {
    id: "order-1",
    orderNo: "ZL/2026/001",
    statusCode: "robocze",
    statusName: "Robocze",
    viewGroup: "CURRENT",
    transportTypeCode: "PL",
    transportTypeName: "Krajowy",
    summaryRoute: null,
    stops: [
      { kind: "LOADING", sequenceNo: 1, companyNameSnapshot: "Firma A", locationNameSnapshot: "Lokacja A", dateLocal: "2026-03-10", timeLocal: "08:00" },
      { kind: "UNLOADING", sequenceNo: 2, companyNameSnapshot: "Firma B", locationNameSnapshot: "Lokacja B", dateLocal: "2026-03-11", timeLocal: "14:00" },
    ],
    firstLoadingDate: "2026-03-10",
    firstLoadingTime: "08:00",
    firstUnloadingDate: "2026-03-11",
    firstUnloadingTime: "14:00",
    lastLoadingDate: null,
    lastLoadingTime: null,
    lastUnloadingDate: null,
    lastUnloadingTime: null,
    weekNumber: 10,
    carrierCompanyId: "carrier-1",
    carrierName: "Transport Sp. z o.o.",
    mainProductName: "Piasek",
    items: [
      { productNameSnapshot: "Piasek", quantityTons: 25, loadingMethodCode: "PALETA", notes: null },
    ],
    priceAmount: 1500,
    currencyCode: "PLN",
    vehicleTypeText: "Wywrotka",
    vehicleCapacityVolumeM3: 30,
    requiredDocumentsText: "WZ",
    generalNotes: null,
    sentByUserName: null,
    sentAt: null,
    lockedByUserId: null,
    lockedByUserName: null,
    lockedAt: null,
    createdAt: "2026-03-01T10:00:00Z",
    createdByUserId: "user-1",
    createdByUserName: "Jan Kowalski",
    updatedAt: "2026-03-01T10:00:00Z",
    updatedByUserId: null,
    updatedByUserName: null,
    carrierCellColor: null,
    isEntryFixed: null,
    ...overrides,
  };
}

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    viewMode: "route" as ListViewMode,
    activeView: "CURRENT" as ViewGroup,
    onRowClick: vi.fn(),
    onSendEmail: vi.fn(),
    onShowHistory: vi.fn(),
    onChangeStatus: vi.fn() as (orderId: string, orderNo: string, newStatus: OrderStatusCode) => void,
    onDuplicate: vi.fn() as (orderId: string, orderNo: string) => void,
    onCancel: vi.fn() as (orderId: string, orderNo: string) => void,
    onRestore: vi.fn() as (orderId: string, orderNo: string) => void,
    onSetCarrierColor: vi.fn(),
    onSetEntryFixed: vi.fn(),
    ...overrides,
  };
}

let renderCounter = 0;

function renderOrderRow(orderOverrides: Partial<OrderListItemDto> = {}, propsOverrides: Record<string, unknown> = {}) {
  const order = makeOrder(orderOverrides);
  const props = makeProps(propsOverrides);
  renderCounter++;
  // Renderujemy w table/tbody bo OrderRow zwraca <tr>
  // Unique key wymusza nowy mount
  const result = render(
    <table key={`table-${renderCounter}`}>
      <tbody>
        <OrderRow order={order} {...props} />
      </tbody>
    </table>
  );
  return { ...result, props, order };
}

// ---- Testy ----

describe("OrderRow", () => {
  it("renderuje numer zlecenia", () => {
    renderOrderRow();
    expect(screen.getByText("ZL/2026/001")).toBeInTheDocument();
  });

  it("renderuje StatusBadge z poprawną nazwą", () => {
    renderOrderRow();
    expect(screen.getByTestId("status-badge")).toHaveTextContent("Robocze");
  });

  it("renderuje numer tygodnia", () => {
    renderOrderRow({ weekNumber: 10 });
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renderuje '—' gdy brak numeru tygodnia", () => {
    const { container } = renderOrderRow({ weekNumber: null });
    // Szukamy znaku em dash w komórce z text-center (kolumna Tydzień)
    const cells = container.querySelectorAll("td");
    const weekCell = Array.from(cells).find(td => td.textContent === "\u2014" && td.className.includes("text-center"));
    expect(weekCell).toBeTruthy();
  });

  it("renderuje kod rodzaju transportu", () => {
    const { container } = renderOrderRow({ transportTypeCode: "EXP" });
    expect(container.textContent).toContain("EXP");
  });

  it("renderuje nazwę firmy transportowej", () => {
    const { container } = renderOrderRow({ carrierName: "Trans-Kop Sp. z o.o." });
    expect(container.textContent).toContain("Trans-Kop Sp. z o.o.");
  });

  it("renderuje '—' gdy brak firmy transportowej", () => {
    const { container } = renderOrderRow({ carrierName: null });
    // Wiele komórek może wyświetlać em dash
    expect(container.textContent).toContain("\u2014");
  });

  it("renderuje nazwę towaru", () => {
    const { container } = renderOrderRow({
      items: [{ productNameSnapshot: "Żwir", quantityTons: 15, loadingMethodCode: null, notes: null }],
    });
    expect(container.textContent).toContain("Żwir");
  });

  it("renderuje stawkę z walutą", () => {
    const { container } = renderOrderRow({ priceAmount: 2000, currencyCode: "EUR" });
    expect(container.textContent).toContain("2000 EUR");
  });

  // --- Tło wiersza wg statusu ---

  it("używa zielonego tła dla statusu 'wysłane'", () => {
    const { container } = renderOrderRow({ statusCode: "wysłane", statusName: "Wysłane" });
    const row = container.querySelector("tr[data-order-id]");
    expect(row).not.toBeNull();
    expect(row!.className).toContain("bg-emerald");
  });

  it("używa zielonego tła dla statusu 'korekta wysłane'", () => {
    const { container } = renderOrderRow({ statusCode: "korekta wysłane", statusName: "Korekta wysłane" });
    const row = container.querySelector("tr[data-order-id]");
    expect(row).not.toBeNull();
    expect(row!.className).toContain("bg-emerald");
  });

  it("używa białego tła dla statusu 'robocze'", () => {
    const { container } = renderOrderRow({ statusCode: "robocze", statusName: "Robocze" });
    const row = container.querySelector("tr[data-order-id]");
    expect(row).not.toBeNull();
    expect(row!.className).toContain("bg-white");
  });

  it("używa białego tła dla statusu 'korekta'", () => {
    const { container } = renderOrderRow({ statusCode: "korekta", statusName: "Korekta" });
    const row = container.querySelector("tr[data-order-id]");
    expect(row).not.toBeNull();
    expect(row!.className).toContain("bg-white");
  });

  // --- Lock indicator ---

  it("renderuje LockIndicator gdy zablokowane przez innego użytkownika", () => {
    renderOrderRow({
      lockedByUserId: "other-user-id",
      lockedByUserName: "Anna Nowak",
    });
    expect(screen.getByTestId("lock-indicator")).toHaveTextContent("Anna Nowak");
  });

  it("NIE renderuje LockIndicator gdy zablokowane przez aktualnego użytkownika", () => {
    renderOrderRow({
      lockedByUserId: "current-user-id", // ten sam co w mocku useAuth
      lockedByUserName: "Admin",
    });
    expect(screen.queryByTestId("lock-indicator")).toBeNull();
  });

  it("NIE renderuje LockIndicator gdy zlecenie nie jest zablokowane", () => {
    renderOrderRow({ lockedByUserId: null, lockedByUserName: null });
    expect(screen.queryByTestId("lock-indicator")).toBeNull();
  });

  // --- onClick ---

  it("wywołuje onRowClick z orderId po kliknięciu wiersza", async () => {
    const onRowClick = vi.fn();
    const { container } = renderOrderRow({ id: "order-xyz" }, { onRowClick });

    const row = container.querySelector("tr[data-order-id='order-xyz']")!;
    expect(row).not.toBeNull();
    await userEvent.click(row);
    expect(onRowClick).toHaveBeenCalledWith("order-xyz");
  });

  // --- data-order-id ---

  it("ustawia atrybut data-order-id na <tr>", () => {
    const { container } = renderOrderRow({ id: "test-id-123" });
    const row = container.querySelector("tr[data-order-id='test-id-123']");
    expect(row).not.toBeNull();
  });

  // --- Widok route vs columns ---

  it("renderuje RouteSummaryCell w widoku 'route'", () => {
    renderOrderRow({}, { viewMode: "route" });
    expect(screen.getByTestId("route-summary")).toBeInTheDocument();
  });

  it("renderuje LocationsCell w widoku 'columns'", () => {
    renderOrderRow({}, { viewMode: "columns" });
    expect(screen.getByTestId("locations-LOADING")).toBeInTheDocument();
    expect(screen.getByTestId("locations-UNLOADING")).toBeInTheDocument();
  });
});
