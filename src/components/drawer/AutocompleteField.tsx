import { useState, useMemo, useCallback } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = Record<string, any>;

interface AutocompleteFieldProps<T extends AnyItem> {
  label: string;
  placeholder: string;
  items: T[];
  /** Currently selected item's UUID */
  value: string | null;
  /** Text displayed for the current value */
  displayValue: string | null;
  /** Fields to search in the item object */
  searchFields: (keyof T & string)[];
  /** Called when an item is selected or cleared */
  onSelect: (item: T | null) => void;
  /** Whether the field is required */
  required?: boolean;
  /** Validation error message */
  error?: string;
  /** Whether the field is disabled (readonly) */
  disabled?: boolean;
  /** Field to use as the unique key (defaults to 'id') */
  keyField?: keyof T & string;
}

/**
 * Generic autocomplete field for order form.
 * Shows matches after typing >= 2 characters (client-side filtering).
 * Max 50 results shown. Selecting an item calls onSelect with the full item object.
 */
export function AutocompleteField<T extends AnyItem>({
  label,
  placeholder,
  items,
  value,
  displayValue,
  searchFields,
  onSelect,
  required = false,
  error,
  disabled = false,
  keyField = "id" as keyof T & string,
}: AutocompleteFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter items based on search query (>= 2 chars)
  const filteredItems = useMemo(() => {
    if (searchQuery.length < 2) return [];

    const query = searchQuery.toLowerCase();
    const results = items.filter((item) =>
      searchFields.some((field) => {
        const val = item[field];
        if (typeof val === "string") {
          return val.toLowerCase().includes(query);
        }
        return false;
      }),
    );

    // Limit to 50 results
    return results.slice(0, 50);
  }, [items, searchQuery, searchFields]);

  const handleSelect = useCallback(
    (selectedKey: string) => {
      const selected = items.find(
        (item) => String(item[keyField]) === selectedKey,
      );
      onSelect(selected ?? null);
      setOpen(false);
      setSearchQuery("");
    },
    [items, keyField, onSelect],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(null);
      setSearchQuery("");
    },
    [onSelect],
  );

  return (
    <div className="space-y-1.5">
      {label && (
        <Label className={cn(error && "text-destructive")}>
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              !displayValue && "text-muted-foreground",
              error && "border-destructive",
            )}
            disabled={disabled}
          >
            <span className="truncate">
              {displayValue ?? placeholder}
            </span>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              {value && !disabled && (
                <X
                  className="h-3 w-3 opacity-50 hover:opacity-100"
                  onClick={handleClear}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Szukaj (min. 2 znaki)...`}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {searchQuery.length < 2 ? (
                <CommandEmpty>Wpisz min. 2 znaki aby wyszukać</CommandEmpty>
              ) : filteredItems.length === 0 ? (
                <CommandEmpty>Brak wyników</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredItems.map((item) => {
                    const key = String(item[keyField]);
                    // Display the first search field as main text
                    const mainText = String(item[searchFields[0]] ?? "");

                    return (
                      <CommandItem
                        key={key}
                        value={key}
                        onSelect={handleSelect}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === key ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {mainText}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
