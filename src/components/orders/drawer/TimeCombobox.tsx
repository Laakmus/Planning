/**
 * Combobox z listą czasów co 30 min (04:00–22:00).
 * Wspiera wpisywanie niestandardowych godzin w formacie HH:MM.
 * Wydzielony z RoutePointCard.tsx (M-08).
 */

import { useEffect, useState } from "react";

import { Check, ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ---------------------------------------------------------------------------
// Stałe i helpery
// ---------------------------------------------------------------------------

/** Generuje sloty co 30 min od 04:00 do 22:00 (37 pozycji) */
const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 4; h <= 22; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 22) {
      slots.push(`${String(h).padStart(2, "0")}:30`);
    }
  }
  return slots;
})();

/** Walidacja formatu HH:MM (0-23 godziny, 0-59 minuty) */
function isValidTime(val: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(val)) return false;
  const [hh, mm] = val.split(":").map(Number);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

/** Konwertuje czas HH:MM na minuty od północy */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// ---------------------------------------------------------------------------
// Komponent
// ---------------------------------------------------------------------------

export interface TimeComboboxProps {
  value: string | null;
  onChange: (val: string | null) => void;
  disabled?: boolean;
}

export function TimeCombobox({ value, onChange, disabled = false }: TimeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Auto-scroll do wybranej (lub najbliższej) wartości po otwarciu.
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      let targetValue = value;
      if (value && !TIME_SLOTS.includes(value)) {
        const valueMinutes = timeToMinutes(value);
        targetValue = TIME_SLOTS.reduce((closest, slot) =>
          Math.abs(timeToMinutes(slot) - valueMinutes) < Math.abs(timeToMinutes(closest) - valueMinutes)
            ? slot
            : closest
        );
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
  }, [open, value]);

  const filtered = query.length === 0
    ? TIME_SLOTS
    : TIME_SLOTS.filter((slot) => slot.includes(query));

  const showCustom =
    query.length > 0 &&
    isValidTime(query) &&
    !TIME_SLOTS.includes(query);

  function handleSelect(val: string) {
    onChange(val);
    setOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal text-sm h-auto py-1.5 px-2"
        >
          <span className={value ? "text-slate-900 dark:text-slate-100" : "text-slate-400"}>
            {value || "Godzina"}
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
      <PopoverContent className="w-40 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Wpisz godzinę..."
            value={query}
            onValueChange={setQuery}
            className="text-sm"
          />
          <CommandList>
            <CommandEmpty className="py-3 text-xs text-slate-500 text-center">
              Brak wyników
            </CommandEmpty>
            <CommandGroup>
              {showCustom && (
                <CommandItem
                  value={`custom-${query}`}
                  onSelect={() => handleSelect(query)}
                  className="text-sm cursor-pointer font-medium"
                >
                  <Check
                    className={`mr-2 h-3 w-3 ${value === query ? "opacity-100" : "opacity-0"}`}
                  />
                  Użyj {query}
                </CommandItem>
              )}
              {filtered.map((slot) => (
                <CommandItem
                  key={slot}
                  value={slot}
                  data-value={slot}
                  onSelect={() => handleSelect(slot)}
                  className="text-sm cursor-pointer"
                >
                  <Check
                    className={`mr-2 h-3 w-3 ${value === slot ? "opacity-100" : "opacity-0"}`}
                  />
                  {slot}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
