/**
 * Narzędzia tygodni ISO 8601 — wspólne dla backendu (raport magazynowy) i frontendu.
 *
 * Wszystkie obliczenia na datach kalendarzowych w UTC (bez wpływu strefy czasowej
 * procesu). „Dzisiaj" liczymy w strefie Europe/Warsaw.
 */

const DAY_MS = 86_400_000;

/** Strefa czasowa biznesu (daty zleceń są lokalne dla Polski). */
export const BUSINESS_TIME_ZONE = "Europe/Warsaw";

/**
 * Zwraca datę (UTC, północ) poniedziałku tygodnia ISO dla podanego roku i numeru tygodnia.
 * Algorytm: 4 stycznia danego roku jest zawsze w tygodniu 1 (ISO 8601).
 */
export function getISOWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // 1=pon, 7=nie
  const week1Monday = new Date(jan4.getTime() - (dayOfWeek - 1) * DAY_MS);
  return new Date(week1Monday.getTime() + (week - 1) * 7 * DAY_MS);
}

/** Dodaje `days` dni do daty UTC. */
export function addDaysUTC(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Formatuje datę UTC do YYYY-MM-DD. */
export function formatUTCDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Numer tygodnia ISO dla daty kalendarzowej (UTC, północ). */
export function getISOWeekOfDate(date: Date): { week: number; year: number } {
  const d = new Date(date.getTime());
  // Przesuń do najbliższego czwartku (ISO: czwartek = ten sam tydzień)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

/** Data kalendarzowa (UTC, północ) chwili `now` w podanej strefie czasowej. */
export function getCalendarDateInZone(now: Date, timeZone: string = BUSINESS_TIME_ZONE): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Bieżący tydzień ISO wg daty w Europe/Warsaw.
 * Strefa procesu (UTC na serwerze) dawała poprzedni tydzień w poniedziałek 00:00–02:00 czasu PL.
 */
export function getCurrentISOWeek(now: Date = new Date()): { week: number; year: number } {
  return getISOWeekOfDate(getCalendarDateInZone(now));
}

/**
 * Parsuje numer tygodnia wpisany przez użytkownika i zwraca zakres dat ISO 8601
 * (poniedziałek–niedziela tego tygodnia ISO).
 *
 * Obsługiwane formaty wejściowe:
 * - "07"       → tydzień 7 bieżącego roku
 * - "7"        → tydzień 7 bieżącego roku
 * - "2026-07"  → tydzień 7 roku 2026 (myślnik bez W)
 * - "2026-W07" → tydzień 7 roku 2026 (ISO 8601 z myślnikiem i W)
 * - "2026W07"  → tydzień 7 roku 2026 (bez myślnika, z W)
 *
 * Zwraca null gdy format jest nieprawidłowy lub numer tygodnia poza zakresem 1–53.
 */
export function weekNumberToDateRange(
  weekStr: string
): { dateFrom: string; dateTo: string } | null {
  const trimmed = weekStr.trim();
  let year: number;
  let week: number;

  // Format z rokiem: "2026-07", "2026-W07" lub "2026W07"
  // Separator może być: myślnik+W, sam myślnik, lub sam W
  // (np. "2026-05", "2026-W05", "2026W05" OK; "2026007" odrzucony)
  const fullMatch = trimmed.match(/^(\d{4})(?:-W?|W)(\d{1,2})$/);
  if (fullMatch) {
    year = parseInt(fullMatch[1], 10);
    week = parseInt(fullMatch[2], 10);
  } else {
    // Format skrócony: "07" lub "7" → bieżący rok
    const shortMatch = trimmed.match(/^(\d{1,2})$/);
    if (!shortMatch) return null;
    week = parseInt(shortMatch[1], 10);
    year = getCalendarDateInZone(new Date()).getUTCFullYear();
  }

  if (week < 1 || week > 53) return null;

  const monday = getISOWeekMonday(year, week);
  const sunday = addDaysUTC(monday, 6);

  return {
    dateFrom: formatUTCDate(monday),
    dateTo: formatUTCDate(sunday),
  };
}
