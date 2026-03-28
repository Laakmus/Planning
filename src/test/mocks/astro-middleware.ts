/**
 * Mock modułu `astro:middleware` dla testów Vitest.
 * defineMiddleware w Astro opakowuje funkcję — tutaj zwraca ją bezpośrednio.
 */
export function defineMiddleware(fn: unknown) {
  return fn;
}
