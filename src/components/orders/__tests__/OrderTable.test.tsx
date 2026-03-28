/**
 * Testy komponentu OrderTable.
 *
 * Pokrywa:
 * - Renderuje nagłówki kolumn
 * - Sortowanie — kliknięcie nagłówka wywołuje onSort
 * - Loading state (skeleton)
 * - Renderuje OrderRow dla każdego zlecenia
 * - aria-sort na nagłówkach sortowalnych
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { OrderTable } from "../OrderTable";
import type { OrderListItemDto } from "@/types";
import type { ListViewMode, ViewGroup, OrderSortBy, SortDirection, OrderStatusCode } from "@/lib/view-models";

// ---- Mocki ----

// Mock OrderRow — upraszczamy do wyświetlenia numeru zlecenia
vi.mock("../OrderRow", () => ({
  OrderRow: ({ order, onRowClick }: { order: OrderListItemDto; onRowClick: (id: string) => void }) => (
    <tr data-testid={`order-row-${order.id}`} onClick={() => onRowClick(order.id)}>
      <td>{order.orderNo}</td>
    </tr>
  ),
}));

// ---- Fixtures ----

function makeOrder(id: string, orderNo: string): OrderListItemDto {
  return {
    id,
    orderNo,
    statusCode: "robocze",
    statusName: "Robocze",
    viewGroup: "CURRENT",
    transportTypeCode: "PL",
    transportTypeName: "Krajowy",
    summaryRoute: null,
    stops: [],
    firstLoadingDate: null,
    firstLoadingTime: null,
    firstUnloadingDate: null,
    firstUnloadingTime: null,
    lastLoadingDate: null,
    lastLoadingTime: null,
    lastUnloadingDate: null,
    lastUnloadingTime: null,
    weekNumber: null,
    carrierCompanyId: null,
    carrierName: null,
    mainProductName: null,
    items: [],
    priceAmount: null,
    currencyCode: "PLN",
    vehicleTypeText: null,
    vehicleCapacityVolumeM3: null,
    requiredDocumentsText: null,
    generalNotes: null,
    sentByUserName: null,
    sentAt: null,
    lockedByUserId: null,
    lockedByUserName: null,
    lockedAt: null,
    createdAt: "2026-03-01T10:00:00Z",
    createdByUserId: "user-1",
    createdByUserName: null,
    updatedAt: "2026-03-01T10:00:00Z",
    updatedByUserId: null,
    updatedByUserName: null,
    carrierCellColor: null,
    isEntryFixed: null,
  };
}

const defaultProps = {
  orders: [] as OrderListItemDto[],
  sortBy: "FIRST_LOADING_DATETIME" as OrderSortBy,
  sortDirection: "ASC" as SortDirection,
  viewMode: "route" as ListViewMode,
  isLoading: false,
  activeView: "CURRENT" as ViewGroup,
  onSort: vi.fn(),
  onRowClick: vi.fn(),
  onSendEmail: vi.fn(),
  onShowHistory: vi.fn(),
  onChangeStatus: vi.fn() as (orderId: string, orderNo: string, newStatus: OrderStatusCode) => void,
  onDuplicate: vi.fn() as (orderId: string, orderNo: string) => void,
  onCancel: vi.fn() as (orderId: string, orderNo: string) => void,
  onRestore: vi.fn() as (orderId: string, orderNo: string) => void,
  onSetCarrierColor: vi.fn(),
  onSetEntryFixed: vi.fn(),
};

function renderTable(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<OrderTable {...props} />);
}

// ---- Testy ----

describe("OrderTable", () => {
  describe("nagłówki kolumn", () => {
    it("renderuje nagłówki w trybie route", () => {
      renderTable({ viewMode: "route" });
      expect(screen.getByText("Nr zlecenia")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Tydz.")).toBeInTheDocument();
      expect(screen.getByText("Rodzaj")).toBeInTheDocument();
      expect(screen.getByText("Trasa")).toBeInTheDocument();
      expect(screen.getByText("Towar")).toBeInTheDocument();
      expect(screen.getByText("Komentarz")).toBeInTheDocument();
      expect(screen.getByText("Typ auta")).toBeInTheDocument();
      expect(screen.getByText("Stawka")).toBeInTheDocument();
    });

    it("renderuje nagłówek 'Miejsce załadunku' i 'Miejsce rozładunku' w trybie columns", () => {
      renderTable({ viewMode: "columns" });
      expect(screen.getByText("Miejsce załadunku")).toBeInTheDocument();
      expect(screen.getByText("Miejsce rozładunku")).toBeInTheDocument();
      expect(screen.queryByText("Trasa")).toBeNull();
    });
  });

  describe("sortowanie", () => {
    it("wywołuje onSort('ORDER_NO') po kliknięciu 'Nr zlecenia'", async () => {
      const onSort = vi.fn();
      renderTable({ onSort });

      await userEvent.click(screen.getByText("Nr zlecenia"));
      expect(onSort).toHaveBeenCalledWith("ORDER_NO");
    });

    it("wywołuje onSort('FIRST_LOADING_DATETIME') po kliknięciu 'Data zał.'", async () => {
      const onSort = vi.fn();
      renderTable({ onSort });

      await userEvent.click(screen.getByText("Data zał."));
      expect(onSort).toHaveBeenCalledWith("FIRST_LOADING_DATETIME");
    });

    it("wywołuje onSort('CARRIER_NAME') po kliknięciu 'Firma transp.'", async () => {
      const onSort = vi.fn();
      renderTable({ onSort });

      await userEvent.click(screen.getByText("Firma transp."));
      expect(onSort).toHaveBeenCalledWith("CARRIER_NAME");
    });

    it("ustawia aria-sort='ascending' na aktywnej kolumnie sortowania ASC", () => {
      renderTable({ sortBy: "ORDER_NO", sortDirection: "ASC" });
      const th = screen.getByText("Nr zlecenia").closest("th");
      expect(th?.getAttribute("aria-sort")).toBe("ascending");
    });

    it("ustawia aria-sort='descending' na aktywnej kolumnie sortowania DESC", () => {
      renderTable({ sortBy: "ORDER_NO", sortDirection: "DESC" });
      const th = screen.getByText("Nr zlecenia").closest("th");
      expect(th?.getAttribute("aria-sort")).toBe("descending");
    });

    it("ustawia aria-sort='none' na nieaktywnej kolumnie sortowania", () => {
      renderTable({ sortBy: "CARRIER_NAME", sortDirection: "ASC" });
      const th = screen.getByText("Nr zlecenia").closest("th");
      expect(th?.getAttribute("aria-sort")).toBe("none");
    });
  });

  describe("loading state", () => {
    it("renderuje skeleton rows gdy isLoading=true i brak zleceń", () => {
      renderTable({ isLoading: true, orders: [] });
      // Skeleton wiersze mają klasę animate-pulse
      const pulseRows = document.querySelectorAll("tr.animate-pulse");
      expect(pulseRows.length).toBe(5);
    });

    it("NIE renderuje skeleton gdy isLoading=true ale są zlecenia", () => {
      renderTable({
        isLoading: true,
        orders: [makeOrder("1", "ZL/001")],
      });
      const pulseRows = document.querySelectorAll("tr.animate-pulse");
      expect(pulseRows.length).toBe(0);
    });
  });

  describe("renderowanie zleceń", () => {
    it("renderuje OrderRow dla każdego zlecenia", () => {
      renderTable({
        orders: [
          makeOrder("o1", "ZL/001"),
          makeOrder("o2", "ZL/002"),
          makeOrder("o3", "ZL/003"),
        ],
      });

      expect(screen.getByTestId("order-row-o1")).toBeInTheDocument();
      expect(screen.getByTestId("order-row-o2")).toBeInTheDocument();
      expect(screen.getByTestId("order-row-o3")).toBeInTheDocument();
    });

    it("nie renderuje żadnych wierszy gdy orders jest pusty i nie ładuje", () => {
      renderTable({ orders: [], isLoading: false });
      const bodyRows = document.querySelectorAll("tbody tr");
      expect(bodyRows.length).toBe(0);
    });
  });

  describe("table structure", () => {
    it("ma role='table' na elemencie <table>", () => {
      renderTable();
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("thead ma klasę sticky", () => {
      renderTable();
      const thead = document.querySelector("thead");
      expect(thead?.className).toContain("sticky");
    });
  });
});
