/**
 * Testy komponentu OrderRowContextMenu.
 *
 * Pokrywa:
 * - Renderuje opcje menu (Otwórz, Historia zmian — zawsze widoczne)
 * - Opcje zapisu ukryte dla READ_ONLY
 * - Zmień status — podmenu z dozwolonymi przejściami
 * - Anuluj zlecenie ukryte gdy status=anulowane
 * - Przywróć do aktualnych widoczne w COMPLETED/CANCELLED
 *
 * UWAGA: Radix ContextMenu wymaga prawego kliknięcia do otwarcia.
 * Zamiast symulować pełny flow UI, mockujemy Radix prymitywy
 * i testujemy logikę renderowania opcji menu.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import type { OrderStatusCode, ViewGroup } from "@/lib/view-models";

// ---- Mock Radix Context Menu ----
// Radix ContextMenu wymaga pointer events i prawego kliknięcia.
// Mockujemy je jako proste divy, żeby testować logikę warunkowego renderowania.
vi.mock("@/components/ui/context-menu", () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="ctx-trigger">{children}</div>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="ctx-content">{children}</div>,
  ContextMenuItem: ({ children, onClick, disabled, className }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button data-testid="ctx-item" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
  ContextMenuSeparator: () => <hr data-testid="ctx-separator" />,
  ContextMenuSub: ({ children }: { children: React.ReactNode }) => <div data-testid="ctx-sub">{children}</div>,
  ContextMenuSubTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="ctx-sub-trigger">{children}</div>,
  ContextMenuSubContent: ({ children }: { children: React.ReactNode }) => <div data-testid="ctx-sub-content">{children}</div>,
}));

// ---- Mock AuthContext ----
let mockUserRole = "ADMIN";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "admin@test.pl", fullName: "Admin", role: mockUserRole },
    api: {},
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

// Import po mockach
import { OrderRowContextMenu } from "../OrderRowContextMenu";

// ---- Helpers ----

interface RenderMenuOptions {
  statusCode?: string;
  activeView?: ViewGroup;
  carrierCellColor?: string | null;
  role?: string;
}

function renderMenu(options: RenderMenuOptions = {}) {
  const { statusCode = "robocze", activeView = "CURRENT", carrierCellColor = null, role = "ADMIN" } = options;
  mockUserRole = role;

  const props = {
    orderId: "order-1",
    statusCode,
    activeView,
    carrierCellColor,
    onOpen: vi.fn(),
    onSendEmail: vi.fn(),
    onShowHistory: vi.fn(),
    onChangeStatus: vi.fn() as (orderId: string, newStatus: OrderStatusCode) => void,
    onDuplicate: vi.fn(),
    onCancel: vi.fn(),
    onRestore: vi.fn(),
    onSetCarrierColor: vi.fn(),
  };

  const result = render(
    <OrderRowContextMenu {...props}>
      <div data-testid="child-content">Row content</div>
    </OrderRowContextMenu>
  );

  return { ...result, props };
}

// ---- Testy ----

describe("OrderRowContextMenu", () => {
  describe("zawsze widoczne opcje", () => {
    it("renderuje 'Otwórz'", () => {
      renderMenu();
      expect(screen.getByText("Otwórz")).toBeInTheDocument();
    });

    it("renderuje 'Historia zmian'", () => {
      renderMenu();
      expect(screen.getByText("Historia zmian")).toBeInTheDocument();
    });

    it("renderuje children (trigger content)", () => {
      renderMenu();
      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });
  });

  describe("opcje zapisu — rola ADMIN", () => {
    it("renderuje 'Skopiuj zlecenie' dla ADMIN", () => {
      renderMenu({ role: "ADMIN" });
      expect(screen.getByText("Skopiuj zlecenie")).toBeInTheDocument();
    });

    it("renderuje 'Wyślij maila' dla statusu robocze", () => {
      renderMenu({ statusCode: "robocze" });
      expect(screen.getByText("Wyślij maila")).toBeInTheDocument();
    });

    it("renderuje 'Wyślij maila' dla statusu korekta", () => {
      renderMenu({ statusCode: "korekta" });
      expect(screen.getByText("Wyślij maila")).toBeInTheDocument();
    });

    it("renderuje 'Wyślij maila' dla statusu wysłane", () => {
      renderMenu({ statusCode: "wysłane" });
      expect(screen.getByText("Wyślij maila")).toBeInTheDocument();
    });

    it("NIE renderuje 'Wyślij maila' dla statusu zrealizowane", () => {
      renderMenu({ statusCode: "zrealizowane" });
      expect(screen.queryByText("Wyślij maila")).toBeNull();
    });

    it("renderuje 'Anuluj zlecenie' gdy status != anulowane", () => {
      renderMenu({ statusCode: "robocze" });
      expect(screen.getByText("Anuluj zlecenie")).toBeInTheDocument();
    });

    it("NIE renderuje 'Anuluj zlecenie' gdy status = anulowane", () => {
      renderMenu({ statusCode: "anulowane" });
      expect(screen.queryByText("Anuluj zlecenie")).toBeNull();
    });
  });

  describe("opcje zapisu — rola READ_ONLY", () => {
    it("NIE renderuje 'Skopiuj zlecenie' dla READ_ONLY", () => {
      renderMenu({ role: "READ_ONLY" });
      expect(screen.queryByText("Skopiuj zlecenie")).toBeNull();
    });

    it("NIE renderuje 'Wyślij maila' dla READ_ONLY", () => {
      renderMenu({ role: "READ_ONLY", statusCode: "robocze" });
      expect(screen.queryByText("Wyślij maila")).toBeNull();
    });

    it("NIE renderuje 'Anuluj zlecenie' dla READ_ONLY", () => {
      renderMenu({ role: "READ_ONLY", statusCode: "robocze" });
      expect(screen.queryByText("Anuluj zlecenie")).toBeNull();
    });

    it("wciąż renderuje 'Otwórz' dla READ_ONLY", () => {
      renderMenu({ role: "READ_ONLY" });
      expect(screen.getByText("Otwórz")).toBeInTheDocument();
    });

    it("wciąż renderuje 'Historia zmian' dla READ_ONLY", () => {
      renderMenu({ role: "READ_ONLY" });
      expect(screen.getByText("Historia zmian")).toBeInTheDocument();
    });
  });

  describe("zmiana statusu — dozwolone przejścia", () => {
    it("renderuje podmenu 'Zmień status' z przejściami dla robocze", () => {
      renderMenu({ statusCode: "robocze" });
      // robocze → ["zrealizowane", "anulowane"]
      expect(screen.getByText(/Zrealizowane/)).toBeInTheDocument();
      expect(screen.getByText(/Anulowane/)).toBeInTheDocument();
    });

    it("renderuje przejścia dla wysłane (zrealizowane, reklamacja, anulowane)", () => {
      renderMenu({ statusCode: "wysłane" });
      expect(screen.getByText(/Zrealizowane/)).toBeInTheDocument();
      expect(screen.getByText(/Reklamacja/)).toBeInTheDocument();
    });

    it("NIE renderuje podmenu 'Zmień status' dla zrealizowane (brak przejść)", () => {
      renderMenu({ statusCode: "zrealizowane" });
      // Zmień status nie powinno się pojawić
      expect(screen.queryByText("Zmień status")).toBeNull();
    });

    it("NIE renderuje podmenu 'Zmień status' dla anulowane (brak przejść)", () => {
      renderMenu({ statusCode: "anulowane" });
      expect(screen.queryByText("Zmień status")).toBeNull();
    });
  });

  describe("przywróć do aktualnych", () => {
    it("renderuje 'Przywróć do aktualnych' w widoku COMPLETED", () => {
      renderMenu({ statusCode: "zrealizowane", activeView: "COMPLETED" });
      expect(screen.getByText("Przywróć do aktualnych")).toBeInTheDocument();
    });

    it("renderuje 'Przywróć do aktualnych' w widoku CANCELLED", () => {
      renderMenu({ statusCode: "anulowane", activeView: "CANCELLED" });
      expect(screen.getByText("Przywróć do aktualnych")).toBeInTheDocument();
    });

    it("NIE renderuje 'Przywróć do aktualnych' w widoku CURRENT", () => {
      renderMenu({ statusCode: "robocze", activeView: "CURRENT" });
      expect(screen.queryByText("Przywróć do aktualnych")).toBeNull();
    });
  });

  describe("kolor komórki przewoźnika", () => {
    it("renderuje podmenu 'Kolor' z opcjami kolorów", () => {
      renderMenu();
      expect(screen.getByText("Kolor")).toBeInTheDocument();
      expect(screen.getByText("Zielony")).toBeInTheDocument();
      expect(screen.getByText("Ciemnozielony")).toBeInTheDocument();
      expect(screen.getByText("Żółty")).toBeInTheDocument();
      expect(screen.getByText("Pomarańczowy")).toBeInTheDocument();
    });

    it("renderuje 'Usuń kolor'", () => {
      renderMenu({ carrierCellColor: "#48A111" });
      expect(screen.getByText("Usuń kolor")).toBeInTheDocument();
    });
  });

  describe("wywołania callbacków", () => {
    it("wywołuje onOpen po kliknięciu 'Otwórz'", async () => {
      const { props } = renderMenu();
      await userEvent.click(screen.getByText("Otwórz"));
      expect(props.onOpen).toHaveBeenCalledWith("order-1");
    });

    it("wywołuje onShowHistory po kliknięciu 'Historia zmian'", async () => {
      const { props } = renderMenu();
      await userEvent.click(screen.getByText("Historia zmian"));
      expect(props.onShowHistory).toHaveBeenCalledWith("order-1");
    });

    it("wywołuje onDuplicate po kliknięciu 'Skopiuj zlecenie'", async () => {
      const { props } = renderMenu();
      await userEvent.click(screen.getByText("Skopiuj zlecenie"));
      expect(props.onDuplicate).toHaveBeenCalledWith("order-1");
    });

    it("wywołuje onCancel po kliknięciu 'Anuluj zlecenie'", async () => {
      const { props } = renderMenu({ statusCode: "robocze" });
      await userEvent.click(screen.getByText("Anuluj zlecenie"));
      expect(props.onCancel).toHaveBeenCalledWith("order-1");
    });

    it("wywołuje onSendEmail po kliknięciu 'Wyślij maila'", async () => {
      const { props } = renderMenu({ statusCode: "robocze" });
      await userEvent.click(screen.getByText("Wyślij maila"));
      expect(props.onSendEmail).toHaveBeenCalledWith("order-1");
    });
  });
});
