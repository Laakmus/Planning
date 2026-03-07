// Funkcje rysujące sekcje dokumentu PDF zlecenia transportowego
// Każda funkcja zwraca nową pozycję Y po narysowaniu sekcji

import type { jsPDF } from "jspdf";
import * as L from "./pdf-layout";

// ---------------------------------------------------------------------------
// Typy danych wejściowych
// ---------------------------------------------------------------------------

export interface PdfOrderData {
  orderNo: string;
  createdAt: string; // ISO date
  carrierName: string | null;
  carrierAddress: string | null;
  carrierTaxId: string | null;
  vehicleType: string | null;
  vehicleVolumeM3: number | null;
  priceAmount: number | null;
  currencyCode: string | null;
  paymentTermDays: number | null;
  paymentMethod: string | null;
  documentsText: string | null;
  generalNotes: string | null;
  confidentialityClause: string | null;
  senderContactName: string | null;
  senderContactEmail: string | null;
  senderContactPhone: string | null;
}

export interface PdfStopData {
  kind: string; // LOADING | UNLOADING
  sequenceNo: number;
  dateLocal: string | null;
  timeLocal: string | null;
  companyNameSnapshot: string | null;
  addressSnapshot: string | null;
  locationNameSnapshot: string | null;
  country: string | null;
}

export interface PdfItemData {
  productNameSnapshot: string | null;
  loadingMethodCode: string | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Stałe firmowe (tożsame z order-view/constants.ts)
// ---------------------------------------------------------------------------

const COMPANY_NAME =
  "ODYLION Sp. z o.o. Sp. k., ul. Syta 114z/1, 02-987 Warszawa PL 9512370578";

const CONDITIONS_HEADER =
  "ZLECAMY PAŃSTWU TRANSPORT NA NASTĘPUJĄCYCH WARUNKACH:";

const DEFAULT_CONFIDENTIALITY_CLAUSE =
  'Wszelkie informacje przekazane przez ODYLION Sp. z o.o. Sp. k. z siedzibą w Warszawie, KRS nr 0000474035, NIP: 9512370578 (dalej „ODYLION") dla celów realizacji niniejszego zlecenia transportowego, stanowią, w rozumieniu właściwych przepisów prawa, informacje poufne oraz tajemnicę handlową przedsiębiorstwa ODYLION, i jako takie mogą być wykorzystywane jedynie dla celów wykonania niniejszego zlecenia transportowego oraz jedynie przez podmioty wykonujące to zlecenie, w szczególności nie mogą zostać bez wyraźnej zgody ODYLION, w jakikolwiek sposób ujawnione innym podmiotom aniżeli wykonującym niniejsze zlecenie transportowe. Naruszenie powyższych obowiązków każdorazowo skutkować będzie odpowiedzialnością odszkodowawczą osób w sposób nieuprawniony ujawniających informacje poufne i handlowe ODYLION.';

// Mapowanie loadingMethodCode → typ pakowania (identyczne z order-view/types.ts)
const LOADING_TO_PACKAGING: Record<string, string> = {
  LUZEM: "LUZEM",
  PALETA_BIGBAG: "BIGBAG",
  PALETA: "PALETA",
  KOSZE: "INNA",
};

const PACKAGING_TYPES = ["LUZEM", "BIGBAG", "PALETA", "INNA"] as const;
const CURRENCIES = ["EUR", "USD", "PLN"] as const;

// ---------------------------------------------------------------------------
// Helpery rysowania
// ---------------------------------------------------------------------------

/** Prostokąt wypełniony kolorem */
function fillRect(doc: jsPDF, x: number, y: number, w: number, h: number, color: string): void {
  doc.setFillColor(color);
  doc.rect(x, y, w, h, "F");
}

/** Linia ciągła */
function solidLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number): void {
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(L.COLOR_BLACK);
  doc.setLineWidth(L.LINE_W);
  doc.line(x1, y1, x2, y2);
}

