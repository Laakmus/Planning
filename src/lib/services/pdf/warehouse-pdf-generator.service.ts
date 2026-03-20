// Generator PDF raportu tygodniowego magazynu
// Landscape A4, tabele per dzień, podsumowanie tygodnia

import { jsPDF } from "jspdf";
import { registerFonts } from "./pdf-fonts";
import * as L from "./warehouse-pdf-layout";
import type { WarehouseWeekResponseDto, WarehouseOrderEntryDto } from "../../../types";

export interface GenerateWarehouseReportInput {
  data: WarehouseWeekResponseDto;
}

export function generateWarehouseReportPdf(input: GenerateWarehouseReportInput): ArrayBuffer {
  const { data } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  registerFonts(doc);
  doc.setFont("Roboto", "normal");

  let y = L.MARGIN_TOP;

  // Tytuł
  y = drawTitle(doc, y, data);

  // Tabela per dzień
  for (const day of data.days) {
    if (day.entries.length === 0) continue; // pomiń puste dni

    // Sprawdź czy zmieści się nagłówek + min 1 wiersz
    y = checkPageBreak(doc, y, L.DAY_HEADER_HEIGHT + L.TABLE_HEADER_HEIGHT + L.ROW_HEIGHT);

    y = drawDayHeader(doc, y, day.dayName, day.date);
    y = drawTableHeader(doc, y);

    for (const entry of day.entries) {
      const entryH = calcRowHeight(doc, entry);
      y = checkPageBreak(doc, y, entryH);
      if (y === L.MARGIN_TOP) {
        // Po page break — powtórz nagłówek
        y = drawDayHeader(doc, y, day.dayName + " (c.d.)", day.date);
        y = drawTableHeader(doc, y);
      }
      y = drawEntryRow(doc, y, entry);
    }

    y += 3; // gap między dniami
  }

  // Sekcja "Bez przypisanej daty"
  if (data.noDateEntries.length > 0) {
    y = checkPageBreak(doc, y, L.DAY_HEADER_HEIGHT + L.TABLE_HEADER_HEIGHT + L.ROW_HEIGHT);
    y = drawDayHeader(doc, y, "BEZ PRZYPISANEJ DATY", null);
    y = drawTableHeader(doc, y);

    for (const entry of data.noDateEntries) {
      const entryH = calcRowHeight(doc, entry);
      y = checkPageBreak(doc, y, entryH);
      if (y === L.MARGIN_TOP) {
        y = drawDayHeader(doc, y, "BEZ PRZYPISANEJ DATY (c.d.)", null);
        y = drawTableHeader(doc, y);
      }
      y = drawEntryRow(doc, y, entry);
    }
    y += 3;
  }

  // Podsumowanie tygodnia
  y = checkPageBreak(doc, y, 20);
  y = drawSummary(doc, y, data);

  // Stopka z datą wygenerowania
  drawFooter(doc);

  return doc.output("arraybuffer");
}

// ---------------------------------------------------------------------------
// Helpery
// ---------------------------------------------------------------------------

function checkPageBreak(doc: jsPDF, currentY: number, neededHeight: number): number {
  const maxY = L.PAGE_HEIGHT - L.MARGIN_BOTTOM;
  if (currentY + neededHeight > maxY) {
    doc.addPage();
    return L.MARGIN_TOP;
  }
  return currentY;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const parts = iso.split("T")[0].split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatTime(time: string | null): string {
  if (!time) return "";
  return time.length >= 5 ? time.substring(0, 5) : time;
}

/** Wysokość jednej linii tekstu w mm (fontSize w pt → mm, z interlinią 1.3) */
const LINE_HEIGHT_FACTOR = 1.3;
function lineHeightMm(fontSize: number): number {
  // 1pt ≈ 0.3528mm; jsPDF fontSize jest w pt
  return fontSize * 0.3528 * LINE_HEIGHT_FACTOR;
}

/** Tekst jednoliniowy z przycinaniem do maxW */
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
  let t = text;
  while (doc.getTextWidth(t) > maxW && t.length > 1) {
    t = t.slice(0, -1);
  }
  doc.text(t, x, y);
}

/** Tekst wieloliniowy z zawijaniem — zwraca liczbę narysowanych linii */
function multiCellText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  fontSize: number,
  style: "normal" | "bold" = "normal",
  color: string = L.COLOR_BLACK,
): number {
  if (!text) return 1;
  doc.setFont("Roboto", style);
  doc.setFontSize(fontSize);
  doc.setTextColor(color);
  const lines: string[] = doc.splitTextToSize(text, maxW);
  const lh = lineHeightMm(fontSize);
  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i], x, y + i * lh);
  }
  return lines.length;
}

/** Oblicza liczbę linii potrzebnych dla tekstu w kolumnie o danej szerokości */
function measureLines(doc: jsPDF, text: string, maxW: number, fontSize: number, style: "normal" | "bold" = "normal"): number {
  if (!text) return 1;
  doc.setFont("Roboto", style);
  doc.setFontSize(fontSize);
  const lines: string[] = doc.splitTextToSize(text, maxW);
  return Math.max(1, lines.length);
}

