/**
 * ErrorBoundary — przechwytuje nieobsłużone błędy React i wyświetla fallback UI.
 *
 * React 19 nadal wymaga class-based ErrorBoundary (brak hooka).
 * Zero dodatkowych zależności npm — czysty React Component.
 *
 * Użycie:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<p>Błąd formularza</p>}>
 *     <OrderDrawer />
 *   </ErrorBoundary>
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Niestandardowy fallback UI — gdy podany, zastępuje domyślny ekran błędu */
  fallback?: ReactNode;
  /** Callback wywoływany po przechwyceniu błędu (np. do logowania) */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Logowanie do konsoli w każdym środowisku
    console.error("[ErrorBoundary] Przechwycono błąd:", error, info);
    // Sentry: dynamiczny import żeby uniknąć @sentry/node w kliencie (client:load)
    import("@/lib/sentry")
      .then(({ captureException }) => captureException(error, { componentStack: info?.componentStack }))
      .catch(() => { /* Sentry niedostępny w przeglądarce — ignoruj */ });
    this.props.onError?.(error, info);
  }

  /** Resetuje stan błędu — pozwala ponownie wyrenderować dzieci */
  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  /** Odświeża stronę w przeglądarce */
  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Jeśli podano niestandardowy fallback — użyj go
    if (this.props.fallback !== undefined) {
      return this.props.fallback;
    }

    // Domyślny fallback UI
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center min-h-[200px] p-8 mx-auto max-w-lg text-center rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
      >
        <div className="mb-1 text-lg font-semibold text-red-700 dark:text-red-300">
          Coś poszło nie tak
        </div>
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
          Wystąpił nieoczekiwany błąd. Spróbuj odświeżyć stronę.
        </p>

        {/* Stack trace widoczny tylko w trybie deweloperskim */}
        {import.meta.env.DEV && this.state.error?.message && (
          <pre className="mb-4 w-full max-h-32 overflow-auto rounded border border-red-200 bg-red-100 p-3 text-left text-xs text-red-800 dark:border-red-800 dark:bg-red-900/50 dark:text-red-200">
            {this.state.error.message}
          </pre>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            Spróbuj ponownie
          </Button>
          <Button variant="destructive" size="sm" onClick={this.handleReload}>
            Odśwież stronę
          </Button>
        </div>
      </div>
    );
  }
}
