/**
 * Typy DTO dla widoku magazynowego — GET /api/v1/warehouse/orders.
 */

/** Pozycja towarowa w widoku magazynowym. */
export interface WarehouseItemDto {
  productName: string;
  loadingMethod: string | null;
  weightTons: number | null;
}

/** Pojedynczy wpis operacji w widoku magazynowym (jeden stop = jeden wiersz). */
export interface WarehouseOrderEntryDto {
  orderId: string;
  orderNo: string;
  stopType: "LOADING" | "UNLOADING";
  timeLocal: string | null;
  /** true jeśli oryginalny dzień stopu = sobota/niedziela (przesunięty do piątku). */
  isWeekend: boolean;
  /** Oryginalna data stopu (widoczna gdy isWeekend=true). */
  originalDate: string | null;
  items: WarehouseItemDto[];
  totalWeightTons: number | null;
  carrierName: string | null;
  vehicleType: string | null;
  notificationDetails: string | null;
}

/** Dane jednego dnia w widoku magazynowym. */
export interface WarehouseDayDto {
  date: string;
  dayName: string;
  entries: WarehouseOrderEntryDto[];
}

/** Odpowiedź GET /api/v1/warehouse/orders. */
export interface WarehouseWeekResponseDto {
  week: number;
  year: number;
  weekStart: string;
  weekEnd: string;
  locationName: string;
  days: WarehouseDayDto[];
  noDateEntries: WarehouseOrderEntryDto[];
  summary: {
    loadingCount: number;
    loadingTotalTons: number;
    unloadingCount: number;
    unloadingTotalTons: number;
  };
}
