/**
 * Serwis widoku magazynowego — tygodniowy plan operacji załadunków/rozładunków.
 * Pobiera stopy z order_stops dla danej lokalizacji i tygodnia ISO,
 * grupuje wg dni (pon-pt), przesuwając weekendowe stopy do piątku.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";
import type {
  WarehouseDayDto,
  WarehouseItemDto,
  WarehouseOrderEntryDto,
  WarehouseWeekResponseDto,
} from "../../types";

/** Statusy zleceń widoczne w widoku magazynowym. */
const WAREHOUSE_VISIBLE_STATUSES = [
  "robocze",
  "wysłane",
  "korekta",
  "korekta wysłane",
  "reklamacja",
];

/** Nazwy dni tygodnia (pon-pt). */
const DAY_NAMES_PL = [
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
];

/**
 * Oblicza poniedziałek danego tygodnia ISO.
 * Tydzień ISO: tydzień zawierający 4 stycznia danego roku, zaczynający się w poniedziałek.
 */
function getISOWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  return monday;
}

/** Formatuje Date do YYYY-MM-DD. */
function toISODateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Oblicza bieżący numer tygodnia ISO.
 */
export function getCurrentISOWeek(now: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  // Przesuń do najbliższego czwartku (ISO: czwartek = ten sam tydzień)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week: weekNo, year: d.getUTCFullYear() };
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
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const weekStart = toISODateString(monday);
  // W DTO zwracamy piątek jako koniec tygodnia roboczego
  const weekEnd = toISODateString(friday);
  // W query DB używamy niedzieli — stopy weekendowe muszą być pobierane
  const dbWeekEnd = toISODateString(sunday);

  // Przygotuj daty pon-pt
  const weekDates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(toISODateString(d));
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
  const { data: datedStops, error: datedErr } = await (supabase
    .from("order_stops")
    .select(stopSelect)
    .eq("location_id", locationId)
    .gte("date_local", weekStart)
    .lte("date_local", dbWeekEnd)
    .in("transport_orders.status_code", WAREHOUSE_VISIBLE_STATUSES)
    .order("time_local", { ascending: true, nullsFirst: false }) as any);

  if (datedErr) throw datedErr;

  // Zapytanie 2: stopy bez daty (noDateEntries)
  const { data: noDateStops, error: noDateErr } = await (supabase
    .from("order_stops")
    .select(stopSelect)
    .eq("location_id", locationId)
    .is("date_local", null)
    .in("transport_orders.status_code", WAREHOUSE_VISIBLE_STATUSES)
    .order("time_local", { ascending: true, nullsFirst: false }) as any);

  if (noDateErr) throw noDateErr;

  // Filtruj stopy z inner join — Supabase zwraca wiersz, ale transport_orders może być null
  // gdy status nie pasuje (inner join filtruje, ale w PostgREST mogą być edge cases)
  const validDatedStops = (datedStops ?? []).filter(
    (s: any) => s.transport_orders && !Array.isArray(s.transport_orders)
  );
  const validNoDateStops = (noDateStops ?? []).filter(
    (s: any) => s.transport_orders && !Array.isArray(s.transport_orders)
  );

  // Mapowanie stopu na WarehouseOrderEntryDto
  function mapStopToEntry(stop: any, isWeekend: boolean, originalDate: string | null): WarehouseOrderEntryDto {
    const order = stop.transport_orders;
    const items: WarehouseItemDto[] = (order.order_items ?? [])
      .filter((i: any) => i.product_name_snapshot)
      .map((i: any) => ({
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
    const dateObj = new Date(stopDate + "T00:00:00");
    // getDay(): 0=nd, 1=pon, ..., 6=sob
    const jsDay = dateObj.getDay();
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
    (stop: any) => mapStopToEntry(stop, false, null)
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