/** Oblicza dynamiczną wysokość wiersza na podstawie zawartości wszystkich kolumn */
function calcRowHeight(doc: jsPDF, entry: WarehouseOrderEntryDto): number {
  const padding = 2; // mm padding góra+dół
  const colWidths = [
    { text: entry.stopType === "LOADING" ? "Z" : "R", w: L.COL_TYPE_W, style: "bold" as const },
    { text: formatTime(entry.timeLocal) + (entry.isWeekend ? " *" : ""), w: L.COL_TIME_W, style: "normal" as const },
    { text: entry.orderNo, w: L.COL_ORDER_W, style: "bold" as const },
    { text: formatCargo(entry), w: L.COL_CARGO_W, style: "normal" as const },
    { text: entry.carrierName ?? "", w: L.COL_CARRIER_W, style: "normal" as const },
    { text: entry.notificationDetails ?? "", w: L.COL_NOTIF_W, style: "normal" as const },
  ];

  let maxLines = 1;
  for (const col of colWidths) {
    const lines = measureLines(doc, col.text, col.w - 2, L.FONT_TABLE_CELL, col.style);
    if (lines > maxLines) maxLines = lines;
  }

  const textHeight = maxLines * lineHeightMm(L.FONT_TABLE_CELL);
  return Math.max(L.ROW_HEIGHT, textHeight + padding);
}

function fillRect(doc: jsPDF, x: number, y: number, w: number, h: number, color: string): void {
  doc.setFillColor(color);
  doc.rect(x, y, w, h, "F");
}

function hLine(doc: jsPDF, x1: number, y1: number, x2: number): void {
  doc.setDrawColor(L.COLOR_LINE);
  doc.setLineWidth(L.LINE_W);
  doc.line(x1, y1, x2, y1);
}

// ---------------------------------------------------------------------------
// Sekcje
// ---------------------------------------------------------------------------

function drawTitle(doc: jsPDF, y: number, data: WarehouseWeekResponseDto): number {
  const x = L.MARGIN_LEFT;

  // Tytuł główny
  cellText(doc, `PLAN ZAŁADUNKOWY — MAGAZYN ${data.locationName.toUpperCase()}`, x, y + 8, L.CONTENT_WIDTH, L.FONT_TITLE, "bold");
  y += L.TITLE_HEIGHT;

  // Podtytuł z zakresem dat
  const weekRange = `Tydzień ${data.week} (${formatDate(data.weekStart)} – ${formatDate(data.weekEnd)})`;
  cellText(doc, weekRange, x, y + 4, L.CONTENT_WIDTH, L.FONT_SUBTITLE, "normal", L.COLOR_GRAY);
  y += L.SUBTITLE_HEIGHT + 3;

  return y;
}

function drawDayHeader(doc: jsPDF, y: number, dayName: string, date: string | null): number {
  const x = L.MARGIN_LEFT;
  fillRect(doc, x, y, L.CONTENT_WIDTH, L.DAY_HEADER_HEIGHT, L.COLOR_DAY_HEADER_BG);
  const label = date ? `${dayName.toUpperCase()} ${formatDate(date)}` : dayName.toUpperCase();
  cellText(doc, label, x + 2, y + L.DAY_HEADER_HEIGHT * 0.65, L.CONTENT_WIDTH - 4, L.FONT_DAY_HEADER, "bold");
  return y + L.DAY_HEADER_HEIGHT;
}

function drawTableHeader(doc: jsPDF, y: number): number {
  const x = L.MARGIN_LEFT;
  fillRect(doc, x, y, L.CONTENT_WIDTH, L.TABLE_HEADER_HEIGHT, L.COLOR_HEADER_BG);

  let cx = x;
  const headerY = y + L.TABLE_HEADER_HEIGHT * 0.7;
  const headers = [
    { label: "Typ", w: L.COL_TYPE_W },
    { label: "Godz.", w: L.COL_TIME_W },
    { label: "Nr zlecenia", w: L.COL_ORDER_W },
    { label: "Towar / Masa", w: L.COL_CARGO_W },
    { label: "Przewoźnik", w: L.COL_CARRIER_W },
    { label: "Awizacja", w: L.COL_NOTIF_W },
  ];

  for (const h of headers) {
    cellText(doc, h.label, cx + 1, headerY, h.w - 2, L.FONT_TABLE_HEADER, "bold", L.COLOR_GRAY);
    cx += h.w;
  }

  hLine(doc, x, y + L.TABLE_HEADER_HEIGHT, x + L.CONTENT_WIDTH);
  return y + L.TABLE_HEADER_HEIGHT;
}

