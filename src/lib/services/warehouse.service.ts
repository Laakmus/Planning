/**
 * Serwis widoku magazynowego — tygodniowy plan operacji załadunków/rozładunków.
 * Pobiera stopy z order_stops dla danej lokalizacji i tygodnia ISO,
 * grupuje wg dni (pon-pt), przesuwając weekendowe stopy do piątku.
 */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import type {
  WarehouseDayDto,
  WarehouseItemDto,
  WarehouseOrderEntryDto,
  WarehouseWeekResponseDto,
} from "@/types";
import { WAREHOUSE_VISIBLE_STATUSES } from "@/lib/order-status";
import { addDaysUTC, formatUTCDate, getISOWeekMonday } from "@/lib/week-utils";

// Re-eksport dla kompatybilności (endpoint /warehouse/orders, testy)
export { getCurrentISOWeek } from "@/lib/week-utils";


/** Nazwy dni tygodnia (pon-pt). */
const DAY_NAMES_PL = [
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
];

/** Wiersz order_stops z zagnieżdżonym zleceniem i towarami (select w getWarehouseWeekOrders). */
interface WarehouseStopRow {
  id: string;
  kind: string;
  sequence_no: number;
  date_local: string | null;
  time_local: string | null;
  location_id: string | null;
  order_id: string;
  transport_orders: {
    id: string;
    order_no: string;
    status_code: string;
    carrier_name_snapshot: string | null;
    vehicle_type_text: string | null;
    notification_details: string | null;
    order_items: {
      product_name_snapshot: string | null;
      loading_method_code: string | null;
      quantity_tons: number | null;
    }[] | null;
  } | null;
}

type ValidStopRow = WarehouseStopRow & {
  transport_orders: NonNullable<WarehouseStopRow["transport_orders"]>;
};

interface StopQueryResult {
  data: WarehouseStopRow[] | null;
  error: PostgrestError | null;
}

/** Odrzuca wiersze bez zagnieżdżonego zlecenia (edge case PostgREST przy inner join). */
function isValidStopRow(row: WarehouseStopRow): row is ValidStopRow {
  return row.transport_orders != null && !Array.isArray(row.transport_orders);
}

/**
 * Pobiera tygodniowy widok magazynowy dla danej lokalizacji.
 *
 * @param supabase — klient Supabase z context.locals
 * @param locationId — ID lokalizacji (oddziału magazynowego użytkownika)
 * @param week — numer tygodnia ISO (1-53)
 * @param year — rok
 * @param locationName — nazwa lokalizacji (do nagłówka odpowiedzi)
 * @returns WarehouseWeekResponseDto
 */
