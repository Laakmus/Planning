// Główny serwis generowania PDF zlecenia transportowego
// Orkiestruje sekcje z pdf-sections.ts, zarządza stronicowaniem

import { jsPDF } from "jspdf";
import { registerFonts } from "./pdf-fonts";
import * as L from "./pdf-layout";
import {
  checkPageBreak,
  drawLogo,
  drawHeader,
  drawOrangeHeader,
  drawCarrier,
  drawVehicle,
  drawItemsHeader,
  drawItemRow,
  drawStop,
  drawPrice,
  drawDocuments,
  drawNotes,
  drawConfidentiality,
  drawPerson,
  type PdfOrderData,
  type PdfStopData,
  type PdfItemData,
} from "./pdf-sections";
import { LOGO_BASE64 } from "../../../components/orders/order-view/constants";

// ---------------------------------------------------------------------------
// Interfejs wejściowy
// ---------------------------------------------------------------------------

export interface GeneratePdfInput {
  order: PdfOrderData;
  stops: PdfStopData[];
  items: PdfItemData[];
}

// ---------------------------------------------------------------------------
// Generowanie PDF
// ---------------------------------------------------------------------------

export function generateOrderPdf(input: GeneratePdfInput): ArrayBuffer {
  const { order, stops, items } = input;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  registerFonts(doc);
  doc.setFont("Roboto", "normal");

  // 1. Logo (pozycja absolutna — nie wpływa na Y)
  drawLogo(doc, LOGO_BASE64);

  // 2-3. Nagłówek (ZLECENIE NR + ZLECAJĄCY)
  let y = L.MARGIN_TOP;
  y = drawHeader(doc, y, order);

  // 4. Orange header
  y = drawOrangeHeader(doc, y);

  // 5. Spedycja
  y = drawCarrier(doc, y, order);

  // 6. Typ auta
  y = drawVehicle(doc, y, order);

  // 7. Asortyment header
  y = drawItemsHeader(doc, y);

  // 8. Items grid (min 8 wierszy)
  const totalRows = Math.max(L.MIN_ITEM_ROWS, items.length);
  for (let i = 0; i < totalRows; i++) {
    y = checkPageBreak(doc, y, L.H_30);
    // Po page break — powtórzenie nagłówka asortymentu
    if (y === L.MARGIN_TOP) {
      y = drawItemsHeader(doc, y);
    }
    const item = i < items.length ? items[i] : null;
    const isLast = i === totalRows - 1;
    y = drawItemRow(doc, y, i, item, isLast);
  }

  // 9. Stops
  for (const stop of stops) {
    y = checkPageBreak(doc, y, L.H_17 * 2);
    if (y === L.MARGIN_TOP) {
      // Po page break — brak specjalnego nagłówka
    }
    y = drawStop(doc, y, stop, stops);
  }

  // 10. Gap
  y += L.GAP;

  // 11. Cena za fraht
  y = checkPageBreak(doc, y, L.H_24);
  y = drawPrice(doc, y, order);

  // 12. Dokumenty
  y = drawDocuments(doc, y, order);

  // 13. Gap
  y += L.GAP;

  // 14. Uwagi dodatkowe
  y = checkPageBreak(doc, y, L.H_46);
  y = drawNotes(doc, y, order);

  // 15. Klauzula poufności
  y = checkPageBreak(doc, y, L.H_64);
  y = drawConfidentiality(doc, y, order);

  // 16. Osoba zlecająca
  y = checkPageBreak(doc, y, L.H_31 + L.H_15 + L.H_12);
  drawPerson(doc, y, order);

  return doc.output("arraybuffer");
}
