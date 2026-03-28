/**
 * Testy komponentu StatusBadge.
 *
 * Pokrywa:
 * - Poprawna nazwa statusu dla każdego kodu
 * - Odpowiednie klasy CSS (kolory) per status
 * - Obsługa nieznanego statusu (fallback)
 * - Override nazwy statusu (STATUS_DISPLAY_NAMES)
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { StatusBadge } from "../StatusBadge";

describe("StatusBadge", () => {
  // Mapowanie statusCode → oczekiwana klasa CSS (fragmenty unikalne)
  const STATUS_CSS_FRAGMENTS: Record<string, string> = {
    robocze: "bg-slate-100",
    wysłane: "bg-blue-50",
    korekta: "bg-orange-50",
    "korekta wysłane": "bg-amber-50",
    zrealizowane: "bg-emerald-50",
    anulowane: "bg-slate-100",
    reklamacja: "bg-red-50",
  };

  it.each(Object.entries(STATUS_CSS_FRAGMENTS))(
    "renderuje poprawne klasy CSS dla statusu '%s'",
    (statusCode, expectedCssFragment) => {
      const { container } = render(
        <StatusBadge statusCode={statusCode} statusName={statusCode} />
      );
      const badge = container.querySelector("span");
      expect(badge).not.toBeNull();
      expect(badge!.className).toContain(expectedCssFragment);
    }
  );

  it("renderuje statusName przekazaną przez props", () => {
    render(<StatusBadge statusCode="robocze" statusName="Robocze" />);
    expect(screen.getByText("Robocze")).toBeInTheDocument();
  });

  it("nadpisuje statusName gdy istnieje wpis w STATUS_DISPLAY_NAMES (korekta wysłane → Korekta_w)", () => {
    render(
      <StatusBadge statusCode="korekta wysłane" statusName="Korekta wysłane" />
    );
    // STATUS_DISPLAY_NAMES["korekta wysłane"] = "Korekta_w"
    expect(screen.getByText("Korekta_w")).toBeInTheDocument();
    // Oryginalna nazwa NIE powinna być renderowana
    expect(screen.queryByText("Korekta wysłane")).toBeNull();
  });

  it("renderuje fallback klasy CSS dla nieznanego statusu", () => {
    const { container } = render(
      <StatusBadge statusCode="nieznany_status" statusName="Nieznany" />
    );
    const badge = container.querySelector("span");
    expect(badge).not.toBeNull();
    // Fallback: bg-slate-100 text-slate-600
    expect(badge!.className).toContain("bg-slate-100");
    expect(badge!.className).toContain("text-slate-600");
  });

  it("renderuje statusName (bez override) dla nieznanego kodu", () => {
    render(
      <StatusBadge statusCode="nieznany" statusName="Testowy Status" />
    );
    expect(screen.getByText("Testowy Status")).toBeInTheDocument();
  });

  it("ma klasy bazowe (rounded-full, font-semibold, text-[11px])", () => {
    const { container } = render(
      <StatusBadge statusCode="robocze" statusName="Robocze" />
    );
    const badge = container.querySelector("span");
    expect(badge!.className).toContain("rounded-full");
    expect(badge!.className).toContain("font-semibold");
    expect(badge!.className).toContain("text-[11px]");
  });
});
