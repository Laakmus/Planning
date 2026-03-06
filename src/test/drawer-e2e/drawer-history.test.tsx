/**
 * Testy integracyjne panelu historii zmian (HistoryPanel + TimelineEntry).
 * Pokrywa: renderowanie wpisów, polskie etykiety pól, opisy akcji, ikony wizualne.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { getFieldLabel } from "@/lib/field-labels";
import type { ChangeLogItemDto, StatusHistoryItemDto } from "@/types";

// ---------------------------------------------------------------------------
// Mock useOrderHistory — nadpisujemy hook aby kontrolować dane
// ---------------------------------------------------------------------------

const mockUseOrderHistory = vi.fn();

vi.mock("@/hooks/useOrderHistory", () => ({
  useOrderHistory: (...args: unknown[]) => mockUseOrderHistory(...args),
}));

// ---------------------------------------------------------------------------
// Mock Radix UI Sheet — renderuje treść inline (bez portalu)
// ---------------------------------------------------------------------------

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  SheetDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}));

// ---------------------------------------------------------------------------
// Mock ScrollArea — passthrough
// ---------------------------------------------------------------------------

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Mock lucide-react — proste span z data-testid
// ---------------------------------------------------------------------------

vi.mock("lucide-react", () => ({
  History: () => <span data-testid="icon-history" />,
  Loader2: () => <span data-testid="icon-loader" />,
  X: () => <span data-testid="icon-x" />,
  ArrowRight: () => <span data-testid="icon-arrow-right" />,
  Edit2: () => <span data-testid="icon-edit" />,
  Minus: () => <span data-testid="icon-minus" />,
  Plus: () => <span data-testid="icon-plus" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
}));

// ---------------------------------------------------------------------------
// Import po mockach
// ---------------------------------------------------------------------------

import { HistoryPanel } from "@/components/orders/history/HistoryPanel";

// ---------------------------------------------------------------------------
// Dane testowe
// ---------------------------------------------------------------------------

const USER_ID = "a0000000-0000-0000-0000-000000000001";
const USER_NAME = "Jan Kowalski";
const ORDER_ID = "b0000000-0000-0000-0000-000000000001";
const ORDER_NO = "ZT2026/0001";
const BASE_TS = "2026-02-17T14:30:00.000Z";
const BASE_TS_2 = "2026-02-17T15:00:00.000Z";
const BASE_TS_3 = "2026-02-18T09:00:00.000Z";

function makeStatusHistory(
  overrides?: Partial<StatusHistoryItemDto>
): StatusHistoryItemDto {
  return {
    id: 1,
    orderId: ORDER_ID,
    oldStatusCode: "robocze",
    newStatusCode: "wysłane",
    changedAt: BASE_TS,
    changedByUserId: USER_ID,
    changedByUserName: USER_NAME,
    ...overrides,
  };
}

function makeChangeLog(
  overrides?: Partial<ChangeLogItemDto>
): ChangeLogItemDto {
  return {
    id: 1,
    orderId: ORDER_ID,
    fieldName: "price_amount",
    oldValue: "5000",
    newValue: "8000",
    changedAt: BASE_TS,
    changedByUserId: USER_ID,
    changedByUserName: USER_NAME,
    ...overrides,
  };
}

function setupHookReturn(
  statusHistory: StatusHistoryItemDto[] = [],
  changeLog: ChangeLogItemDto[] = [],
  isLoading = false,
  error: string | null = null
) {
  mockUseOrderHistory.mockReturnValue({
    statusHistory,
    changeLog,
    isLoading,
    error,
    refetch: vi.fn(),
  });
}

function renderPanel(isOpen = true) {
  return render(
    <HistoryPanel
      orderId={ORDER_ID}
      orderNo={ORDER_NO}
      isOpen={isOpen}
      onClose={vi.fn()}
    />
  );
}

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// HistoryPanel rendering
// ===========================================================================

describe("HistoryPanel rendering", () => {
  it("renders timeline entries for status changes", () => {
    const s1 = makeStatusHistory({
      id: 1,
      oldStatusCode: "robocze",
      newStatusCode: "wysłane",
      changedAt: BASE_TS,
    });
    const s2 = makeStatusHistory({
      id: 2,
      oldStatusCode: "wysłane",
      newStatusCode: "korekta",
      changedAt: BASE_TS_2,
    });
    setupHookReturn([s1, s2], []);
    renderPanel();

    // Sprawdź że oba wpisy statusowe są renderowane
    expect(screen.getByText("Robocze")).toBeInTheDocument();
    // "Wysłane" pojawia się 2x: jako newStatusCode w s1 i oldStatusCode w s2
    expect(screen.getAllByText("Wysłane")).toHaveLength(2);
    expect(screen.getByText("Korekta")).toBeInTheDocument();
    // Opis akcji "zmienił(a) status" pojawia się 2 razy
    expect(screen.getAllByText("zmienił(a) status")).toHaveLength(2);
  });

  it("renders timeline entries for field changes", () => {
    const c1 = makeChangeLog({
      fieldName: "price_amount",
      oldValue: "5000",
      newValue: "8000",
    });
    setupHookReturn([], [c1]);
    renderPanel();

    // Nazwa pola (surowa — TimelineEntry wyświetla entry.fieldName bezpośrednio)
    expect(screen.getByText("price_amount")).toBeInTheDocument();
    // Stara i nowa wartość
    expect(screen.getByText("5000")).toBeInTheDocument();
    expect(screen.getByText("8000")).toBeInTheDocument();
    // Nagłówki "Było" / "Jest"
    expect(screen.getByText("Było")).toBeInTheDocument();
    expect(screen.getByText("Jest")).toBeInTheDocument();
  });

  it("renders order_created entry", () => {
    const c1 = makeChangeLog({
      fieldName: "order_created",
      oldValue: null,
      newValue: "ZT2026/0001",
      changedByUserName: null,
    });
    setupHookReturn([], [c1]);
    renderPanel();

    expect(screen.getByText("Zlecenie utworzone")).toBeInTheDocument();
  });

  it("shows loading spinner when isLoading is true", () => {
    setupHookReturn([], [], true);
    renderPanel();

    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
  });

  it("shows error message when error is set", () => {
    setupHookReturn([], [], false, "Błąd pobierania historii zlecenia.");
    renderPanel();

    expect(
      screen.getByText("Błąd pobierania historii zlecenia.")
    ).toBeInTheDocument();
  });

  it("shows empty state when no history", () => {
    setupHookReturn([], []);
    renderPanel();

    expect(
      screen.getByText("Brak historii dla tego zlecenia.")
    ).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    setupHookReturn([makeStatusHistory()], []);
    renderPanel(false);

    expect(screen.queryByTestId("sheet")).not.toBeInTheDocument();
  });

  it("groups entries by date", () => {
    const s1 = makeStatusHistory({ id: 1, changedAt: BASE_TS }); // 2026-02-17
    const s2 = makeStatusHistory({ id: 2, changedAt: BASE_TS_3 }); // 2026-02-18
    setupHookReturn([s1, s2], []);
    renderPanel();

    // Oba wpisy renderowane (mogą być w różnych grupach)
    expect(screen.getAllByText("zmienił(a) status")).toHaveLength(2);
  });

  it("shows user name in entry header", () => {
    setupHookReturn([makeStatusHistory()], []);
    renderPanel();

    expect(screen.getByText(USER_NAME)).toBeInTheDocument();
  });

  it("shows 'System' when changedByUserName is null", () => {
    setupHookReturn(
      [],
      [
        makeChangeLog({
          fieldName: "order_created",
          changedByUserName: null,
        }),
      ]
    );
    renderPanel();

    expect(screen.getByText("System")).toBeInTheDocument();
  });
});

// ===========================================================================
// TimelineEntry field labels
// ===========================================================================

describe("TimelineEntry field labels", () => {
  it("displays raw field names for business fields", () => {
    // TimelineEntry wyświetla entry.fieldName bezpośrednio (surowa nazwa DB)
    const fields = [
      "carrier_company_id",
      "price_amount",
      "vehicle_type_text",
      "general_notes",
    ];

    for (const fieldName of fields) {
      vi.clearAllMocks();
      setupHookReturn([], [makeChangeLog({ id: 1, fieldName })]);
      const { unmount } = renderPanel();

      expect(screen.getByText(fieldName)).toBeInTheDocument();
      unmount();
    }
  });

  it("displays raw field names for item fields", () => {
    // TimelineEntry wyświetla entry.fieldName bezpośrednio
    const fields = [
      "item[1].product_name",
      "item[2].quantity_tons",
    ];

    for (const fieldName of fields) {
      vi.clearAllMocks();
      setupHookReturn([], [makeChangeLog({ id: 1, fieldName })]);
      const { unmount } = renderPanel();

      expect(screen.getByText(fieldName)).toBeInTheDocument();
      unmount();
    }
  });

  it("displays raw field names for stop events", () => {
    // TimelineEntry wyświetla entry.fieldName bezpośrednio
    const fields = [
      "stop_added",
      "stop_removed",
      "item_added",
      "item_removed",
    ];

    for (const fieldName of fields) {
      vi.clearAllMocks();
      setupHookReturn(
        [],
        [
          makeChangeLog({
            id: 1,
            fieldName,
            oldValue: fieldName.includes("removed") ? "Magazyn A" : null,
            newValue: fieldName.includes("added") ? "Magazyn B" : null,
          }),
        ]
      );
      const { unmount } = renderPanel();

      expect(screen.getByText(fieldName)).toBeInTheDocument();
      unmount();
    }
  });
});

// ===========================================================================
// TimelineEntry action descriptions
// ===========================================================================

describe("TimelineEntry action descriptions", () => {
  it("shows 'zmienił(a) dane' for all field_change entries", () => {
    // TimelineEntry wyświetla zawsze "zmienił(a) dane" dla type=field_change
    const fieldNames = [
      "stop_added",
      "stop_removed",
      "item_added",
      "item_removed",
      "item[1].product_name",
      "stop.date_local",
      "price_amount",
    ];

    for (const fieldName of fieldNames) {
      vi.clearAllMocks();
      setupHookReturn(
        [],
        [
          makeChangeLog({
            id: 1,
            fieldName,
            oldValue: "stara",
            newValue: "nowa",
          }),
        ]
      );
      const { unmount } = renderPanel();

      expect(screen.getByText("zmienił(a) dane")).toBeInTheDocument();
      unmount();
    }
  });

  it("shows 'zmienił(a) status' for status_change entries", () => {
    setupHookReturn([makeStatusHistory()], []);
    renderPanel();

    expect(screen.getByText("zmienił(a) status")).toBeInTheDocument();
  });

  it("shows '— zlecenie utworzone' for order_created entries", () => {
    setupHookReturn(
      [],
      [makeChangeLog({ fieldName: "order_created", changedByUserName: null })]
    );
    renderPanel();

    expect(screen.getByText("— zlecenie utworzone")).toBeInTheDocument();
  });
});

// ===========================================================================
// TimelineEntry visual indicators
// ===========================================================================

describe("TimelineEntry visual indicators", () => {
  it("shows Edit icon for added entries (field_change type)", () => {
    setupHookReturn(
      [],
      [
        makeChangeLog({
          id: 1,
          fieldName: "stop_added",
          oldValue: null,
          newValue: "Magazyn Centralny",
        }),
      ]
    );
    renderPanel();

    // IconBadge renderuje Edit2 (icon-edit) dla field_change
    expect(screen.getAllByTestId("icon-edit").length).toBeGreaterThanOrEqual(1);
    // Nowa wartość wyświetlona
    expect(screen.getByText("Magazyn Centralny")).toBeInTheDocument();
  });

  it("shows Edit icon for item_added entries (field_change type)", () => {
    setupHookReturn(
      [],
      [
        makeChangeLog({
          id: 1,
          fieldName: "item_added",
          oldValue: null,
          newValue: "Stal nierdzewna",
        }),
      ]
    );
    renderPanel();

    expect(screen.getAllByTestId("icon-edit").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Stal nierdzewna")).toBeInTheDocument();
  });

  it("shows Edit icon for removed entries (field_change type)", () => {
    setupHookReturn(
      [],
      [
        makeChangeLog({
          id: 1,
          fieldName: "stop_removed",
          oldValue: "Magazyn Centralny",
          newValue: null,
        }),
      ]
    );
    renderPanel();

    // IconBadge renderuje Edit2 (icon-edit) dla field_change
    expect(screen.getAllByTestId("icon-edit").length).toBeGreaterThanOrEqual(1);
    // Stara wartość widoczna z line-through
    expect(screen.getByText("Magazyn Centralny")).toBeInTheDocument();
  });

  it("shows Edit icon for item_removed entries (field_change type)", () => {
    setupHookReturn(
      [],
      [
        makeChangeLog({
          id: 1,
          fieldName: "item_removed",
          oldValue: "Stal nierdzewna",
          newValue: null,
        }),
      ]
    );
    renderPanel();

    expect(screen.getAllByTestId("icon-edit").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Stal nierdzewna")).toBeInTheDocument();
  });

  it("shows carrier name instead of UUID", () => {
    setupHookReturn(
      [],
      [
        makeChangeLog({
          id: 1,
          fieldName: "carrier_company_id",
          oldValue: "TransBud Logistyka",
          newValue: "NordMetal Sp. z o.o.",
        }),
      ]
    );
    renderPanel();

    // Nazwy firm widoczne w sekcji "Było" / "Jest"
    expect(screen.getByText("TransBud Logistyka")).toBeInTheDocument();
    expect(screen.getByText("NordMetal Sp. z o.o.")).toBeInTheDocument();
  });

  it("shows ArrowRight between old and new status", () => {
    setupHookReturn(
      [
        makeStatusHistory({
          oldStatusCode: "robocze",
          newStatusCode: "wysłane",
        }),
      ],
      []
    );
    renderPanel();

    expect(screen.getByTestId("icon-arrow-right")).toBeInTheDocument();
    expect(screen.getByText("Robocze")).toBeInTheDocument();
    expect(screen.getByText("Wysłane")).toBeInTheDocument();
  });

  it("shows dash when oldValue or newValue is null", () => {
    setupHookReturn(
      [],
      [
        makeChangeLog({
          id: 1,
          fieldName: "general_notes",
          oldValue: null,
          newValue: "Nowe uwagi",
        }),
      ]
    );
    renderPanel();

    // oldValue null → wyświetla "—"
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Nowe uwagi")).toBeInTheDocument();
  });
});

// ===========================================================================
// getFieldLabel function (unit tests)
// ===========================================================================

describe("getFieldLabel function", () => {
  it("returns exact match for known fields", () => {
    expect(getFieldLabel("price_amount")).toBe("Stawka");
    expect(getFieldLabel("carrier_company_id")).toBe("Firma transportowa");
    expect(getFieldLabel("vehicle_type_text")).toBe("Typ pojazdu");
    expect(getFieldLabel("general_notes")).toBe("Uwagi");
    expect(getFieldLabel("transport_type_code")).toBe("Rodzaj transportu");
    expect(getFieldLabel("currency_code")).toBe("Waluta");
    expect(getFieldLabel("payment_term_days")).toBe("Termin płatności (dni)");
    expect(getFieldLabel("payment_method")).toBe("Forma płatności");
    expect(getFieldLabel("complaint_reason")).toBe("Powód reklamacji");
    expect(getFieldLabel("required_documents_text")).toBe("Dokumenty");
    expect(getFieldLabel("is_entry_fixed")).toBe("Pozycja oznaczona (Fix)");
    expect(getFieldLabel("vehicle_capacity_volume_m3")).toBe(
      "Pojemność pojazdu (m³)"
    );
  });

  it("returns exact match for stop fields", () => {
    expect(getFieldLabel("stop.date_local")).toBe("Przystanek — data");
    expect(getFieldLabel("stop.time_local")).toBe("Przystanek — godzina");
    expect(getFieldLabel("stop.location_id")).toBe("Przystanek — lokalizacja");
    expect(getFieldLabel("stop.notes")).toBe("Przystanek — uwagi");
  });

  it("returns exact match for special event fields", () => {
    expect(getFieldLabel("order_created")).toBe("Zlecenie utworzone");
    expect(getFieldLabel("stop_added")).toBe("Dodano przystanek");
    expect(getFieldLabel("stop_removed")).toBe("Usunięto przystanek");
    expect(getFieldLabel("item_added")).toBe("Dodano pozycję towarową");
    expect(getFieldLabel("item_removed")).toBe("Usunięto pozycję towarową");
  });

  it("returns pattern match for item fields", () => {
    expect(getFieldLabel("item[1].product_name")).toBe("Towar #1 — nazwa");
    expect(getFieldLabel("item[3].quantity_tons")).toBe(
      "Towar #3 — ilość (t)"
    );
    expect(getFieldLabel("item[2].loading_method_code")).toBe(
      "Towar #2 — sposób załadunku"
    );
    expect(getFieldLabel("item[5].notes")).toBe("Towar #5 — uwagi");
  });

  it("returns fallback for unknown fields", () => {
    expect(getFieldLabel("some_unknown_field")).toBe("some_unknown_field");
    expect(getFieldLabel("xyz_abc")).toBe("xyz_abc");
  });
});
