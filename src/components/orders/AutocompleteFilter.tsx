import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface AutocompleteFilterProps<T extends { id: string }> {
  label: string;
  placeholder: string;
  items: T[];
  value: string | undefined;
  displayField: keyof T;
  searchFields: (keyof T)[];
  onChange: (id: string | undefined) => void;
}

/**
 * Generic autocomplete filter component using shadcn Command.
 * Filters items client-side after typing >= 2 characters.
 */
export function AutocompleteFilter<T extends { id: string }>({
  label,
  placeholder,
  items,
  value,
  displayField,
  searchFields,
  onChange,
}: AutocompleteFilterProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Find selected item for display
  const selectedItem = useMemo(
    () => items.find((item) => item.id === value),
    [items, value],
  );

  // Filter items client-side
  const filteredItems = useMemo(() => {
    if (search.length < 2) return [];
    const query = search.toLowerCase();
    return items.filter((item) =>
      searchFields.some((field) => {
        const val = item[field];
        return typeof val === "string" && val.toLowerCase().includes(query);
      }),
    );
  }, [items, search, searchFields]);

  return (
    <div className="w-44">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-8 w-full justify-between text-xs font-normal"
          >
            <span className="truncate">
              {selectedItem ? String(selectedItem[displayField]) : label}
            </span>
            {value ? (
              <X
                className="ml-1 h-3 w-3 shrink-0 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(undefined);
                  setSearch("");
                }}
              />
            ) : (
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={placeholder}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {search.length < 2 ? (
                <CommandEmpty>Wpisz min. 2 znaki...</CommandEmpty>
              ) : filteredItems.length === 0 ? (
                <CommandEmpty>Brak wyników</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredItems.slice(0, 50).map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => {
                        onChange(item.id === value ? undefined : item.id);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === item.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {String(item[displayField])}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
