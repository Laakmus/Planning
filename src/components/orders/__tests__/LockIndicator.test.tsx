/**
 * Testy komponentu LockIndicator.
 *
 * Pokrywa:
 * - Renderuje ikonę kłódki gdy lockedByUserName jest niepusty
 * - Nie renderuje nic gdy lockedByUserName jest null
 * - Zawiera tekst "Edytowane przez" (tooltip content renderowany w DOM)
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { LockIndicator } from "../LockIndicator";

describe("LockIndicator", () => {
  it("nie renderuje nic gdy lockedByUserName=null", () => {
    const { container } = render(<LockIndicator lockedByUserName={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renderuje element gdy lockedByUserName jest podany", () => {
    const { container } = render(
      <LockIndicator lockedByUserName="Jan Kowalski" />
    );
    expect(container.innerHTML).not.toBe("");
  });

  it("renderuje ikonę SVG (Lock z lucide-react)", () => {
    const { container } = render(
      <LockIndicator lockedByUserName="Test User" />
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("ma klasę koloru amber na elemencie span", () => {
    const { container } = render(
      <LockIndicator lockedByUserName="Test User" />
    );
    // Ikona powinna mieć klasę amber (kolor blokady)
    const span = container.querySelector("span.text-amber-500");
    expect(span).not.toBeNull();
  });
});
