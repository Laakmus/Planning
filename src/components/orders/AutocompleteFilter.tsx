/**
 * Generyczny filtr z autocomplete oparty na shadcn Popover + Command.
 * Dane ładowane globalnie ze słowników — filtrowanie po stronie klienta.
 */

import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";

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
import { cn } from "@/lib/utils";

interface AutocompleteFilterProps {
  label: string;
  placeholder?: string;
  /** Lista pozycji słownikowych. */
  items: Array<{ id: string; label: string; sublabel?: string }>;
  /** Aktualnie wybrany UUID lub undefined. */
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /** Szerokość pola (CSS). */
  width?: string;
}

export function AutocompleteFilter({
  label,
  placeholder = "Szukaj...",
  items,
  value,
  onChange,
  width = "w-40",
}: AutocompleteFilterProps) {
  const [open, setOpen] = useState(false);

  const selected = items.find((i) => i.id === value);

  function handleSelect(id: string) {
    onChange(id === value ? undefined : id);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(undefined);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`${width} h-8 text-xs justify-between font-normal px-2 gap-1`}
        >
          <span className="truncate">
            {selected ? selected.label : label}
          </span>
          <span className="flex items-center gap-0.5 shrink-0">
            {selected && (
              <span
                role="button"
                onClick={handleClear}
                className="hover:text-slate-700 dark:hover:text-slate-300 text-slate-400 p-0.5"
              >
                <X className="w-3 h-3" />
              </span>
            )}
            <ChevronsUpDown className="w-3 h-3 text-slate-400" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-56" align="start">
        <Command>
          <CommandInput placeholder={placeholder} className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs py-4 text-center text-slate-500">
              Brak wyników.
            </CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label + (item.sublabel ?? "")}
                  onSelect={() => handleSelect(item.id)}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "w-3 h-3 shrink-0",
                      item.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex flex-col min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-[10px] text-slate-400 truncate">
                        {item.sublabel}
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
