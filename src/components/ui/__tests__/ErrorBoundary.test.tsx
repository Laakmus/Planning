/**
 * Testy ErrorBoundary — przechwytywanie błędów React.
 *
 * Weryfikuje:
 * 1. Renderuje dzieci gdy nie ma błędu
 * 2. Renderuje domyślny fallback po błędzie (role="alert")
 * 3. Renderuje customowy fallback gdy podano prop `fallback`
 * 4. Wywołuje `onError` callback z obiektem błędu
 * 5. Przycisk "Spróbuj ponownie" resetuje boundary
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ErrorBoundary } from "../ErrorBoundary";

// ---------------------------------------------------------------------------
// Wyciszenie React ErrorBoundary console.error noise
// ---------------------------------------------------------------------------

vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  vi.restoreAllMocks();
  // Ponowne wyciszenie po restoreAllMocks (dla kolejnych testów)
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// Komponent testowy rzucający błąd
// ---------------------------------------------------------------------------

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error from ThrowingChild");
  }
  return <div data-testid="child">Dziecko działa poprawnie</div>;
}

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("ErrorBoundary", () => {
  it("renderuje dzieci gdy nie ma błędu", () => {
    // Arrange & Act
    render(
      <ErrorBoundary>
        <div>Treść aplikacji</div>
      </ErrorBoundary>
    );

    // Assert
    expect(screen.getByText("Treść aplikacji")).toBeInTheDocument();
  });

  it("renderuje domyślny fallback po błędzie (role='alert')", () => {
    // Arrange & Act
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    // Assert — domyślny fallback ma role="alert"
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("Coś poszło nie tak");
  });

  it("renderuje customowy fallback gdy podano prop fallback", () => {
    // Arrange
    const customFallback = <div data-testid="custom-fallback">Błąd niestandardowy</div>;

    // Act
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    // Assert — customowy fallback zamiast domyślnego
    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.getByText("Błąd niestandardowy")).toBeInTheDocument();
    // Domyślny fallback NIE powinien się pojawić
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("wywołuje onError callback z obiektem błędu", () => {
    // Arrange
    const onError = vi.fn();

    // Act
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    // Assert — callback wywołany z Error i ErrorInfo
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Test error from ThrowingChild" }),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it("przycisk 'Spróbuj ponownie' resetuje boundary i ponownie renderuje dzieci", () => {
    // Arrange — obiekt ref kontrolujący czy komponent ma rzucić błąd.
    // Używamy obiektu z progiem > 1, bo React 19 w dev mode
    // wywołuje render wielokrotnie (strict mode + concurrent retry).
    const state = { shouldThrow: true };

    function ConditionalThrower() {
      if (state.shouldThrow) {
        throw new Error("Kontrolowany błąd testowy");
      }
      return <div data-testid="recovered">Odzyskano po błędzie</div>;
    }

    // Act — pierwszy render → błąd → domyślny fallback
    render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    );

    // Assert — widzimy fallback z przyciskiem
    expect(screen.getByRole("alert")).toBeInTheDocument();
    const retryButton = screen.getByText("Spróbuj ponownie");
    expect(retryButton).toBeInTheDocument();

    // Arrange — wyłączamy rzucanie błędu przed kliknięciem retry
    state.shouldThrow = false;

    // Act — kliknięcie resetuje boundary
    fireEvent.click(retryButton);

    // Assert — po resecie dzieci renderują się poprawnie
    expect(screen.getByTestId("recovered")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("nie renderuje fallbacku gdy dzieci nie rzucają błędu", () => {
    // Arrange & Act
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    );

    // Assert
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
