/**
 * Testy komponentu FilterBar.
 *
 * Pokrywa:
 * - Renderuje wszystkie filtry (transport type select, status select, search, week)
 * - Wywołuje onFiltersChange przy zmianie filtra
 * - Przycisk "Wyczyść filtry" pojawia się gdy są aktywne filtry
 * - Przycisk "Nowe zlecenie" wywołuje onAddOrder
 * - Brak "Nowe zlecenie" gdy showAddButton=false
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { FilterBar } from "../FilterBar";
import type { OrderListFilters, ListViewMode } from "@/lib/view-models";

// ---- Mocki kontekstów ----

// Mock DictionaryContext — FilterBar używa useDictionaries()
vi.mock("@/contexts/DictionaryContext", () => ({
  useDictionaries: () => ({
    companies: [
      { id: "c1", name: "Firma Alpha" },
      { id: "c2", name: "Firma Beta" },
    ],
    products: [
      { id: "p1", name: "Piasek" },
      { id: "p2", name: "Żwir" },
    ],
    transportTypes: [
      { code: "PL", name: "Krajowy" },
      { code: "EXP", name: "Eksport" },
      { code: "EXP_K", name: "Ekspres K" },
      { code: "IMP", name: "Import" },
      // Nieprawidłowy typ — powinien być odfiltrowany
      { code: "LEGACY", name: "Legacy" },
    ],
    orderStatuses: [
      { code: "robocze", name: "Robocze" },
      { code: "wysłane", name: "Wysłane" },
      { code: "korekta", name: "Korekta" },
      { code: "korekta wysłane", name: "Korekta wysłane" },
      { code: "zrealizowane", name: "Zrealizowane" },
      { code: "reklamacja", name: "Reklamacja" },
      { code: "anulowane", name: "Anulowane" },
    ],
    locations: [],
    vehicleVariants: [],
    isLoading: false,
    error: null,
    refreshDictionaries: vi.fn(),
  }),
}));

// Mock AutocompleteFilter — upraszczamy do zwykłego select
vi.mock("../AutocompleteFilter", () => ({
  AutocompleteFilter: ({ label, value, onChange, items }: {
    label: string;
    value?: string;
    onChange: (id: string | undefined) => void;
    items: { id: string; label: string }[];
  }) => (
    <select
      data-testid={`autocomplete-${label}`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">{label}</option>
      {items.map((it) => (
        <option key={it.id} value={it.id}>{it.label}</option>
      ))}
    </select>
  ),
}));

// Mock ListSettings — upraszczamy
vi.mock("../ListSettings", () => ({
  ListSettings: () => <div data-testid="list-settings" />,
}));

// ---- Domyślne propsy ----

const defaultFilters: OrderListFilters = {
  view: "CURRENT",
  sortBy: "FIRST_LOADING_DATETIME",
  sortDirection: "ASC",
  pageSize: 50,
};

function renderFilterBar(overrides: Partial<Parameters<typeof FilterBar>[0]> = {}) {
  const props = {
    filters: defaultFilters,
    viewMode: "route" as ListViewMode,
    onFiltersChange: vi.fn(),
    onClearFilters: vi.fn(),
    onPageSizeChange: vi.fn(),
    onViewModeChange: vi.fn(),
    showAddButton: true,
    onAddOrder: vi.fn(),
    ...overrides,
  };
  const result = render(<FilterBar {...props} />);
  return { ...result, props };
}

// ---- Testy ----

describe("FilterBar", () => {
  it("renderuje select 'Rodzaj transportu' z 4 poprawnymi opcjami", () => {
    renderFilterBar();
    // Select transportu ma domyślną opcję + 4 kody
    const select = screen.getByDisplayValue("Rodzaj transportu");
    expect(select).toBeInTheDocument();
    expect(select.querySelectorAll("option")).toHaveLength(5); // placeholder + PL, EXP, EXP_K, IMP
  });

  it("odfiltruje nieprawidłowe kody transportu (LEGACY)", () => {
    renderFilterBar();
    // LEGACY nie powinien być wśród opcji
    expect(screen.queryByText("Legacy")).toBeNull();
  });

  it("renderuje select 'Status' z 7 poprawnymi opcjami", () => {
    renderFilterBar();
    const select = screen.getByDisplayValue("Status");
    expect(select).toBeInTheDocument();
    expect(select.querySelectorAll("option")).toHaveLength(8); // placeholder + 7 statusów
  });

  it("renderuje pole wyszukiwania", () => {
    renderFilterBar();
    expect(screen.getByPlaceholderText("Szukaj...")).toBeInTheDocument();
  });

  it("renderuje pole 'Tydzień'", () => {
    renderFilterBar();
    expect(screen.getByPlaceholderText("Tydzień")).toBeInTheDocument();
  });

  it("wywołuje onFiltersChange przy zmianie rodzaju transportu", async () => {
    const { props } = renderFilterBar();

    const select = screen.getByDisplayValue("Rodzaj transportu");
    await userEvent.selectOptions(select, "PL");

    expect(props.onFiltersChange).toHaveBeenCalledWith({ transportType: "PL" });
  });

  it("wywołuje onFiltersChange przy zmianie statusu", async () => {
    const { props } = renderFilterBar();

    const select = screen.getByDisplayValue("Status");
    await userEvent.selectOptions(select, "robocze");

    expect(props.onFiltersChange).toHaveBeenCalledWith({ status: "robocze" });
  });

  it("NIE renderuje 'Wyczyść filtry' gdy brak aktywnych filtrów", () => {
    renderFilterBar();
    expect(screen.queryByText("Wyczyść filtry")).toBeNull();
  });

  it("renderuje 'Wyczyść filtry' gdy są aktywne filtry", () => {
    renderFilterBar({
      filters: { ...defaultFilters, transportType: "PL" },
    });
    expect(screen.getByText("Wyczyść filtry")).toBeInTheDocument();
  });

  it("wywołuje onClearFilters po kliknięciu 'Wyczyść filtry'", async () => {
    const { props } = renderFilterBar({
      filters: { ...defaultFilters, status: "robocze" },
    });

    await userEvent.click(screen.getByText("Wyczyść filtry"));
    expect(props.onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("renderuje przycisk 'Nowe zlecenie' gdy showAddButton=true", () => {
    renderFilterBar({ showAddButton: true });
    expect(screen.getByText("Nowe zlecenie")).toBeInTheDocument();
  });

  it("NIE renderuje 'Nowe zlecenie' gdy showAddButton=false", () => {
    renderFilterBar({ showAddButton: false });
    expect(screen.queryByText("Nowe zlecenie")).toBeNull();
  });

  it("wywołuje onAddOrder po kliknięciu 'Nowe zlecenie'", async () => {
    const { props } = renderFilterBar({ showAddButton: true });

    await userEvent.click(screen.getByText("Nowe zlecenie"));
    expect(props.onAddOrder).toHaveBeenCalledTimes(1);
  });

  it("wyświetla 'Tworzenie...' gdy isAddingOrder=true", () => {
    renderFilterBar({ showAddButton: true, isAddingOrder: true });
    expect(screen.getByText("Tworzenie...")).toBeInTheDocument();
    expect(screen.queryByText("Nowe zlecenie")).toBeNull();
  });

  it("renderuje autocomplete dla firm (załadunek, rozładunek, transport) i towaru", () => {
    renderFilterBar();
    expect(screen.getByTestId("autocomplete-Firma załadunku")).toBeInTheDocument();
    expect(screen.getByTestId("autocomplete-Firma rozładunku")).toBeInTheDocument();
    expect(screen.getByTestId("autocomplete-Firma transp.")).toBeInTheDocument();
    expect(screen.getByTestId("autocomplete-Towar")).toBeInTheDocument();
  });
});
