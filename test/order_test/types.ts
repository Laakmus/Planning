// Order View - Types for the A4 document preview

export type PackagingType = "LUZEM" | "BIGBAG" | "PALETA" | "INNA";
export type CurrencyCode = "EUR" | "USD" | "PLN";

export interface OrderViewItem {
  id: string;
  name: string;
  notes: string;
  packagingType: PackagingType | null;
}

export interface OrderViewStop {
  id: string;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM
  place: string;
  country: string;
}

export interface OrderViewData {
  // Section 1 - Header (readonly)
  orderNo: string;
  createdAt: string; // YYYY-MM-DD

  // Section 4 - Carrier (editable)
  carrierName: string;
  carrierAddress: string;
  carrierNip: string;

  // Section 5 - Vehicle (editable)
  vehicleType: string;
  vehicleVolumeM3: number | null;

  // Section 6 - Items (editable, dynamic rows)
  items: OrderViewItem[];

  // Section 7 - Loading stop (editable)
  loading: OrderViewStop;

  // Section 8 - Intermediate stops (editable, dynamic)
  intermediateStops: OrderViewStop[];

  // Section 9 - Unloading stop (editable)
  unloading: OrderViewStop;

  // Section 10 - Price (editable)
  priceAmount: number | null;
  currencyCode: CurrencyCode;
  paymentTermDays: number | null;
  paymentMethod: string | null;

  // Section 11 - Documents (editable)
  documentsText: string;

  // Section 12 - Notes (editable, max 500 chars)
  generalNotes: string;

  // Section 13 - Confidentiality clause (editable)
  confidentialityClause: string;

  // Section 14 - Ordering person (readonly)
  personName: string;
  personEmail: string;
  personPhone: string;
}

// Test product for autocomplete
export interface TestProduct {
  id: string;
  name: string;
  defaultPackaging: PackagingType | null;
}

// Props for the OrderView container
export interface OrderViewProps {
  initialData: OrderViewData;
  isReadOnly?: boolean;
  onSave?: (data: OrderViewData) => void;
  onCancel?: () => void;
}