/** Linia przerywana */
function dashedLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number): void {
  doc.setLineDashPattern([1, 1], 0);
  doc.setDrawColor(L.COLOR_BLACK);
  doc.setLineWidth(L.LINE_W);
  doc.line(x1, y1, x2, y2);
  doc.setLineDashPattern([], 0);
}

/** Tekst z przycinaniem do szerokości komórki */
function cellText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  fontSize: number,
  style: "normal" | "bold" = "normal",
  color: string = L.COLOR_BLACK,
): void {
  doc.setFont("Roboto", style);
  doc.setFontSize(fontSize);
  doc.setTextColor(color);
  // Przytnij tekst jeśli za długi
  let t = text;
  while (doc.getTextWidth(t) > maxW && t.length > 1) {
    t = t.slice(0, -1);
  }
  doc.text(t, x, y);
}

/** Formatowanie daty ISO (YYYY-MM-DD lub timestamp) na DD.MM.YYYY */
function formatDate(iso: string | null): string {
  if (!iso) return "";
  // Wyciągnij część datową (przed T) — obsługuje zarówno YYYY-MM-DD jak i pełny timestamp ISO
  const datePart = iso.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

/** Formatowanie czasu (HH:MM, bez sekund — jak w OrderView) */
function formatTime(time: string | null): string {
  if (!time) return "";
  return time.length >= 5 ? time.substring(0, 5) : time;
}

// ---------------------------------------------------------------------------
// Sprawdzenie łamania strony
// ---------------------------------------------------------------------------

export function checkPageBreak(doc: jsPDF, currentY: number, neededHeight: number): number {
  const maxY = L.PAGE_HEIGHT_MM - L.MARGIN_BOTTOM;
  if (currentY + neededHeight > maxY) {
    doc.addPage();
    return L.MARGIN_TOP;
  }
  return currentY;
}

// ---------------------------------------------------------------------------
// 1. LOGO
// ---------------------------------------------------------------------------

export function drawLogo(doc: jsPDF, logoBase64: string): void {
  try {
    doc.addImage(logoBase64, "PNG", L.LOGO_X, L.LOGO_Y, L.LOGO_W, L.LOGO_H);
  } catch {
    // Jeśli logo nie da się załadować — pomijamy
  }
}

// ---------------------------------------------------------------------------
// 2. ZLECENIE NR + 3. ZLECAJĄCY
// ---------------------------------------------------------------------------

export function drawHeader(doc: jsPDF, y: number, data: PdfOrderData): number {
  const x = L.MARGIN_LEFT;

  // --- Wiersz 1: ZLECENIE NR ---
  const h1 = L.H_23;
  // Etykieta
  fillRect(doc, x, y, L.LABEL_W, h1, L.COLOR_LABEL_BG);
  solidLine(doc, x, y, x, y + h1); // lewa
  solidLine(doc, x, y, x + L.LABEL_W, y); // góra
  const labelY = y + h1 * 0.6;
  cellText(doc, "ZLECENIE NR:", x + 1, labelY, L.LABEL_W - 2, L.FONT_8, "bold");

  // Numer zlecenia
  const x2 = x + L.LABEL_W;
  solidLine(doc, x2, y, x2, y + h1);
  solidLine(doc, x2, y, x2 + L.COL_ORDER_NO_W, y);
  cellText(doc, "NUMER", x2 + 3.5, labelY, 20, L.FONT_5, "normal", L.COLOR_GRAY);
  cellText(doc, data.orderNo, x2 + 12, labelY, L.COL_ORDER_NO_W - 14, L.FONT_9, "bold");

  // Data wystawienia
  const x3 = x2 + L.COL_ORDER_NO_W;
  dashedLine(doc, x3, y, x3, y + h1);
  solidLine(doc, x3, y, x3 + L.COL_DATE_W, y);
  cellText(doc, "DATA", x3 + 2.5, y + 3.5, 20, L.FONT_5, "normal", L.COLOR_GRAY);
  cellText(doc, "WYST", x3 + 2.5, y + 5.5, 20, L.FONT_5, "normal", L.COLOR_GRAY);
  cellText(doc, formatDate(data.createdAt), x3 + 12, labelY, L.COL_DATE_W - 14, L.FONT_7);

  y += h1;

  // --- Wiersz 2: ZLECAJĄCY ---
  const h2 = L.H_23;
  fillRect(doc, x, y, L.LABEL_W, h2, L.COLOR_LABEL_BG);
  dashedLine(doc, x, y + h2, x + L.ROW_NARROW_W, y + h2); // dolna linia przerywana
  solidLine(doc, x + L.LABEL_W, y, x + L.LABEL_W, y + h2); // prawa etykiety
  const labelY2 = y + h2 * 0.55;
  cellText(doc, "ZLECAJĄCY:", x + 1, labelY2, L.LABEL_W - 2, L.FONT_7, "bold");

  // Wartość
  const x4 = x + L.LABEL_W;
  solidLine(doc, x4, y, x4, y + h2);
  cellText(doc, "PEŁNA", x4 + 3.5, y + 3.5, 20, L.FONT_5, "normal", L.COLOR_GRAY);
  cellText(doc, "NAZWA", x4 + 3.5, y + 5.5, 20, L.FONT_5, "normal", L.COLOR_GRAY);
  cellText(doc, COMPANY_NAME, x4 + 15, labelY2, L.ROW_NARROW_W - L.LABEL_W - 17, L.FONT_7);

  y += h2;
  return y;
}

// ---------------------------------------------------------------------------
// 4. ORANGE HEADER
// ---------------------------------------------------------------------------

export function drawOrangeHeader(doc: jsPDF, y: number): number {
  const x = L.MARGIN_LEFT;
  const h = L.H_26;
  solidLine(doc, x, y, x + L.ROW_NARROW_W, y);
  cellText(doc, CONDITIONS_HEADER, x + 3.5, y + h * 0.62, L.ROW_NARROW_W - 5, L.FONT_9_5, "bold", L.COLOR_ORANGE);
  return y + h;
}

// ---------------------------------------------------------------------------
// 5. SPEDYCJA
// ---------------------------------------------------------------------------

export function drawCarrier(doc: jsPDF, y: number, data: PdfOrderData): number {
  const x = L.MARGIN_LEFT;
  const h = L.H_24;

  // Etykieta
  fillRect(doc, x, y, L.LABEL_W, h, L.COLOR_LABEL_BG);
  solidLine(doc, x, y, x + L.ROW_W, y); // góra
  solidLine(doc, x + L.LABEL_W, y, x + L.LABEL_W, y + h); // prawa etykiety
  const lY = y + h * 0.7;
  cellText(doc, "SPEDYCJA:", x + 1, lY, L.LABEL_W - 2, L.FONT_7, "bold");

  // Pełna nazwa + adres
  const x2 = x + L.LABEL_W;
  solidLine(doc, x2, y, x2, y + h);
  cellText(doc, "PEŁNA", x2 + 1, y + 3.5, 15, L.FONT_5, "normal", L.COLOR_GRAY);
  cellText(doc, "NAZWA", x2 + 1, y + 5.5, 15, L.FONT_5, "normal", L.COLOR_GRAY);
  const nameX = x2 + 8;
  cellText(doc, data.carrierName ?? "", nameX, y + h * 0.38, L.COL_MAIN_W - 10, L.FONT_7, "bold");
  cellText(doc, data.carrierAddress ?? "", nameX, y + h * 0.68, L.COL_MAIN_W - 10, L.FONT_7);

  // NIP
  const x3 = x2 + L.COL_MAIN_W;
  dashedLine(doc, x3, y, x3, y + h);
  cellText(doc, "NIP", x3 + 1, y + h * 0.55, 10, L.FONT_5, "normal", L.COLOR_GRAY);
  cellText(doc, data.carrierTaxId ?? "", x3 + 8, y + h * 0.55, L.COL_SIDE_W - 10, L.FONT_7);

  return y + h;
}

// ---------------------------------------------------------------------------
// 6. TYP AUTA
// ---------------------------------------------------------------------------

export function drawVehicle(doc: jsPDF, y: number, data: PdfOrderData): number {
  const x = L.MARGIN_LEFT;
  const h = L.H_24;

  fillRect(doc, x, y, L.LABEL_W, h, L.COLOR_LABEL_BG);
  solidLine(doc, x, y, x + L.ROW_W, y);
  solidLine(doc, x + L.LABEL_W, y, x + L.LABEL_W, y + h);
  const lY = y + h * 0.7;
  cellText(doc, "TYP AUTA:", x + 1, lY, L.LABEL_W - 2, L.FONT_7, "bold");

  const x2 = x + L.LABEL_W;
  solidLine(doc, x2, y, x2, y + h);
  cellText(doc, "OPIS", x2 + 1, y + h * 0.55, 15, L.FONT_5, "normal", L.COLOR_GRAY);
  cellText(doc, data.vehicleType ?? "", x2 + 10, y + h * 0.55, L.COL_MAIN_W - 12, L.FONT_7, "bold");

  const x3 = x2 + L.COL_MAIN_W;
  dashedLine(doc, x3, y, x3, y + h);
  cellText(doc, "m3", x3 + 1.5, y + h * 0.55, 10, L.FONT_5, "normal", L.COLOR_GRAY);
  const volText = data.vehicleVolumeM3 != null ? String(data.vehicleVolumeM3) : "";
  cellText(doc, volText, x3 + 6, y + h * 0.55, L.COL_SIDE_W - 8, L.FONT_7);

  return y + h;
}

// ---------------------------------------------------------------------------
// 7. ASORTYMENT HEADER
// ---------------------------------------------------------------------------

export function drawItemsHeader(doc: jsPDF, y: number): number {
  const x = L.MARGIN_LEFT;
  const h = L.H_17;

  fillRect(doc, x, y, L.LABEL_W, h, L.COLOR_LABEL_BG);
  solidLine(doc, x, y, x + L.ROW_W, y);
  const lY = y + h * 0.72;
  cellText(doc, "ASORTYMENT:", x + 1, lY, L.LABEL_W - 2, L.FONT_7, "bold");

  // Kolumny nazwy i uwag
  let cx = x + L.LABEL_W;
  solidLine(doc, cx, y, cx, y + h);
  cx += L.COL_ITEM_HEADER_NAME_W;
  dashedLine(doc, cx, y, cx, y + h);
  // Nagłówek UWAGI
  const uwX = cx + L.COL_ITEM_NOTES_W / 2;
  cellText(doc, "UWAGI", uwX - 3.5, lY, 20, L.FONT_6, "normal", L.COLOR_GRAY2);
  cx += L.COL_ITEM_NOTES_W;

  // Nagłówki pakowania
  for (const pt of PACKAGING_TYPES) {
    const w = pt === "LUZEM" ? L.COL_LUZEM_W
      : pt === "BIGBAG" ? L.COL_BIGBAG_W
      : pt === "PALETA" ? L.COL_PALETA_W
      : L.COL_INNA_W;
    dashedLine(doc, cx, y, cx, y + h);
    cellText(doc, pt, cx + 0.5, lY, w - 1, L.FONT_6, "normal", L.COLOR_GRAY2);
    cx += w;
  }

  // Linia dolna nagłówka (separator między nagłówkami kolumn a wierszami towarów)
  solidLine(doc, x, y + h, x + L.ROW_W, y + h);

  return y + h;
}

// ---------------------------------------------------------------------------
// 8. ITEMS GRID (min 8 wierszy)
// ---------------------------------------------------------------------------

export function drawItemRow(
  doc: jsPDF,
  y: number,
  rowIdx: number,
  item: PdfItemData | null,
  isLast: boolean,
): number {
  const x = L.MARGIN_LEFT;
  const h = L.H_30;
  const bottomY = y + h;

  // Dolna linia (ciągła dla ostatniego, przerywana dla reszty)
  if (isLast) {
    solidLine(doc, x, bottomY, x + L.COL_ITEM_NAME_W + L.COL_ITEM_NOTES_W + L.COL_LUZEM_W + L.COL_BIGBAG_W + L.COL_PALETA_W + L.COL_INNA_W, bottomY);
  } else {
    dashedLine(doc, x, bottomY, x + L.COL_ITEM_NAME_W + L.COL_ITEM_NOTES_W + L.COL_LUZEM_W + L.COL_BIGBAG_W + L.COL_PALETA_W + L.COL_INNA_W, bottomY);
  }

  const textY = y + h * 0.65;

  if (item) {
    // Numer + nazwa
    cellText(doc, String(rowIdx + 1), x + 2, textY, 6, L.FONT_7, "bold");
    cellText(doc, item.productNameSnapshot ?? "", x + 7, textY, L.COL_ITEM_NAME_W - 9, L.FONT_7, "bold");

    // Uwagi
    let cx = x + L.COL_ITEM_NAME_W;
    dashedLine(doc, cx, y, cx, bottomY);
    cellText(doc, item.notes ?? "", cx + 1, textY, L.COL_ITEM_NOTES_W - 2, L.FONT_7);
    cx += L.COL_ITEM_NOTES_W;

    // Kolumny pakowania
    const packaging = item.loadingMethodCode
      ? LOADING_TO_PACKAGING[item.loadingMethodCode] ?? null
      : null;

    for (const pt of PACKAGING_TYPES) {
      const w = pt === "LUZEM" ? L.COL_LUZEM_W
        : pt === "BIGBAG" ? L.COL_BIGBAG_W
        : pt === "PALETA" ? L.COL_PALETA_W
        : L.COL_INNA_W;
      dashedLine(doc, cx, y, cx, bottomY);
      if (packaging === pt) {
        cellText(doc, "X", cx + w / 2 - 1.2, textY, 5, L.FONT_8, "bold");
      }
      cx += w;
    }
  } else {
    // Pusty wiersz — tylko linie pionowe
    let cx = x + L.COL_ITEM_NAME_W;
    dashedLine(doc, cx, y, cx, bottomY);
    cx += L.COL_ITEM_NOTES_W;
    for (const pt of PACKAGING_TYPES) {
      const w = pt === "LUZEM" ? L.COL_LUZEM_W
        : pt === "BIGBAG" ? L.COL_BIGBAG_W
        : pt === "PALETA" ? L.COL_PALETA_W
        : L.COL_INNA_W;
      dashedLine(doc, cx, y, cx, bottomY);
      cx += w;
    }
  }

  return bottomY;
}

// ---------------------------------------------------------------------------
// 9. STOPS
// ---------------------------------------------------------------------------

export function drawStop(
  doc: jsPDF,
  y: number,
  stop: PdfStopData,
  allStops: PdfStopData[],
): number {
  const x = L.MARGIN_LEFT;
  const isLoading = stop.kind === "LOADING";
  const stopsOfKind = allStops.filter((s) => s.kind === stop.kind);
  const kindIndex = stopsOfKind.indexOf(stop);
  const kindCount = stopsOfKind.length;

  const kindLabel = isLoading ? "ZAŁADUNKU" : "ROZŁADUNKU";
  const numberSuffix = kindCount > 1 ? ` ${kindIndex + 1}` : "";
  const dateLabel = `DATA ${kindLabel}${numberSuffix}:`;
  const placeLabel = `MIEJSCE ${kindLabel}${numberSuffix}:`;

  const labelBg = isLoading ? L.COLOR_LOADING_BG : L.COLOR_ORANGE;
  const valueBg = isLoading ? null : L.COLOR_ORANGE_LIGHT;

  // --- Wiersz DATA ---
  const h1 = L.H_17;
  fillRect(doc, x, y, L.LABEL_W, h1, labelBg);
  solidLine(doc, x, y, x + L.ROW_W, y); // góra
  solidLine(doc, x + L.LABEL_W, y, x + L.LABEL_W, y + h1); // prawa etykiety

  if (valueBg) {
    fillRect(doc, x + L.LABEL_W, y, L.COL_STOP_VALUE_W + L.COL_STOP_TIME_W, h1, valueBg);
    // Odtwórz górną linię nad wypełnieniem
    solidLine(doc, x + L.LABEL_W, y, x + L.ROW_W, y);
  }

  const dateTextY = y + h1 * 0.72;
  cellText(doc, dateLabel, x + 1, dateTextY, L.LABEL_W - 2, L.FONT_7, "bold");

  // Wartość daty
  const dateX = x + L.LABEL_W;
  solidLine(doc, dateX, y, dateX, y + h1);
  cellText(doc, formatDate(stop.dateLocal), dateX + 4, dateTextY, L.COL_STOP_VALUE_W - 6, L.FONT_7);

  // Czas
  const timeX = dateX + L.COL_STOP_VALUE_W;
  dashedLine(doc, timeX, y, timeX, y + h1);
  cellText(doc, "GOD.", timeX + 1, dateTextY, 8, L.FONT_5, "bold", L.COLOR_GRAY);
  cellText(doc, formatTime(stop.timeLocal), timeX + 6, dateTextY, L.COL_STOP_TIME_W - 8, L.FONT_7);

  y += h1;

  // --- Wiersz MIEJSCE ---
  const h2 = L.H_17;
  fillRect(doc, x, y, L.LABEL_W, h2, labelBg);
  solidLine(doc, x + L.LABEL_W, y, x + L.LABEL_W, y + h2);

  if (valueBg) {
    fillRect(doc, x + L.LABEL_W, y, L.COL_STOP_VALUE_W + L.COL_STOP_TIME_W, h2, valueBg);
  }

  // Dolna linia przerywana
  dashedLine(doc, x, y + h2, x + L.ROW_W, y + h2);

  const placeTextY = y + h2 * 0.65;
  cellText(doc, placeLabel, x + 1, placeTextY, L.LABEL_W - 2, L.FONT_7, "bold");

  // Tekst miejsca: firma + adres
  const placeX = x + L.LABEL_W;
  solidLine(doc, placeX, y, placeX, y + h2);
  const placeStr = [stop.companyNameSnapshot, stop.addressSnapshot]
    .filter(Boolean)
    .join(", ");
  cellText(doc, placeStr || stop.locationNameSnapshot || "", placeX + 4, placeTextY, L.COL_STOP_VALUE_W - 6, L.FONT_7, "bold");

  // Kraj
  const krajX = placeX + L.COL_STOP_VALUE_W;
  dashedLine(doc, krajX, y, krajX, y + h2);
  cellText(doc, "KRAJ", krajX + 1, placeTextY, 8, L.FONT_5, "bold", L.COLOR_GRAY);
  cellText(doc, stop.country ?? "", krajX + 6, placeTextY, L.COL_STOP_TIME_W - 8, L.FONT_7, "bold");

  y += h2;
  return y;
}

// ---------------------------------------------------------------------------
// 11. CENA ZA FRAHT
// ---------------------------------------------------------------------------

export function drawPrice(doc: jsPDF, y: number, data: PdfOrderData): number {
  const x = L.MARGIN_LEFT;
  const h = L.H_24;

  // Etykieta
  fillRect(doc, x, y, L.LABEL_W, h, L.COLOR_LABEL_BG);
  solidLine(doc, x, y, x + L.ROW_W, y);
  solidLine(doc, x, y + h, x + L.ROW_W, y + h);
  solidLine(doc, x + L.LABEL_W, y, x + L.LABEL_W, y + h);
  cellText(doc, "CENA ZA FRAHT:", x + 1, y + h * 0.55, L.LABEL_W - 2, L.FONT_7, "bold");

  const contentX = x + L.LABEL_W + 3.5;
  const midY = y + h * 0.55;

  // KWOTA
  cellText(doc, "KWOTA", contentX, y + 3.5, 15, L.FONT_5, "bold", L.COLOR_GRAY);
  const amountStr = data.priceAmount != null ? String(data.priceAmount) : "";
  cellText(doc, amountStr, contentX, midY + 1.5, 18, L.FONT_7, "bold");

  // Selektor waluty (3 kratki)
  let curX = contentX + 20;
  for (const cur of CURRENCIES) {
    cellText(doc, cur, curX, midY, 10, L.FONT_5, "bold", L.COLOR_GRAY);
    curX += 5;
    // Znacznik waluty (bez ramki — jak w OrderView)
    if (data.currencyCode === cur) {
      cellText(doc, "X", curX + 1.2, midY + 0.5, 5, L.FONT_8, "bold");
    }
    curX += 8;
  }

  // TERMIN PŁATNOŚCI
  curX += 2;
  cellText(doc, "TERMIN", curX, y + 3.2, 15, L.FONT_5, "bold", L.COLOR_GRAY);
  cellText(doc, "PŁATNOŚCI", curX, y + 5.2, 18, L.FONT_5, "bold", L.COLOR_GRAY);
  const termX = curX + 12;
  const termStr = data.paymentTermDays != null ? String(data.paymentTermDays) : "";
  cellText(doc, termStr, termX, midY, 10, L.FONT_7, "bold");
  cellText(doc, " DNI", termX + doc.getTextWidth(termStr), midY, 10, L.FONT_7, "bold");

  // FORMA PŁATNOŚCI
  const formaX = termX + 18;
  cellText(doc, "FORMA", formaX, y + 3.2, 15, L.FONT_5, "bold", L.COLOR_GRAY);
  cellText(doc, "PŁATNOŚCI", formaX, y + 5.2, 18, L.FONT_5, "bold", L.COLOR_GRAY);
  cellText(doc, data.paymentMethod ?? "", formaX + 12, midY, 25, L.FONT_7, "bold");

  return y + h;
}

// ---------------------------------------------------------------------------
// 12. DOKUMENTY
// ---------------------------------------------------------------------------

export function drawDocuments(doc: jsPDF, y: number, data: PdfOrderData): number {
  const x = L.MARGIN_LEFT;
  const h = L.H_20;

  solidLine(doc, x, y, x + L.ROW_W, y);
  solidLine(doc, x + L.LABEL_W, y, x + L.LABEL_W, y + h);
  const lY = y + h * 0.6;
  cellText(doc, "Dokumenty dla kierowcy:", x + 1, lY, L.LABEL_W - 2, L.FONT_7, "bold");
  cellText(doc, data.documentsText ?? "", x + L.LABEL_W + 1, lY, L.ROW_W - L.LABEL_W - 2, L.FONT_7, "bold");

  return y + h;
}

// ---------------------------------------------------------------------------
// 14. UWAGI DODATKOWE
// ---------------------------------------------------------------------------

export function drawNotes(doc: jsPDF, y: number, data: PdfOrderData): number {
  const x = L.MARGIN_LEFT;
  const h = L.H_46;
  const contentW = L.ROW_W - L.LABEL_W;

  solidLine(doc, x, y, x + L.ROW_W, y);
  solidLine(doc, x, y + h, x + L.ROW_W, y + h);
  solidLine(doc, x + L.LABEL_W, y, x + L.LABEL_W, y + h);
  cellText(doc, "Uwagi dodatkowe:", x + 1, y + 4, L.LABEL_W - 2, L.FONT_7, "bold");

  // Tekst wieloliniowy
  const text = data.generalNotes ?? "";
  if (text) {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(L.FONT_7);
    doc.setTextColor(L.COLOR_BLACK);
    const lines = doc.splitTextToSize(text, contentW - 2);
    doc.text(lines, x + L.LABEL_W + 1, y + 4, { lineHeightFactor: 1.4 });
  }

  return y + h;
}

// ---------------------------------------------------------------------------
// 15. KLAUZULA POUFNOŚCI
// ---------------------------------------------------------------------------

export function drawConfidentiality(doc: jsPDF, y: number, data: PdfOrderData): number {
  const x = L.MARGIN_LEFT;
  const h = L.H_64;
  const contentW = L.ROW_W - L.LABEL_W;

  solidLine(doc, x, y, x + L.ROW_W, y);
  solidLine(doc, x, y + h, x + L.ROW_W, y + h);
  solidLine(doc, x + L.LABEL_W, y, x + L.LABEL_W, y + h);
  cellText(doc, "Klauzula o zachowaniu", x + 1, y + 4, L.LABEL_W - 2, L.FONT_7, "bold");
  cellText(doc, "poufności", x + 1, y + 7, L.LABEL_W - 2, L.FONT_7, "bold");

  const text = data.confidentialityClause || DEFAULT_CONFIDENTIALITY_CLAUSE;
  if (text) {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(L.FONT_6_5);
    doc.setTextColor(L.COLOR_BLACK);
    const lines = doc.splitTextToSize(text, contentW - 2);
    doc.text(lines, x + L.LABEL_W + 1, y + 3.5, { lineHeightFactor: 1.25 });
  }

  return y + h;
}

// ---------------------------------------------------------------------------
// 16. OSOBA ZLECAJĄCA
// ---------------------------------------------------------------------------

export function drawPerson(doc: jsPDF, y: number, data: PdfOrderData): number {
  const x = L.MARGIN_LEFT + L.PERSON_OFFSET_X;
  const w = L.PERSON_W;

  // Nagłówek
  const h1 = L.H_31;
  solidLine(doc, x, y, x, y + h1); // lewa
  cellText(doc, "OSOBA ZLECAJĄCA:", x + 2.5, y + 4, w - 5, L.FONT_7, "bold");
  cellText(doc, data.senderContactName ?? "", x + 2.5, y + 7.5, w - 5, L.FONT_7);
  y += h1;

  // Email
  const h2 = L.H_15;
  dashedLine(doc, x, y, x + w, y);
  const emailLabelW = 14;
  cellText(doc, "E-MAIL", x + 2.5, y + h2 * 0.6, emailLabelW, L.FONT_6, "normal", L.COLOR_GRAY2);
  dashedLine(doc, x + emailLabelW, y, x + emailLabelW, y + h2);
  cellText(doc, data.senderContactEmail ?? "", x + emailLabelW + 2.5, y + h2 * 0.6, w - emailLabelW - 3, L.FONT_7);
  y += h2;

  // Telefon
  const h3 = L.H_12;
  dashedLine(doc, x, y, x + w, y);
  cellText(doc, "TELEFON", x + 2.5, y + h3 * 0.65, emailLabelW, L.FONT_6, "normal", L.COLOR_GRAY2);
  dashedLine(doc, x + emailLabelW, y, x + emailLabelW, y + h3);
  cellText(doc, data.senderContactPhone ?? "", x + emailLabelW + 2.5, y + h3 * 0.65, w - emailLabelW - 3, L.FONT_7);
  y += h3;
  solidLine(doc, x, y, x + w, y); // dolna linia ciągła

  return y;
}
