// Order View - Types for the A4 document preview

export type PackagingType = "LUZEM" | "BIGBAG" | "PALETA" | "INNA";
export type CurrencyCode = "EUR" | "USD" | "PLN";
export type StopKind = "LOADING" | "UNLOADING";

export interface OrderViewItem {
  id: string;
  name: string;
  notes: string;
  packagingType: PackagingType | null;
}

export interface OrderViewStop {
  id: string;
  kind: StopKind;
  sequenceNo: number;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM
  companyId: string | null;
  companyName: string | null;
  locationId: string | null;
  locationName: string | null;
  address: string | null;
  country: string;
  place: string; // fallback display text
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

  // Section 7-9 - Stops (unified: LOADING + UNLOADING with DnD)
  stops: OrderViewStop[];

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

// Test company for stop autocomplete
export interface TestCompany {
  id: string;
  name: string;
  isActive: boolean;
  taxId: string | null;
  type: string | null;
  address: string | null;
}

// Test location for stop autocomplete
export interface TestLocation {
  id: string;
  name: string;
  companyId: string;
  companyName: string | null;
  city: string;
  country: string;
  streetAndNumber: string;
  postalCode: string;
  isActive: boolean;
}

// Props for the OrderView container
export interface OrderViewProps {
  initialData: OrderViewData;
  isReadOnly?: boolean;
  onSave?: (data: OrderViewData) => void;
  onCancel?: () => void;
}
