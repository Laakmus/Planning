// Stałe layoutu PDF A4 — wymiary przeliczone z px (OrderDocument.tsx) na mm

// ---------------------------------------------------------------------------
// Wymiary strony A4
// ---------------------------------------------------------------------------

export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;

/** Współczynnik przeliczenia: 1px w OrderDocument (595px base) → mm */
export const PX = 210 / 595; // ≈ 0.35294

// ---------------------------------------------------------------------------
// Marginesy (z padding OrderDocument: 32px top/bottom, 34px left/right)
// ---------------------------------------------------------------------------

export const MARGIN_LEFT = 34 * PX;
export const MARGIN_TOP = 32 * PX;
export const MARGIN_BOTTOM = 32 * PX;

// ---------------------------------------------------------------------------
// Szerokości wierszy i komórek (w mm)
// ---------------------------------------------------------------------------

/** Pełna szerokość wiersza (526px) */
export const ROW_W = 526 * PX;
/** Węższa szerokość wiersza — nagłówek (449px) */
export const ROW_NARROW_W = 449 * PX;
/** Szerokość etykiety (98px) */
export const LABEL_W = 98 * PX;

// Kolumny wiersza SPEDYCJA / TYP AUTA
export const COL_MAIN_W = 314 * PX;
export const COL_SIDE_W = 113 * PX;

// Kolumny wiersza ZLECENIE NR
export const COL_ORDER_NO_W = 235 * PX;
export const COL_DATE_W = 116 * PX;

// Kolumny ITEMS
export const COL_ITEM_NAME_W = 234 * PX;
export const COL_ITEM_NOTES_W = 178 * PX;
export const COL_LUZEM_W = 33 * PX;
export const COL_BIGBAG_W = 28 * PX;
export const COL_PALETA_W = 29 * PX;
export const COL_INNA_W = 24 * PX;
/** Kolumna nazwy w headerze asortymentu (różni się od COL_ITEM_NAME_W) */
export const COL_ITEM_HEADER_NAME_W = 136 * PX;

// Kolumny STOPS
export const COL_STOP_VALUE_W = 375 * PX;
export const COL_STOP_TIME_W = 53 * PX;

// Sekcja OSOBA ZLECAJĄCA
export const PERSON_W = 191 * PX;
export const PERSON_OFFSET_X = 335 * PX;

// ---------------------------------------------------------------------------
// Wysokości wierszy (w mm)
// ---------------------------------------------------------------------------

export const H_23 = 23 * PX;
export const H_24 = 24 * PX;
export const H_26 = 26 * PX;
export const H_17 = 17 * PX;
export const H_30 = 30 * PX;
export const H_20 = 20 * PX;
export const H_46 = 46 * PX;
export const H_64 = 64 * PX;
export const H_31 = 31 * PX;
export const H_15 = 15 * PX;
export const H_12 = 12 * PX;
export const GAP = 8 * PX;

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

export const LOGO_X = 501 * PX;
export const LOGO_Y = 33 * PX;
export const LOGO_W = 57 * PX;
export const LOGO_H = 55 * PX;

// ---------------------------------------------------------------------------
// Rozmiary fontów (pt ≈ px w tym układzie)
// ---------------------------------------------------------------------------

export const FONT_5 = 5;
export const FONT_6 = 6;
export const FONT_6_5 = 6.5;
export const FONT_7 = 7;
export const FONT_8 = 8;
export const FONT_9 = 9;
export const FONT_9_5 = 9.5;

// ---------------------------------------------------------------------------
// Kolory
// ---------------------------------------------------------------------------

export const COLOR_BLACK = "#000000";
export const COLOR_WHITE = "#FFFFFF";
export const COLOR_LABEL_BG = "#E9E9E9"; // szare tło etykiet
export const COLOR_GRAY = "#9A9A9A"; // jasny szary tekst (sub-labels)
export const COLOR_GRAY2 = "#8D8D8D"; // ciemniejszy szary
export const COLOR_ORANGE = "#F59444"; // nagłówek / UNLOADING label
export const COLOR_ORANGE_LIGHT = "#FAD1A5"; // UNLOADING value bg
export const COLOR_LOADING_BG = "#E7E7E7"; // LOADING label bg

// ---------------------------------------------------------------------------
// Linia
// ---------------------------------------------------------------------------

export const LINE_W = 0.18; // mm (≈ 0.5px)

// ---------------------------------------------------------------------------
// Min wierszy towarów
// ---------------------------------------------------------------------------

export const MIN_ITEM_ROWS = 8;
