/**
 * Combobox z listą dat (-7 do +30 dni) w formacie DD.MM.YYYY.
 * Wspiera wyszukiwanie DD.MM (pokazuje wyniki z rokiem).
 * Wzorzec: TimeCombobox.tsx.
 */

import { useEffect, useMemo, useState } from "react";

import { Check, ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ---------------------------------------------------------------------------
// Helpery
// ---------------------------------------------------------------------------

interface DateSlot {
  /** YYYY-MM-DD */
  value: string;
  /** DD.MM.YYYY */
  label: string;
}

/** Formatuje Date na YYYY-MM-DD */
function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Formatuje YYYY-MM-DD na DD.MM */
function toDdMm(iso: string): string {
  return `${iso.substring(8, 10)}.${iso.substring(5, 7)}`;
}

/** Formatuje YYYY-MM-DD na DD.MM.YYYY */
function toDdMmYyyy(iso: string): string {
  return `${iso.substring(8, 10)}.${iso.substring(5, 7)}.${iso.substring(0, 4)}`;
}

/** Generuje listę dat: -7 do +30 dni od dziś */
function generateDateSlots(): DateSlot[] {
  const slots: DateSlot[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = -7; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const iso = toIso(d);
    slots.push({ value: iso, label: toDdMmYyyy(iso) });
  }
  return slots;
}

/** Parsuje query DD.MM i zwraca wyniki z rokiem (bieżący + następny) */
function searchByDdMm(query: string): DateSlot[] {
  const match = query.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (!match) return [];

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return [];

  const currentYear = new Date().getFullYear();
  const results: DateSlot[] = [];

  for (let y = currentYear; y <= currentYear + 1; y++) {
    const d = new Date(y, month - 1, day);
    if (d.getMonth() !== month - 1 || d.getDate() !== day) continue;
    const iso = toIso(d);
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    results.push({ value: iso, label: `${dd}.${mm}.${y}` });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Komponent
// ---------------------------------------------------------------------------

export interface DateComboboxProps {
  value: string | null;
  onChange: (val: string | null) => void;
  disabled?: boolean;
}

export function DateCombobox({ value, onChange, disabled = false }: DateComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const dateSlots = useMemo(() => generateDateSlots(), []);

  // Wyniki wyszukiwania DD.MM → z rokiem
  const searchResults = query.length > 0 ? searchByDdMm(query) : [];
  const isSearchMode = query.length > 0 && searchResults.length > 0;

  const displayItems = isSearchMode ? searchResults : dateSlots;

  // Filtrowanie listy domyślnej po query (np. "25" filtruje sloty zawierające "25")
  const filtered = query.length > 0 && !isSearchMode
    ? dateSlots.filter((s) => s.label.includes(query))
    : displayItems;

  // Reset query po zamknięciu
  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  // Auto-scroll do wybranej/najbliższej daty
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      let targetValue = value;
      if (value && !dateSlots.find((s) => s.value === value)) {
        const valTime = new Date(value).getTime();
        targetValue = dateSlots.reduce((closest, slot) =>
          Math.abs(new Date(slot.value).getTime() - valTime) <
          Math.abs(new Date(closest.value).getTime() - valTime)
            ? slot
            : closest
        ).value;
      }

      if (targetValue) {
        const el = document.querySelector(
          `[cmdk-list] [data-value="${targetValue.toLowerCase()}"]`
        );
        if (el) {
          el.scrollIntoView({ block: "center" });
        }
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [open, value, dateSlots]);

  function handleSelect(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  // Button display: DD.MM
  const displayLabel = value ? toDdMm(value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal text-sm h-auto py-1.5 px-2 overflow-hidden"
        >
          <span className={`truncate ${displayLabel ? "text-slate-900 dark:text-slate-100" : "text-slate-400"}`}>
            {displayLabel || "Data"}
          </span>
          <div className="flex items-center gap-0.5 ml-2 shrink-0">
            {value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => e.key === "Enter" && handleClear(e as unknown as React.MouseEvent)}
                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                aria-label="Wyczyść"
              >
                <X className="w-3 h-3 text-slate-500" />
              </span>
            )}
            <ChevronsUpDown className="w-3 h-3 text-slate-400" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <input
              placeholder="DD.MM..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex h-9 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <CommandList>
            <CommandEmpty className="py-3 text-xs text-slate-500 text-center">
              Brak wyników
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((slot) => (
                <CommandItem
                  key={slot.value}
                  value={slot.value}
                  data-value={slot.value}
                  onSelect={() => handleSelect(slot.value)}
                  className="text-sm cursor-pointer"
                >
                  <Check
                    className={`mr-2 h-3 w-3 ${value === slot.value ? "opacity-100" : "opacity-0"}`}
                  />
                  {slot.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
