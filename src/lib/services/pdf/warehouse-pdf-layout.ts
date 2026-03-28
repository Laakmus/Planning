// Stałe layoutu PDF raportu magazynowego — landscape A4

// Wymiary strony
export const PAGE_WIDTH = 297; // mm (landscape)
export const PAGE_HEIGHT = 210; // mm

// Marginesy
export const MARGIN_LEFT = 12;
export const MARGIN_TOP = 12;
export const MARGIN_RIGHT = 12;
export const MARGIN_BOTTOM = 12;

// Szerokość zawartości
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 273mm

// Kolumny tabeli (% CONTENT_WIDTH)
export const COL_TYPE_W = CONTENT_WIDTH * 0.05; // Typ (Z/R) — 13.65mm
export const COL_TIME_W = CONTENT_WIDTH * 0.07; // Godzina — 19.11mm
export const COL_ORDER_W = CONTENT_WIDTH * 0.12; // Nr zlecenia — 32.76mm
export const COL_CARGO_W = CONTENT_WIDTH * 0.32; // Towar/Masa — 87.36mm
export const COL_CARRIER_W = CONTENT_WIDTH * 0.22; // Przewoźnik — 60.06mm
export const COL_NOTIF_W = CONTENT_WIDTH * 0.22; // Awizacja — 60.06mm

// Wysokości
export const ROW_HEIGHT = 6; // mm per wiersz tabeli
export const DAY_HEADER_HEIGHT = 8; // mm nagłówek dnia
export const TABLE_HEADER_HEIGHT = 5; // mm nagłówek kolumn tabeli
export const TITLE_HEIGHT = 10; // mm tytuł raportu
export const SUBTITLE_HEIGHT = 6; // mm podtytuł (tydzień)

// Fonty (pt)
export const FONT_TITLE = 14;
export const FONT_SUBTITLE = 10;
export const FONT_DAY_HEADER = 11;
export const FONT_TABLE_HEADER = 7;
export const FONT_TABLE_CELL = 7;
export const FONT_SUMMARY = 9;
export const FONT_FOOTER = 7;

// Kolory
export const COLOR_BLACK = "#000000";
export const COLOR_WHITE = "#FFFFFF";
export const COLOR_LOADING_BG = "#dcfce7"; // emerald-100 (załadunek)
export const COLOR_UNLOADING_BG = "#dbeafe"; // blue-100 (rozładunek)
export const COLOR_HEADER_BG = "#f1f5f9"; // slate-100 (nagłówki)
export const COLOR_DAY_HEADER_BG = "#e2e8f0"; // slate-200 (nagłówek dnia)
export const COLOR_LINE = "#cbd5e1"; // slate-300 (linie)
export const COLOR_WEEKEND_TEXT = "#dc2626"; // red-600 (weekend marker)
export const COLOR_GRAY = "#64748b"; // slate-500

// Linia
export const LINE_W = 0.2; // mm
