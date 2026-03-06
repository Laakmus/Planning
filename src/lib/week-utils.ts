/**
 * Narzędzia do przeliczania numerów tygodni ISO 8601 na zakresy dat.
 */

/**
 * Zwraca datę poniedziałku tygodnia ISO dla podanego roku i numeru tygodnia.
 * Algorytm: 4 stycznia danego roku jest zawsze w tygodniu 1 (ISO 8601).
 */
function getISOWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // 1=pon, 7=nie
  const week1Monday = new Date(jan4.getTime() - (dayOfWeek - 1) * 86_400_000);
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 86_400_000);
}

function formatUTCDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parsuje numer tygodnia wpisany przez użytkownika i zwraca zakres dat ISO 8601
 * (poniedziałek–niedziela tego tygodnia ISO).
 *
 * Obsługiwane formaty wejściowe:
 * - "07"      → tydzień 7 bieżącego roku
 * - "2026-07" → tydzień 7 roku 2026
 * - "2026-W07"→ tydzień 7 roku 2026
 *
 * Zwraca null gdy format jest nieprawidłowy lub numer tygodnia poza zakresem 1–53.
 */
export function weekNumberToDateRange(
  weekStr: string
): { dateFrom: string; dateTo: string } | null {
  const trimmed = weekStr.trim();
  let year: number;
  let week: number;

  // Format z rokiem: "2026-07" lub "2026-W07"
  // Wymagamy separatora '-' lub 'W' między rokiem a numerem tygodnia
  // (np. "2026-05", "2026W05" OK; "2026007" odrzucony)
  const fullMatch = trimmed.match(/^(\d{4})[W-](\d{1,2})$/);
  if (fullMatch) {
    year = parseInt(fullMatch[1], 10);
    week = parseInt(fullMatch[2], 10);
  } else {
    // Format skrócony: "07" lub "7" → bieżący rok
    const shortMatch = trimmed.match(/^(\d{1,2})$/);
    if (!shortMatch) return null;
    week = parseInt(shortMatch[1], 10);
    year = new Date().getUTCFullYear();
  }

  if (week < 1 || week > 53) return null;

  const monday = getISOWeekMonday(year, week);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);

  return {
    dateFrom: formatUTCDate(monday),
    dateTo: formatUTCDate(sunday),
  };
}
