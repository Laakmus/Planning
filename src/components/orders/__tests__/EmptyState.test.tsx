/**
 * Testy komponentu EmptyState.
 *
 * Pokrywa:
 * - Wariant "brak zleceń" (hasFilters=false) — ikona, tekst, przycisk
 * - Wariant "brak wyników filtrowania" (hasFilters=true)
 * - Przycisk "Nowe zlecenie" widoczny gdy showAddButton=true
 * - Przycisk "Wyczyść filtry" w wariancie filtrów
 * - Stan disabled (isAddingOrder=true)
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  describe("wariant brak zleceń (hasFilters=false)", () => {
    it("renderuje nagłówek 'Brak zleceń'", () => {
      render(<EmptyState hasFilters={false} />);
      expect(screen.getByText("Brak zleceń")).toBeInTheDocument();
    });

    it("renderuje opis informujący o pustej zakładce", () => {
      render(<EmptyState hasFilters={false} />);
      expect(
        screen.getByText("Nie masz jeszcze żadnych zleceń w tej zakładce.")
      ).toBeInTheDocument();
    });

    it("NIE renderuje przycisku 'Nowe zlecenie' gdy showAddButton=false", () => {
      render(<EmptyState hasFilters={false} showAddButton={false} />);
      expect(screen.queryByText("Nowe zlecenie")).toBeNull();
    });

    it("renderuje przycisk 'Nowe zlecenie' gdy showAddButton=true", () => {
      render(
        <EmptyState
          hasFilters={false}
          showAddButton={true}
          onAddOrder={vi.fn()}
        />
      );
      expect(screen.getByText("Nowe zlecenie")).toBeInTheDocument();
    });

    it("wywołuje onAddOrder po kliknięciu 'Nowe zlecenie'", async () => {
      const onAddOrder = vi.fn();
      render(
        <EmptyState
          hasFilters={false}
          showAddButton={true}
          onAddOrder={onAddOrder}
        />
      );

      await userEvent.click(screen.getByText("Nowe zlecenie"));
      expect(onAddOrder).toHaveBeenCalledTimes(1);
    });

    it("przycisk jest disabled gdy isAddingOrder=true", () => {
      render(
        <EmptyState
          hasFilters={false}
          showAddButton={true}
          isAddingOrder={true}
          onAddOrder={vi.fn()}
        />
      );
      // Tekst zmienia się na "Tworzenie..."
      expect(screen.getByText("Tworzenie...")).toBeInTheDocument();
      expect(screen.queryByText("Nowe zlecenie")).toBeNull();
    });
  });

  describe("wariant brak wyników filtrowania (hasFilters=true)", () => {
    it("renderuje nagłówek o braku wyników", () => {
      render(<EmptyState hasFilters={true} />);
      expect(
        screen.getByText("Brak wyników dla zastosowanych filtrów")
      ).toBeInTheDocument();
    });

    it("renderuje przycisk 'Wyczyść filtry' gdy przekazano onClearFilters", () => {
      render(
        <EmptyState hasFilters={true} onClearFilters={vi.fn()} />
      );
      expect(screen.getByText("Wyczyść filtry")).toBeInTheDocument();
    });

    it("wywołuje onClearFilters po kliknięciu", async () => {
      const onClearFilters = vi.fn();
      render(
        <EmptyState hasFilters={true} onClearFilters={onClearFilters} />
      );

      await userEvent.click(screen.getByText("Wyczyść filtry"));
      expect(onClearFilters).toHaveBeenCalledTimes(1);
    });

    it("NIE renderuje 'Wyczyść filtry' bez onClearFilters", () => {
      render(<EmptyState hasFilters={true} />);
      expect(screen.queryByText("Wyczyść filtry")).toBeNull();
    });

    it("NIE renderuje przycisku 'Nowe zlecenie' w wariancie filtrów", () => {
      render(
        <EmptyState
          hasFilters={true}
          showAddButton={true}
          onAddOrder={vi.fn()}
        />
      );
      // W wariancie filtrów nie ma przycisku nowego zlecenia
      expect(screen.queryByText("Nowe zlecenie")).toBeNull();
    });
  });
});
