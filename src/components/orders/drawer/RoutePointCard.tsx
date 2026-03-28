/**
 * Karta pojedynczego punktu trasy (załadunek / rozładunek).
 * Layout: badge prostokątny + grid 4-kol (firma, lokalizacja, data, godzina) + adres + komentarz.
 * Drag-and-drop obsługiwany przez SortableStopWrapper w RouteSection.
 */

import { X } from "lucide-react";

import type { CompanyDto, LocationDto } from "@/types";
import type { OrderFormStop, StopKind } from "@/lib/view-models";

import { AutocompleteField } from "./AutocompleteField";
import { DateCombobox } from "./DateCombobox";
import { TimeCombobox } from "./TimeCombobox";

// ---------------------------------------------------------------------------

interface RoutePointCardProps {
  stop: OrderFormStop;
  index: number;
  loadingIndex?: number;
  unloadingIndex?: number;
  companies: CompanyDto[];
  locations: LocationDto[];
  isReadOnly: boolean;
  onChange: (patch: Partial<OrderFormStop>) => void;
  onRemove: () => void;
}

const KIND_LABEL: Record<StopKind, string> = {
  LOADING: "Załadunek",
  UNLOADING: "Rozładunek",
};

const KIND_BADGE_CLASS: Record<StopKind, string> = {
  LOADING: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500",
  UNLOADING: "bg-blue-500/10 text-blue-600 dark:text-blue-500",
};

const KIND_HOVER_BORDER: Record<StopKind, string> = {
  LOADING: "hover:border-emerald-500/50",
  UNLOADING: "hover:border-blue-500/50",
};

export function RoutePointCard({
  stop,
  loadingIndex,
  unloadingIndex,
  companies,
  locations,
  isReadOnly,
  onChange,
  onRemove,
}: RoutePointCardProps) {
  const kind = stop.kind as StopKind;
  const kindLabel = KIND_LABEL[kind] ?? kind;
  const badgeClass = KIND_BADGE_CLASS[kind] ?? "bg-slate-500/10 text-slate-600";
  const hoverBorder = KIND_HOVER_BORDER[kind] ?? "";

  // Etykieta: L1, L2... / U1, U2...
  const seqLabel = kind === "LOADING"
    ? `L${(loadingIndex ?? 0) + 1}`
    : `U${(unloadingIndex ?? 0) + 1}`;

  // Lokalizacje filtrowane po firmie
  const selectedCompany = stop.companyNameSnapshot
    ? companies.find((c) => c.name === stop.companyNameSnapshot)
    : null;

  const filteredLocations = selectedCompany
    ? locations.filter((l) => l.companyId === selectedCompany.id)
    : locations;

  function handleCompanyChange(_id: string | null, item: CompanyDto | null) {
    onChange({
      companyNameSnapshot: item?.name ?? null,
      locationId: null,
      locationNameSnapshot: null,
      addressSnapshot: null,
    });
  }

  function handleLocationChange(_id: string | null, item: LocationDto | null) {
    const address = item
      ? [item.streetAndNumber, item.postalCode, item.city, item.country]
          .filter(Boolean)
          .join(", ")
      : null;
    onChange({
      locationId: item?.id ?? null,
      locationNameSnapshot: item?.name ?? null,
      addressSnapshot: address,
    });
  }

  return (
    <div className={`flex-1 min-w-0 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-lg p-3 transition-all ${hoverBorder}`}>
      {/* Badge + close button */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${badgeClass}`}>
          {seqLabel}: {kindLabel}
        </span>
        {!isReadOnly && (
          <button
            type="button"
            onClick={onRemove}
            className="text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors"
            title="Usuń punkt"
            aria-label="Usuń punkt trasy"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Grid 4-kolumnowy: Firma | Lokalizacja | Data | Godzina */}
      <div className="grid grid-cols-2 md:grid-cols-[9fr_8fr_3fr_3fr] gap-2 min-w-0">
        {/* Firma */}
        <div className="col-span-2 md:col-span-1 min-w-0">
          <AutocompleteField
            placeholder="Firma"
            items={companies}
            value={selectedCompany?.id ?? null}
            displayField="name"
            searchFields={["name"]}
            onChange={handleCompanyChange}
            disabled={isReadOnly}
            compact
          />
        </div>

        {/* Lokalizacja */}
        <div className="col-span-1 min-w-0">
          <AutocompleteField
            placeholder="Lokalizacja"
            items={filteredLocations}
            value={stop.locationId}
            displayField="name"
            searchFields={["name", "city"]}
            onChange={handleLocationChange}
            disabled={isReadOnly}
            compact
          />
        </div>

        {/* Data */}
        <div className="col-span-1">
          <DateCombobox
            value={stop.dateLocal}
            onChange={(val) => onChange({ dateLocal: val })}
            disabled={isReadOnly}
          />
        </div>

        {/* Godzina */}
        <div className="col-span-1">
          <TimeCombobox
            value={stop.timeLocal ? stop.timeLocal.substring(0, 5) : null}
            onChange={(val) => onChange({ timeLocal: val ? `${val}:00` : null })}
            disabled={isReadOnly}
          />
        </div>
      </div>

      {/* Adres (readonly) */}
      {stop.addressSnapshot && (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
            <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span>{stop.addressSnapshot}</span>
        </div>
      )}

      {/* Komentarz — inline input */}
      <div className="mt-2 flex items-center gap-1">
        <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
        <input
          type="text"
          value={stop.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value || null })}
          disabled={isReadOnly}
          className="flex-1 text-xs bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-2 text-slate-500 dark:text-slate-400 disabled:opacity-60"
          placeholder="Komentarz do punktu trasy..."
          maxLength={500}
        />
      </div>
    </div>
  );
}
