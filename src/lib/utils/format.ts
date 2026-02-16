/**
 * Funkcje formatowania dat i wartości dla warstwy prezentacji (UI).
 *
 * Konwencja:
 * - Baza danych i API: daty w ISO 8601 (YYYY-MM-DD), czasy HH:MM:SS, timestampy ISO.
 * - UI: daty w polskim formacie DD.MM.YYYY, czasy HH:MM.
 */

/**
 * Formatuje datę z ISO 8601 (YYYY-MM-DD) do polskiego formatu (DD.MM.YYYY).
 *
 * @param isoDate - Data w formacie YYYY-MM-DD lub null/undefined
 * @returns Data w formacie DD.MM.YYYY lub pusty string jeśli brak daty
 *
 * @example
 * formatDate("2026-02-12") // "12.02.2026"
 * formatDate(null)          // ""
 */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  return `${day}.${month}.${year}`;
}

/**
 * Formatuje timestamp ISO 8601 do polskiego formatu daty (DD.MM.YYYY) bez godziny.
 *
 * @param timestamp - Timestamp w formacie ISO 8601 (np. "2026-02-11T14:30:00Z") lub null/undefined
 * @returns Data w formacie DD.MM.YYYY lub pusty string jeśli brak daty
 *
 * @example
 * formatDateFromTimestamp("2026-02-11T14:30:00Z") // "11.02.2026"
 * formatDateFromTimestamp(null)                     // ""
 */
export function formatDateFromTimestamp(
  timestamp: string | null | undefined
): string {
  if (!timestamp) return "";
  const datePart = timestamp.split("T")[0];
  return formatDate(datePart);
}

/**
 * Formatuje czas z HH:MM:SS do HH:MM (obcina sekundy).
 *
 * @param time - Czas w formacie HH:MM lub HH:MM:SS, lub null/undefined
 * @returns Czas w formacie HH:MM lub pusty string
 *
 * @example
 * formatTime("08:30:00") // "08:30"
 * formatTime("14:00")    // "14:00"
 * formatTime(null)        // ""
 */
export function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  // Zwracamy tylko HH:MM (bez sekund)
  return time.substring(0, 5);
}

/**
 * Formatuje datę i czas do czytelnego skrótu DD.MM.YYYY HH:MM.
 *
 * @param isoDate - Data YYYY-MM-DD lub null
 * @param time - Czas HH:MM lub HH:MM:SS lub null
 * @returns Sformatowany ciąg lub pusty string
 *
 * @example
 * formatDateTime("2026-02-12", "08:30:00") // "12.02.2026 08:30"
 * formatDateTime("2026-02-12", null)         // "12.02.2026"
 * formatDateTime(null, "08:30")              // ""
 */
export function formatDateTime(
  isoDate: string | null | undefined,
  time: string | null | undefined
): string {
  const datePart = formatDate(isoDate);
  if (!datePart) return "";
  const timePart = formatTime(time);
  return timePart ? `${datePart} ${timePart}` : datePart;
}

/**
 * Formatuje kwotę z kodem waluty (np. "1 450 PLN").
 *
 * @param amount - Kwota lub null
 * @param currency - Kod waluty (PLN, EUR, USD)
 * @returns Sformatowana kwota lub pusty string
 *
 * @example
 * formatPrice(1450, "PLN")   // "1 450 PLN"
 * formatPrice(null, "EUR")   // ""
 */
export function formatPrice(
  amount: number | null | undefined,
  currency: string
): string {
  if (amount === null || amount === undefined) return "";
  // Formatowanie z separatorem tysięcy (spacja) — polski standard
  const formatted = new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${currency}`;
}

/**
 * Oblicza numer tygodnia ISO 8601 z daty.
 *
 * @param isoDate - Data w formacie YYYY-MM-DD
 * @returns Numer tygodnia (1-53) lub null
 */
export function getISOWeekNumber(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const date = new Date(isoDate + "T00:00:00");
  if (isNaN(date.getTime())) return null;

  // Algorytm ISO 8601 week number
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Niedziela = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Oblicza zakres dat (poniedziałek–niedziela) dla danego numeru tygodnia ISO 8601.
 * Używane do mapowania filtru "numer tygodnia" na dateFrom/dateTo.
 *
 * @param weekInput - Numer tygodnia (np. "07") lub rok-tydzień (np. "2026-07")
 * @returns Obiekt { dateFrom, dateTo } w formacie YYYY-MM-DD lub null przy błędnym wejściu
 *
 * @example
 * getWeekDateRange("07")      // { dateFrom: "2026-02-09", dateTo: "2026-02-15" } (dla bieżącego roku)
 * getWeekDateRange("2026-07") // { dateFrom: "2026-02-09", dateTo: "2026-02-15" }
 */
export function getWeekDateRange(
  weekInput: string
): { dateFrom: string; dateTo: string } | null {
  const trimmed = weekInput.trim();
  if (!trimmed) return null;

  let year: number;
  let week: number;

  if (trimmed.includes("-")) {
    // Format "2026-07"
    const parts = trimmed.split("-");
    year = parseInt(parts[0], 10);
    week = parseInt(parts[1], 10);
  } else {
    // Format "07" — bieżący rok
    year = new Date().getFullYear();
    week = parseInt(trimmed, 10);
  }

  if (isNaN(year) || isNaN(week) || week < 1 || week > 53) return null;

  // Obliczanie poniedziałku danego tygodnia ISO
  // 4 stycznia zawsze jest w tygodniu 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Niedziela = 7
  // Poniedziałek tygodnia 1
  const mondayWeek1 = new Date(jan4.getTime());
  mondayWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  // Poniedziałek żądanego tygodnia
  const monday = new Date(mondayWeek1.getTime());
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);

  // Niedziela tego tygodnia
  const sunday = new Date(monday.getTime());
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const pad = (n: number) => String(n).padStart(2, "0");

  const dateFrom = `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
  const dateTo = `${sunday.getUTCFullYear()}-${pad(sunday.getUTCMonth() + 1)}-${pad(sunday.getUTCDate())}`;

  return { dateFrom, dateTo };
}
