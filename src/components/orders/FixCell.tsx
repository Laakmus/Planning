/**
 * Komórka "Fix" — inline dropdown w tabeli zleceń.
 * Wyświetla: Tak / Nie / — (puste).
 * Dla READ_ONLY: tylko tekst, bez interakcji.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";

interface FixCellProps {
  orderId: string;
  value: boolean | null;
  onSetEntryFixed: (orderId: string, value: boolean | null) => void;
}

/** Mapowanie wartości na klucze Select (Select nie obsługuje null jako value). */
const VALUE_MAP: Record<string, boolean | null> = {
  true: true,
  false: false,
  empty: null,
};

const DISPLAY_MAP: Record<string, string> = {
  true: "Tak",
  false: "Nie",
  empty: "—",
};

function valueToKey(v: boolean | null): string {
  if (v === true) return "true";
  if (v === false) return "false";
  return "empty";
}

export function FixCell({ orderId, value, onSetEntryFixed }: FixCellProps) {
  const { user } = useAuth();
  const isReadOnly = user?.role === "READ_ONLY";

  const displayText = value === true ? "Tak" : value === false ? "Nie" : "—";

  // READ_ONLY — tylko tekst
  if (isReadOnly) {
    return (
      <span className="text-[12px] text-slate-500 dark:text-slate-400">
        {displayText}
      </span>
    );
  }

  const handleChange = (key: string) => {
    const newValue = VALUE_MAP[key] ?? null;
    if (newValue !== value) {
      onSetEntryFixed(orderId, newValue);
    }
  };

  return (
    <Select value={valueToKey(value)} onValueChange={handleChange}>
      <SelectTrigger
        size="sm"
        className="h-6 min-w-0 w-14 px-1.5 text-[11px] border-slate-200 dark:border-slate-700 shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(DISPLAY_MAP).map(([key, label]) => (
          <SelectItem key={key} value={key} className="text-[12px]">
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
