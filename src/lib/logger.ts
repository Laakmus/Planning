/**
 * Strukturalny logger oparty na pino.
 *
 * W trybie deweloperskim (Astro DEV) używa pino-pretty z kolorami.
 * W produkcji — JSON do stdout (domyślny transport pino).
 */

import pino from "pino";

// Bezpieczna detekcja trybu DEV — import.meta.env może nie istnieć w każdym kontekście
const isDev =
  typeof import.meta !== "undefined" && import.meta.env?.DEV === true;

export const logger = pino({
  level: isDev ? "debug" : "info",
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});
