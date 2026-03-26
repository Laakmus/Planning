/**
 * Sentry — integracja error tracking.
 * Graceful no-op gdy brak DSN (np. środowisko lokalne/dev).
 */
import * as Sentry from "@sentry/node";

const dsn =
  typeof import.meta !== "undefined"
    ? import.meta.env?.PUBLIC_SENTRY_DSN
    : undefined;

let initialized = false;

/** Inicjalizuje Sentry SDK — bezpieczne wielokrotne wywołanie (idempotentne). */
export function initSentry(): void {
  if (!dsn || initialized) return;
  Sentry.init({
    dsn,
    environment: import.meta.env?.MODE ?? "production",
    // Wyłącz domyślne integracje performance (nie potrzebujemy tracing)
    tracesSampleRate: 0,
  });
  initialized = true;
}

/** Wysyła wyjątek do Sentry z opcjonalnym kontekstem. No-op bez DSN. */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!dsn) return;
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}
