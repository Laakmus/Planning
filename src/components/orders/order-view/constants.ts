// Order View - Stale i helpery

import type { OrderViewItem, OrderViewStop, PackagingType } from "./types";
import type { StopKind } from "@/lib/view-models";

// ---------------------------------------------------------------------------
// Stale firmowe
// ---------------------------------------------------------------------------

export const COMPANY_NAME =
  "ODYLION Sp. z o.o. Sp. k., ul. Syta 114z/1, 02-987 Warszawa PL 9512370578";

export const CONDITIONS_HEADER =
  "ZLECAMY PAŃSTWU TRANSPORT NA NASTĘPUJĄCYCH WARUNKACH:";

export const DEFAULT_CONFIDENTIALITY_CLAUSE =
  'Wszelkie informacje przekazane przez ODYLION Sp. z o.o. Sp. k. z siedzibą w Warszawie, KRS nr 0000474035, NIP: 9512370578 (dalej „ODYLION") dla celów realizacji niniejszego zlecenia transportowego, stanowią, w rozumieniu właściwych przepisów prawa, informacje poufne oraz tajemnicę handlową przedsiębiorstwa ODYLION, i jako takie mogą być wykorzystywane jedynie dla celów wykonania niniejszego zlecenia transportowego oraz jedynie przez podmioty wykonujące to zlecenie, w szczególności nie mogą zostać bez wyraźnej zgody ODYLION, w jakikolwiek sposób ujawnione innym podmiotom aniżeli wykonującym niniejsze zlecenie transportowe. Naruszenie powyższych obowiązków każdorazowo skutkować będzie odpowiedzialnością odszkodowawczą osób w sposób nieuprawniony ujawniających informacje poufne i handlowe ODYLION.';

// ---------------------------------------------------------------------------
// Logo (base64 PNG)
// ---------------------------------------------------------------------------

export const LOGO_BASE64 =
  "data:image/png;base64,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";

// ---------------------------------------------------------------------------
// Opcje select
// ---------------------------------------------------------------------------

export const DOCUMENTS_OPTIONS = [
  "WZ, KPO, kwit wagowy",
  "WZE, Aneks VII, CMR",
] as const;

export const PAYMENT_METHODS = ["Przelew", "Gotówka", "Karta"] as const;

export const PACKAGING_TYPES: PackagingType[] = [
  "LUZEM",
  "BIGBAG",
  "PALETA",
  "INNA",
];

export const CURRENCIES = ["EUR", "USD", "PLN"] as const;

// ---------------------------------------------------------------------------
// Time slots (48 slotow co 30 min: 00:00-23:30)
// ---------------------------------------------------------------------------

export const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      slots.push(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      );
    }
  }
  return slots;
})();

// ---------------------------------------------------------------------------
// Layout constants (A4)
// ---------------------------------------------------------------------------

export const CELL = "flex items-center px-1 overflow-hidden";
export const LABEL_98 = `${CELL} w-[98px] shrink-0 bg-[#E9E9E9]`;
export const ROW_526 = "flex w-[526px]";
export const ROW_449 = "flex w-[449px]";

// ---------------------------------------------------------------------------
// Limity
// ---------------------------------------------------------------------------

/** Minimalna liczba wizualnych slotow w tabeli towarow */
export const MIN_VISIBLE_ITEMS = 8;

/** Maksymalna liczba pozycji towarowych */
export const MAX_VISIBLE_ITEMS = 15;

/** Maks. punktow zaladunku */
export const MAX_LOADING_STOPS = 8;

/** Maks. punktow rozladunku */
export const MAX_UNLOADING_STOPS = 3;

// ---------------------------------------------------------------------------
// Helpery
// ---------------------------------------------------------------------------

export function generateId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyItem(): OrderViewItem {
  return { id: generateId(), name: "", notes: "", packagingType: null };
}

export function createEmptyStop(kind: StopKind): OrderViewStop {
  return {
    id: generateId(),
    kind,
    sequenceNo: 0,
    date: null,
    time: null,
    companyId: null,
    companyName: null,
    locationId: null,
    locationName: null,
    address: null,
    country: "PL",
    place: "",
  };
}

export function renumberStops(stops: OrderViewStop[]): OrderViewStop[] {
  return stops.map((s, i) => ({ ...s, sequenceNo: i + 1 }));
}