function drawEntryRow(doc: jsPDF, y: number, entry: WarehouseOrderEntryDto): number {
  const x = L.MARGIN_LEFT;
  const isLoading = entry.stopType === "LOADING";
  const bgColor = isLoading ? L.COLOR_LOADING_BG : L.COLOR_UNLOADING_BG;

  // Oblicz dynamiczną wysokość wiersza
  const rowH = calcRowHeight(doc, entry);

  // Tło wiersza (dynamiczna wysokość)
  fillRect(doc, x, y, L.CONTENT_WIDTH, rowH, bgColor);

  // Pozycja bazowa tekstu (1mm od góry wiersza + offset pierwszej linii)
  const textTopY = y + 1 + lineHeightMm(L.FONT_TABLE_CELL) * 0.75;
  let cx = x;

  // Typ (Z/R) — jednoliniowy, wycentrowany pionowo
  const typeLabel = isLoading ? "Z" : "R";
  cellText(doc, typeLabel, cx + 1, y + rowH * 0.5 + 1, L.COL_TYPE_W - 2, L.FONT_TABLE_CELL, "bold");
  cx += L.COL_TYPE_W;

  // Godzina — jednoliniowy
  const timeStr = formatTime(entry.timeLocal);
  const timeDisplay = entry.isWeekend ? `${timeStr} *` : timeStr;
  cellText(doc, timeDisplay, cx + 1, y + rowH * 0.5 + 1, L.COL_TIME_W - 2, L.FONT_TABLE_CELL, "normal", entry.isWeekend ? L.COLOR_WEEKEND_TEXT : L.COLOR_BLACK);
  cx += L.COL_TIME_W;

  // Nr zlecenia — jednoliniowy
  cellText(doc, entry.orderNo, cx + 1, y + rowH * 0.5 + 1, L.COL_ORDER_W - 2, L.FONT_TABLE_CELL, "bold");
  cx += L.COL_ORDER_W;

  // Towar / Masa — wieloliniowy
  const cargoText = formatCargo(entry);
  multiCellText(doc, cargoText, cx + 1, textTopY, L.COL_CARGO_W - 2, L.FONT_TABLE_CELL);
  cx += L.COL_CARGO_W;

  // Przewoźnik — wieloliniowy
  multiCellText(doc, entry.carrierName ?? "", cx + 1, textTopY, L.COL_CARRIER_W - 2, L.FONT_TABLE_CELL);
  cx += L.COL_CARRIER_W;

  // Awizacja — wieloliniowy
  multiCellText(doc, entry.notificationDetails ?? "", cx + 1, textTopY, L.COL_NOTIF_W - 2, L.FONT_TABLE_CELL);

  // Linia dolna
  hLine(doc, x, y + rowH, x + L.CONTENT_WIDTH);

  return y + rowH;
}

/** Formatuje towar — każda pozycja w osobnej linii, z łączną masą na końcu */
function formatCargo(entry: WarehouseOrderEntryDto): string {
  if (entry.items.length === 0) return "";
  const lines = entry.items.map((item) => {
    let s = item.productName || "?";
    if (item.loadingMethod) s += ` (${item.loadingMethod.toLowerCase()})`;
    if (item.weightTons != null) s += ` ${item.weightTons}t`;
    return s;
  });
  if (entry.totalWeightTons != null && entry.items.length > 1) {
    lines.push(`Razem: ${entry.totalWeightTons}t`);
  }
  return lines.join("\n");
}

function drawSummary(doc: jsPDF, y: number, data: WarehouseWeekResponseDto): number {
  const x = L.MARGIN_LEFT;

  // Linia oddzielająca
  hLine(doc, x, y, x + L.CONTENT_WIDTH);
  y += 3;

  cellText(doc, "PODSUMOWANIE TYGODNIA", x, y + 5, L.CONTENT_WIDTH, L.FONT_SUMMARY, "bold");
  y += 7;

  const totalTons = data.summary.loadingTotalTons + data.summary.unloadingTotalTons;
  const lines = [
    `Załadunki: ${data.summary.loadingCount} operacji (${data.summary.loadingTotalTons.toFixed(1)} t)`,
    `Rozładunki: ${data.summary.unloadingCount} operacji (${data.summary.unloadingTotalTons.toFixed(1)} t)`,
    `Łącznie: ${totalTons.toFixed(1)} t`,
  ];

  for (const line of lines) {
    cellText(doc, line, x + 2, y + 4, L.CONTENT_WIDTH - 4, L.FONT_TABLE_CELL);
    y += 5;
  }

  return y;
}

function drawFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const now = new Date();
  const timestamp = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = L.PAGE_HEIGHT - L.MARGIN_BOTTOM + 4;
    cellText(doc, `Wygenerowano: ${timestamp}`, L.MARGIN_LEFT, footerY, 80, L.FONT_FOOTER, "normal", L.COLOR_GRAY);
    if (pageCount > 1) {
      const pageStr = `Strona ${i} z ${pageCount}`;
      doc.setFont("Roboto", "normal");
      doc.setFontSize(L.FONT_FOOTER);
      const pageW = doc.getTextWidth(pageStr);
      cellText(doc, pageStr, L.PAGE_WIDTH - L.MARGIN_RIGHT - pageW, footerY, 40, L.FONT_FOOTER, "normal", L.COLOR_GRAY);
    }
  }
}
