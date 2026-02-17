/**
 * Narzędzia formatowania dat i czasu dla widoku frontendowego.
 *
 * Backend zawsze zwraca ISO 8601: daty jako YYYY-MM-DD, czasy jako HH:MM:SS.
 * Frontend wyświetla DD.MM.YYYY i HH:MM (bez sekund).
 */

/** Formatuje datę ISO (YYYY-MM-DD) → DD.MM.YYYY. Zwraca "—" gdy brak. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

/**
 * Formatuje timestamp ISO 8601 (np. "2026-02-17T14:32:01.000Z") → DD.MM.YYYY.
 * Wyciąga tylko część datową (przed T). Zwraca "—" gdy brak.
 */
export function formatDateFromTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return "—";
  const datePart = timestamp.split("T")[0];
  return formatDate(datePart);
}

/** Formatuje czas ISO (HH:MM:SS) → HH:MM. Zwraca "" gdy brak. */
export function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  return time.length >= 5 ? time.substring(0, 5) : time;
}

/**
 * Formatuje datę + czas → "DD.MM.YYYY HH:MM".
 * Zwraca "—" gdy brak daty; gdy brak czasu — tylko datę.
 */
export function formatDateTime(
  date: string | null | undefined,
  time: string | null | undefined
): string {
  const d = formatDate(date);
  if (d === "—") return "—";
  const t = formatTime(time);
  return t ? `${d} ${t}` : d;
}

/**
 * Skraca nazwę firmy/lokalizacji do pierwszego "słowa" (max 10 znaków).
 * Używane w RouteSummaryCell: L1:NordMetal → "NordMetal".
 */
export function shortenName(name: string | null | undefined): string {
  if (!name) return "?";
  // Bierz pierwsze słowo (split po spacji, przecinku, myślniku)
  const firstWord = name.split(/[\s,\-–]/)[0];
  return firstWord.substring(0, 10);
}
