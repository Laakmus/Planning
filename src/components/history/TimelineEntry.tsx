import { ArrowRight, Zap } from "lucide-react";
import type { TimelineEntryViewModel } from "@/lib/view-models";
import { UserAvatar } from "./UserAvatar";

interface TimelineEntryProps {
  entry: TimelineEntryViewModel;
}

/** Status label and dark-theme color mapping for history timeline */
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ROB: { label: "ROB", className: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-700" },
  WYS: { label: "WYS", className: "bg-primary/20 text-primary border border-primary/30 uppercase" },
  KOR: { label: "KOR", className: "bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30" },
  KOR_WYS: { label: "KOR_WYS", className: "bg-teal-100 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30" },
  ZRE: { label: "ZRE", className: "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30" },
  ANL: { label: "ANL", className: "bg-gray-200 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600" },
  REK: { label: "REK", className: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30" },
};

/** Polish field name labels */
const FIELD_LABELS: Record<string, string> = {
  transport_type_code: "Typ transportu",
  currency_code: "Waluta",
  price_amount: "Cena frachtu",
  payment_term_days: "Termin płatności",
  payment_method: "Forma płatności",
  total_load_tons: "Waga ładunku",
  total_load_volume_m3: "Objętość ładunku",
  carrier_company_id: "Przewoźnik",
  carrier_name_snapshot: "Nazwa przewoźnika",
  shipper_location_id: "Nadawca",
  shipper_name_snapshot: "Nazwa nadawcy",
  receiver_location_id: "Odbiorca",
  receiver_name_snapshot: "Nazwa odbiorcy",
  vehicle_variant_code: "Wariant pojazdu",
  special_requirements: "Wymagania specjalne",
  required_documents_text: "Wymagane dokumenty",
  general_notes: "Uwagi ogólne",
  complaint_reason: "Powód reklamacji",
  sender_contact_name: "Osoba kontaktowa",
  sender_contact_phone: "Telefon kontaktowy",
  sender_contact_email: "Email kontaktowy",
  summary_route: "Trasa",
};

/** Format time from ISO timestamp */
function formatTime(isoStr: string): string {
  try {
    const date = new Date(isoStr);
    return date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/**
 * Single timeline entry — status change, field change, or order creation.
 * Matches test/history.html mockup: pl-12 offset, avatars on timeline line,
 * time in mono pill, field changes in bordered cards.
 */
export function TimelineEntry({ entry }: TimelineEntryProps) {
  const time = formatTime(entry.changedAt);

  if (entry.type === "status_change") {
    return <StatusChangeEntry entry={entry} time={time} />;
  }

  if (entry.type === "field_change") {
    return <FieldChangeEntry entry={entry} time={time} />;
  }

  // order_created
  return <OrderCreatedEntry entry={entry} time={time} />;
}

/** Status change entry — two badges with arrow between them */
function StatusChangeEntry({
  entry,
  time,
}: {
  entry: TimelineEntryViewModel;
  time: string;
}) {
  const oldConfig = STATUS_CONFIG[entry.oldStatusCode ?? ""] ?? {
    label: entry.oldStatusCode ?? "—",
    className: "bg-gray-100 text-gray-600",
  };
  const newConfig = STATUS_CONFIG[entry.newStatusCode ?? ""] ?? {
    label: entry.newStatusCode ?? "—",
    className: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="relative pl-12">
      {/* Avatar on timeline line */}
      <div className="absolute left-0">
        <UserAvatar userName={entry.changedByUserName} className="h-9 w-9 ring-4 ring-background dark:ring-[#16202a]" />
      </div>

      <div className="flex justify-between items-start">
        <span className="text-sm font-semibold">
          {entry.changedByUserName ?? "System"}
        </span>
        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
          {time}
        </span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Zmieniono status zlecenia</p>
      <div className="mt-3 flex items-center gap-2">
        <span className={`px-2 py-1 text-[11px] font-bold rounded ${oldConfig.className}`}>
          {oldConfig.label}
        </span>
        <ArrowRight className="h-3 w-3 text-slate-400" />
        <span className={`px-2 py-1 text-[11px] font-bold rounded ${newConfig.className}`}>
          {newConfig.label}
        </span>
      </div>
    </div>
  );
}

/** Field change entry — old/new value in bordered card */
function FieldChangeEntry({
  entry,
  time,
}: {
  entry: TimelineEntryViewModel;
  time: string;
}) {
  const fieldLabel = FIELD_LABELS[entry.fieldName ?? ""] ?? entry.fieldName ?? "Pole";

  return (
    <div className="relative pl-12">
      {/* Avatar on timeline line */}
      <div className="absolute left-0">
        <UserAvatar userName={entry.changedByUserName} className="h-9 w-9 ring-4 ring-background dark:ring-[#16202a]" />
      </div>

      <div className="flex justify-between items-start">
        <span className="text-sm font-semibold">
          {entry.changedByUserName ?? "System"}
        </span>
        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
          {time}
        </span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
        Zaktualizowano: {fieldLabel}
      </p>
      <div className="mt-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400">Z</label>
            <p className="text-sm line-through opacity-50">{entry.oldValue ?? "—"}</p>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-primary">Na</label>
            <p className="text-sm font-bold">{entry.newValue ?? "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Order creation entry — primary avatar with icon */
function OrderCreatedEntry({
  entry,
  time,
}: {
  entry: TimelineEntryViewModel;
  time: string;
}) {
  return (
    <div className="relative pl-12 pb-4">
      {/* System icon avatar */}
      <div className="absolute left-0">
        <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center ring-4 ring-background dark:ring-[#16202a] z-10 shadow-lg shadow-primary/20">
          <Zap className="h-4 w-4 text-white" />
        </div>
      </div>

      <div className="flex justify-between items-start">
        <span className="text-sm font-semibold">
          {entry.changedByUserName ?? "System (API)"}
        </span>
        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
          {time}
        </span>
      </div>
      <div className="mt-2 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-4">
        <p className="text-sm font-bold text-primary mb-1">Zlecenie utworzone</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Utworzono nowe zlecenie transportowe w systemie.
        </p>
      </div>
    </div>
  );
}
