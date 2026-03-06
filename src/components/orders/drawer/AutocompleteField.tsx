/**
 * Pole formularza z podpowiedzią ze słownika.
 * Filtruje klientów po wpisaniu, wybiera przez UUID.
 */

import { useState } from "react";

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
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AutocompleteFieldProps<T extends { id: string }> {
  label?: string;
  placeholder: string;
  items: T[];
  value: string | null;
  displayField: keyof T;
  searchFields: (keyof T)[];
  onChange: (id: string | null, item: T | null) => void;
  disabled?: boolean;
  required?: boolean;
  /** Tryb kompaktowy — bez labela, bez wrappera */
  compact?: boolean;
}

export function AutocompleteField<T extends { id: string }>({
  label,
  placeholder,
  items,
  value,
  displayField,
  searchFields,
  onChange,
  disabled = false,
  required = false,
  compact = false,
}: AutocompleteFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedItem = value ? items.find((i) => i.id === value) : null;
  const displayValue = selectedItem
    ? String(selectedItem[displayField] ?? "")
    : "";

  const filtered = query.length < 1
    ? items.slice(0, 50)
    : items.filter((item) =>
        searchFields.some((field) =>
          String(item[field] ?? "")
            .toLowerCase()
            .includes(query.toLowerCase())
        )
      ).slice(0, 50);

  function handleSelect(item: T) {
    onChange(item.id, item);
    setOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null, null);
  }

  const popover = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={`w-full justify-between font-normal text-sm ${compact ? "h-auto py-1.5 px-2" : "h-8 px-3"}`}
        >
            <span className={displayValue ? "text-slate-900 dark:text-slate-100" : "text-slate-400"}>
              {displayValue || placeholder}
            </span>
            <div className="flex items-center gap-0.5 ml-2 shrink-0">
              {selectedItem && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleClear(e as unknown as React.MouseEvent);
                    }
                  }}
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
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Szukaj..."
              value={query}
              onValueChange={setQuery}
              className="text-sm"
            />
            <CommandList>
              <CommandEmpty className="py-3 text-xs text-slate-500 text-center">
                Brak wyników
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={String(item[displayField] ?? "")}
                    onSelect={() => handleSelect(item)}
                    className="text-sm cursor-pointer"
                  >
                    <Check
                      className={`mr-2 h-3 w-3 ${value === item.id ? "opacity-100" : "opacity-0"}`}
                    />
                    {String(item[displayField] ?? "")}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
    </Popover>
  );

  if (compact) return popover;

  return (
    <div className="space-y-1">
      {label && (
        <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
      )}
      {popover}
    </div>
  );
}
