/**
 * Komórka lokalizacji w widoku Kolumny.
 * Wyświetla listę punktów załadunku lub rozładunku jako kolumnę z okrągłymi badge'ami.
 *
 * Załadunki (L): bg-emerald-100 text-emerald-700
 * Rozładunki (U): bg-primary/10 text-primary
 */

import type { OrderListStopDto } from "@/types";

interface LocationsCellProps {
  stops: OrderListStopDto[];
  /** "LOADING" → kolumna Miejsce załadunku | "UNLOADING" → Miejsce rozładunku */
  kind: "LOADING" | "UNLOADING";
}

export function LocationsCell({ stops, kind }: LocationsCellProps) {
  const filtered = stops
    .filter((s) => s.kind === kind)
    .sort((a, b) => a.sequenceNo - b.sequenceNo);

  if (!filtered.length) {
    return <span className="text-slate-400 text-[11px]">—</span>;
  }

  const isLoading = kind === "LOADING";
  const badgeCls = isLoading
    ? "bg-emerald-100 text-emerald-700"
    : "bg-primary/10 text-primary";
  const prefix = isLoading ? "L" : "U";

  let counter = 0;

  return (
    <div className="space-y-2">
      {filtered.map((stop) => {
        counter++;
        return (
          <div key={stop.sequenceNo} className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${badgeCls} text-[10px] font-bold shrink-0`}
              >
                {prefix}{counter}
              </span>
              <span className="font-medium text-[12px] leading-tight">
                {stop.companyNameSnapshot ?? "—"}
              </span>
            </div>
            {stop.locationNameSnapshot && (
              <div className="text-[11px] text-slate-500 pl-6 leading-tight">
                {stop.locationNameSnapshot}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Komórka dat załadunku/rozładunku w widoku Kolumny.
 * Pokazuje datę + czas dla każdego punktu z okrągłym badge'em.
 */
interface DatesCellProps {
  stops: OrderListStopDto[];
  kind: "LOADING" | "UNLOADING";
}

function formatDateLocal(date: string | null): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

function formatTimeLocal(time: string | null): string {
  if (!time) return "";
  return time.substring(0, 5);
}

export function DatesCell({ stops, kind }: DatesCellProps) {
  const filtered = stops
    .filter((s) => s.kind === kind)
    .sort((a, b) => a.sequenceNo - b.sequenceNo);

  if (!filtered.length) {
    return <span className="text-slate-400 text-[12px]">—</span>;
  }

  const isLoading = kind === "LOADING";
  const badgeCls = isLoading
    ? "bg-emerald-100 text-emerald-700"
    : "bg-primary/10 text-primary";
  const prefix = isLoading ? "L" : "U";

  let counter = 0;

  return (
    <div className="space-y-1">
      {filtered.map((stop) => {
        counter++;
        const date = formatDateLocal(stop.dateLocal);
        const time = formatTimeLocal(stop.timeLocal);
        return (
          <div key={stop.sequenceNo} className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${badgeCls} text-[10px] font-bold shrink-0`}
            >
              {prefix}{counter}
            </span>
            <span className="whitespace-nowrap text-[12px]">
              {date !== "—" ? `${date}${time ? ` ${time}` : ""}` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
