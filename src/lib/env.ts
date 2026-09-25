/**
 * Odczyt zmiennych środowiskowych po stronie serwera.
 *
 * Astro `import.meta.env` nie zawsze zawiera zmienne runtime (np. sekrety ustawione
 * na Fly.io po buildzie) — dlatego fallback na `process.env`.
 */

/**
 * Zwraca wartość zmiennej środowiskowej lub `undefined`, gdy nie jest ustawiona (albo pusta).
 */
export function getEnv(key: string): string | undefined {
  const fromImportMeta = (import.meta.env as Record<string, string | undefined> | undefined)?.[key];
  const value = fromImportMeta ?? process.env[key];
  return value === "" ? undefined : value;
}