export async function getWarehouseWeekOrders(
  supabase: SupabaseClient<Database>,
  locationId: string,
  week: number,
  year: number,
  locationName: string
): Promise<WarehouseWeekResponseDto> {
  // Oblicz zakres dat
  const monday = getISOWeekMonday(year, week);

  const weekStart = formatUTCDate(monday);
  // W DTO zwracamy piątek jako koniec tygodnia roboczego
  const weekEnd = formatUTCDate(addDaysUTC(monday, 4));
  // W query DB używamy niedzieli — stopy weekendowe muszą być pobierane
  const dbWeekEnd = formatUTCDate(addDaysUTC(monday, 6));

  // Przygotuj daty pon-pt
  const weekDates: string[] = [];
  for (let i = 0; i < 5; i++) {
    weekDates.push(formatUTCDate(addDaysUTC(monday, i)));
  }

  // Pobierz stopy z datą w zakresie tygodnia (pon-nd) LUB bez daty
  // Filtrujemy po location_id stopu i statusie zlecenia
  // Supabase nie wspiera bezpośrednio złożonych JOINów, więc robimy 2 zapytania:
  // 1) stopy z datą w zakresie tygodnia
  // 2) stopy bez daty (noDateEntries)

  // Kolumny do pobrania ze stopów + zagnieżdżone dane zlecenia i towarów
  const stopSelect = `
    id,
    kind,
    sequence_no,
    date_local,
    time_local,
    location_id,
    order_id,
    transport_orders!inner (
      id,
      order_no,
      status_code,
      carrier_name_snapshot,
      vehicle_type_text,
      notification_details,
      order_items (
        product_name_snapshot,
        loading_method_code,
        quantity_tons
      )
    )
  `;

  // Zapytanie 1: stopy z datą w zakresie poniedziałek-niedziela
  // Cast na StopQueryResult: typy PostgREST dla filtra na zagnieżdżonej tabeli
  // (.in("transport_orders.status_code")) nie są wyprowadzane poprawnie.
  const { data: datedStops, error: datedErr } = await (supabase
    .from("order_stops")
    .select(stopSelect)
    .eq("location_id", locationId)
    .gte("date_local", weekStart)
    .lte("date_local", dbWeekEnd)
    .in("transport_orders.status_code", WAREHOUSE_VISIBLE_STATUSES)
    .order("time_local", { ascending: true, nullsFirst: false }) as unknown as PromiseLike<StopQueryResult>);

  if (datedErr) throw datedErr;

  // Zapytanie 2: stopy bez daty (noDateEntries)
  const { data: noDateStops, error: noDateErr } = await (supabase
    .from("order_stops")
    .select(stopSelect)
    .eq("location_id", locationId)
    .is("date_local", null)
    .in("transport_orders.status_code", WAREHOUSE_VISIBLE_STATUSES)
    .order("time_local", { ascending: true, nullsFirst: false }) as unknown as PromiseLike<StopQueryResult>);

  if (noDateErr) throw noDateErr;

  // Filtruj stopy z inner join — Supabase zwraca wiersz, ale transport_orders może być null
  // gdy status nie pasuje (inner join filtruje, ale w PostgREST mogą być edge cases)
  const validDatedStops = (datedStops ?? []).filter(isValidStopRow);
  const validNoDateStops = (noDateStops ?? []).filter(isValidStopRow);

  // Mapowanie stopu na WarehouseOrderEntryDto
  function mapStopToEntry(stop: ValidStopRow, isWeekend: boolean, originalDate: string | null): WarehouseOrderEntryDto {
    const order = stop.transport_orders;
    const items: WarehouseItemDto[] = (order.order_items ?? [])
      .filter((i) => i.product_name_snapshot)
      .map((i) => ({
        productName: i.product_name_snapshot ?? "",
        loadingMethod: i.loading_method_code ?? null,
        weightTons: i.quantity_tons ?? null,
      }));

    const totalWeight = items.reduce((sum: number, i: WarehouseItemDto) => sum + (i.weightTons ?? 0), 0);

    return {
      orderId: order.id,
      orderNo: order.order_no,
      stopType: stop.kind as "LOADING" | "UNLOADING",
      timeLocal: stop.time_local ?? null,
      isWeekend,
      originalDate,
      items,
      totalWeightTons: totalWeight > 0 ? totalWeight : null,
      carrierName: order.carrier_name_snapshot ?? null,
      vehicleType: order.vehicle_type_text ?? null,
      notificationDetails: order.notification_details ?? null,
    };
  }

  // Grupuj stopy wg dnia tygodnia (0=pon, 1=wt, ..., 4=pt)
  // Sobota (5) i niedziela (6) → piątek (4) z isWeekend=true
  const dayBuckets: WarehouseOrderEntryDto[][] = [[], [], [], [], []];

  for (const stop of validDatedStops) {
    const stopDate = stop.date_local as string;
    const dateObj = new Date(stopDate + "T00:00:00Z");
    // getUTCDay(): 0=nd, 1=pon, ..., 6=sob (data kalendarzowa — bez wpływu strefy procesu)
    const jsDay = dateObj.getUTCDay();
    // Konwersja na indeks: pon=0, wt=1, ..., pt=4
    let dayIndex = jsDay === 0 ? 6 : jsDay - 1; // nd=6, pon=0, wt=1, ..., sob=5

    const isWeekend = dayIndex >= 5; // sob=5 lub nd=6
    if (isWeekend) {
      dayIndex = 4; // przesuwamy do piątku
    }

    dayBuckets[dayIndex].push(
      mapStopToEntry(stop, isWeekend, isWeekend ? stopDate : null)
    );
  }

  // Sortuj wpisy w każdym dniu chronologicznie po timeLocal
  for (const bucket of dayBuckets) {
    bucket.sort((a, b) => {
      if (!a.timeLocal && !b.timeLocal) return 0;
      if (!a.timeLocal) return 1;
      if (!b.timeLocal) return -1;
      return a.timeLocal.localeCompare(b.timeLocal);
    });
  }

  // Zbuduj tablicę days
  const days: WarehouseDayDto[] = weekDates.map((date, index) => ({
    date,
    dayName: DAY_NAMES_PL[index],
    entries: dayBuckets[index],
  }));

  // Mapuj noDateEntries
  const noDateEntries: WarehouseOrderEntryDto[] = validNoDateStops.map(
    (stop) => mapStopToEntry(stop, false, null)
  );

  // Oblicz podsumowanie
  const allEntries = [...dayBuckets.flat(), ...noDateEntries];
  const summary = {
    loadingCount: allEntries.filter((e) => e.stopType === "LOADING").length,
    loadingTotalTons: allEntries
      .filter((e) => e.stopType === "LOADING")
      .reduce((sum, e) => sum + (e.totalWeightTons ?? 0), 0),
    unloadingCount: allEntries.filter((e) => e.stopType === "UNLOADING").length,
    unloadingTotalTons: allEntries
      .filter((e) => e.stopType === "UNLOADING")
      .reduce((sum, e) => sum + (e.totalWeightTons ?? 0), 0),
  };

  return {
    week,
    year,
    weekStart,
    weekEnd,
    locationName,
    days,
    noDateEntries,
    summary,
  };
}
