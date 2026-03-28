// Autocomplete komponenty dla dokumentu A4 (ProductDto, CompanyDto, LocationDto, etc.)

import React, { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
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
import type { CompanyDto, LocationDto, ProductDto } from "@/types";
import type { PackagingType } from "./types";
import { DOCUMENTS_OPTIONS } from "./constants";

// ---------------------------------------------------------------------------
// Helper: mapowanie defaultLoadingMethodCode -> PackagingType
// ---------------------------------------------------------------------------

const LOADING_TO_PACKAGING: Record<string, PackagingType> = {
  LUZEM: "LUZEM",
  PALETA_BIGBAG: "BIGBAG",
  PALETA: "PALETA",
  KOSZE: "INNA",
};

// ---------------------------------------------------------------------------
// ProductAutocomplete — wybor produktu z listy slownikowej
// ---------------------------------------------------------------------------

export function ProductAutocomplete({
  value,
  onSelect,
  disabled,
  products,
}: {
  value: string;
  onSelect: (product: {
    id: string;
    name: string;
    defaultPackaging: PackagingType | null;
  }) => void;
  disabled?: boolean;
  products: ProductDto[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  if (disabled) {
    return <span className="text-[7px] font-bold">{value}</span>;
  }

  const filtered =
    query.length < 1
      ? products.filter((p) => p.isActive)
      : products.filter(
          (p) =>
            p.isActive &&
            p.name.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-0.5 text-[7px] font-bold bg-transparent border-none outline-none cursor-pointer text-left w-full hover:bg-yellow-50/50 rounded-sm px-0.5 -mx-0.5"
          style={{ color: "#000" }}
        >
          <span className="truncate flex-1">
            {value || "wybierz produkt..."}
          </span>
          <ChevronsUpDown
            className="shrink-0 opacity-40"
            style={{ width: 8, height: 8 }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-0"
        align="start"
        side="bottom"
        sideOffset={2}
      >
        <Command>
          <CommandInput
            placeholder="Szukaj produktu..."
            value={query}
            onValueChange={setQuery}
            className="text-xs"
          />
          <CommandList>
            <CommandEmpty className="py-2 text-xs text-center text-slate-500">
              Brak wynik\u00f3w
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((product) => {
                const packaging =
                  LOADING_TO_PACKAGING[
                    product.defaultLoadingMethodCode
                  ] ?? null;
                return (
                  <CommandItem
                    key={product.id}
                    value={product.name}
                    onSelect={() => {
                      onSelect({
                        id: product.id,
                        name: product.name,
                        defaultPackaging: packaging,
                      });
                      setOpen(false);
                      setQuery("");
                    }}
                    className="text-xs cursor-pointer"
                  >
                    <Check
                      className={`mr-1.5 h-3 w-3 ${
                        value === product.name
                          ? "opacity-100"
                          : "opacity-0"
                      }`}
                    />
                    <span>{product.name}</span>
                    {packaging && (
                      <span className="ml-auto text-[10px] text-slate-400">
                        {packaging}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// CompanyAutocomplete — wybor firmy dla stopu
// ---------------------------------------------------------------------------

export function CompanyAutocomplete({
  value,
  displayName,
  onSelect,
  onClear,
  disabled,
  companies,
}: {
  value: string | null;
  displayName: string | null;
  onSelect: (company: CompanyDto) => void;
  onClear: () => void;
  disabled?: boolean;
  companies: CompanyDto[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  if (disabled) {
    return (
      <span className="text-[7px] font-bold truncate">
        {displayName || ""}
      </span>
    );
  }

  const filtered =
    query.length < 1
      ? companies.filter((c) => c.isActive)
      : companies.filter(
          (c) =>
            c.isActive &&
            c.name.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-0.5 text-[7px] font-bold bg-transparent border-none outline-none cursor-pointer text-left w-full hover:bg-yellow-50/50 rounded-sm px-0.5 -mx-0.5"
          style={{ color: "#000" }}
        >
          <span
            className="flex-1 line-clamp-2"
            style={{ lineHeight: "9px" }}
          >
            {displayName || "wybierz firm\u0119..."}
          </span>
          <ChevronsUpDown
            className="shrink-0 opacity-40"
            style={{ width: 6, height: 6 }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        side="bottom"
        sideOffset={2}
      >
        <Command>
          <CommandInput
            placeholder="Szukaj firmy..."
            value={query}
            onValueChange={setQuery}
            className="text-xs"
          />
          <CommandList>
            <CommandEmpty className="py-2 text-xs text-center text-slate-500">
              Brak wynik\u00f3w
            </CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onClear();
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-xs cursor-pointer text-red-500"
                >
                  <X className="mr-1.5 h-3 w-3" />
                  Wyczy\u015b\u0107 wyb\u00f3r
                </CommandItem>
              )}
              {filtered.map((company) => (
                <CommandItem
                  key={company.id}
                  value={company.name}
                  onSelect={() => {
                    onSelect(company);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-xs cursor-pointer"
                >
                  <Check
                    className={`mr-1.5 h-3 w-3 ${
                      value === company.id
                        ? "opacity-100"
                        : "opacity-0"
                    }`}
                  />
                  <span>{company.name}</span>
                  {company.taxId && (
                    <span className="ml-auto text-[10px] text-slate-400">
                      {company.taxId}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// CarrierAutocomplete — wybor firmy transportowej (nazwa + adres + NIP)
// ---------------------------------------------------------------------------

export function CarrierAutocomplete({
  carrierName,
  carrierAddress,
  onSelect,
  onClear,
  companies,
  locations,
}: {
  carrierName: string;
  carrierAddress: string;
  onSelect: (company: CompanyDto) => void;
  onClear: () => void;
  companies: CompanyDto[];
  locations: LocationDto[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered =
    query.length < 1
      ? companies.filter((c) => c.isActive)
      : companies.filter(
          (c) =>
            c.isActive &&
            (c.name.toLowerCase().includes(query.toLowerCase()) ||
              c.taxId?.toLowerCase().includes(query.toLowerCase())),
        );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-0.5 text-[7px] bg-transparent border-none outline-none cursor-pointer text-left w-full hover:bg-yellow-50/50 rounded-sm px-0.5 -mx-0.5"
          style={{ color: "#000" }}
        >
          <div className="flex flex-col flex-1 min-w-0 leading-[1.4]">
            <span className="font-bold truncate">
              {carrierName || "wybierz firm\u0119 transportow\u0105..."}
            </span>
            {carrierAddress && (
              <span className="truncate text-[6.5px]">
                {carrierAddress}
              </span>
            )}
          </div>
          <ChevronsUpDown
            className="shrink-0 opacity-40"
            style={{ width: 8, height: 8 }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        side="bottom"
        sideOffset={2}
      >
        <Command>
          <CommandInput
            placeholder="Szukaj firmy transportowej..."
            value={query}
            onValueChange={setQuery}
            className="text-xs"
          />
          <CommandList>
            <CommandEmpty className="py-2 text-xs text-center text-slate-500">
              Brak wynik\u00f3w
            </CommandEmpty>
            <CommandGroup>
              {carrierName && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onClear();
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-xs cursor-pointer text-red-500"
                >
                  <X className="mr-1.5 h-3 w-3" />
                  Wyczy\u015b\u0107 wyb\u00f3r
                </CommandItem>
              )}
              {filtered.map((company) => {
                // Rozwiaz adres z lokalizacji
                const loc = locations.find(
                  (l) => l.companyId === company.id && l.isActive,
                );
                const addr = loc
                  ? `${loc.streetAndNumber}, ${loc.postalCode} ${loc.city}`
                  : "";

                return (
                  <CommandItem
                    key={company.id}
                    value={company.name}
                    onSelect={() => {
                      onSelect(company);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="text-xs cursor-pointer"
                  >
                    <Check
                      className={`mr-1.5 h-3 w-3 shrink-0 ${
                        carrierName === company.name
                          ? "opacity-100"
                          : "opacity-0"
                      }`}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{company.name}</span>
                      {addr && (
                        <span className="text-[10px] text-slate-400 truncate">
                          {addr}
                        </span>
                      )}
                    </div>
                    {company.taxId && (
                      <span className="ml-auto text-[10px] text-slate-400 shrink-0">
                        {company.taxId}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// LocationAutocomplete — wybor lokalizacji (filtrowany po companyId)
// ---------------------------------------------------------------------------

export function LocationAutocomplete({
  value,
  displayName,
  companyId,
  onSelect,
  onClear,
  disabled,
  locations,
}: {
  value: string | null;
  displayName: string | null;
  companyId: string | null;
  onSelect: (location: LocationDto) => void;
  onClear: () => void;
  disabled?: boolean;
  locations: LocationDto[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  if (disabled) {
    return (
      <span className="text-[7px] font-bold truncate">
        {displayName || ""}
      </span>
    );
  }

  const availableLocations = locations.filter(
    (loc) =>
      loc.isActive && (companyId ? loc.companyId === companyId : true),
  );

  const filtered =
    query.length < 1
      ? availableLocations
      : availableLocations.filter(
          (loc) =>
            loc.name.toLowerCase().includes(query.toLowerCase()) ||
            loc.city.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-0.5 text-[7px] font-bold bg-transparent border-none outline-none cursor-pointer text-left w-full hover:bg-yellow-50/50 rounded-sm px-0.5 -mx-0.5"
          style={{ color: "#000" }}
        >
          <span className="truncate flex-1">
            {displayName ||
              (companyId
                ? "wybierz lokalizacj\u0119..."
                : "najpierw wybierz firm\u0119")}
          </span>
          <ChevronsUpDown
            className="shrink-0 opacity-40"
            style={{ width: 6, height: 6 }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        side="bottom"
        sideOffset={2}
      >
        <Command>
          <CommandInput
            placeholder="Szukaj lokalizacji..."
            value={query}
            onValueChange={setQuery}
            className="text-xs"
          />
          <CommandList>
            <CommandEmpty className="py-2 text-xs text-center text-slate-500">
              {companyId
                ? "Brak lokalizacji dla tej firmy"
                : "Najpierw wybierz firm\u0119"}
            </CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onClear();
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-xs cursor-pointer text-red-500"
                >
                  <X className="mr-1.5 h-3 w-3" />
                  Wyczy\u015b\u0107 wyb\u00f3r
                </CommandItem>
              )}
              {filtered.map((loc) => (
                <CommandItem
                  key={loc.id}
                  value={`${loc.name} ${loc.city}`}
                  onSelect={() => {
                    onSelect(loc);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-xs cursor-pointer"
                >
                  <Check
                    className={`mr-1.5 h-3 w-3 ${
                      value === loc.id ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <div className="flex flex-col">
                    <span>{loc.name}</span>
                    <span className="text-[10px] text-slate-400">
                      {loc.streetAndNumber}, {loc.postalCode} {loc.city}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// DocumentsAutocomplete — wybor dokumentow dla kierowcy
// ---------------------------------------------------------------------------

export function DocumentsAutocomplete({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (doc: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-0.5 text-[7px] font-bold bg-transparent border-none outline-none cursor-pointer text-left w-full hover:bg-yellow-50/50 rounded-sm px-0.5 -mx-0.5"
          style={{ color: "#000" }}
        >
          <span className="truncate flex-1">
            {value || "wybierz dokumenty..."}
          </span>
          <ChevronsUpDown
            className="shrink-0 opacity-40"
            style={{ width: 8, height: 8 }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-0"
        align="start"
        side="bottom"
        sideOffset={2}
      >
        <Command>
          <CommandList>
            <CommandGroup>
              {DOCUMENTS_OPTIONS.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onSelect(opt);
                    setOpen(false);
                  }}
                  className="text-xs cursor-pointer"
                >
                  <Check
                    className={`mr-1.5 h-3 w-3 ${
                      value === opt ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span>{opt}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// VehicleTypeAutocomplete — wybor typu auta
// ---------------------------------------------------------------------------

export function VehicleTypeAutocomplete({
  value,
  onSelect,
  onClear,
  vehicleTypes,
}: {
  value: string;
  onSelect: (type: string) => void;
  onClear: () => void;
  vehicleTypes: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered =
    query.length < 1
      ? vehicleTypes
      : vehicleTypes.filter((t) =>
          t.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-0.5 text-[7px] bg-transparent border-none outline-none cursor-pointer text-left w-full hover:bg-yellow-50/50 rounded-sm px-0.5 -mx-0.5"
          style={{ color: "#000" }}
        >
          <span className="truncate flex-1 font-bold">
            {value || "wybierz typ auta..."}
          </span>
          <ChevronsUpDown
            className="shrink-0 opacity-40"
            style={{ width: 8, height: 8 }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-48 p-0"
        align="start"
        side="bottom"
        sideOffset={2}
      >
        <Command>
          <CommandInput
            placeholder="Szukaj typu auta..."
            value={query}
            onValueChange={setQuery}
            className="text-xs"
          />
          <CommandList>
            <CommandEmpty className="py-2 text-xs text-center text-slate-500">
              Brak wynik\u00f3w
            </CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onClear();
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-xs cursor-pointer text-red-500"
                >
                  <X className="mr-1.5 h-3 w-3" />
                  Wyczy\u015b\u0107 wyb\u00f3r
                </CommandItem>
              )}
              {filtered.map((type) => (
                <CommandItem
                  key={type}
                  value={type}
                  onSelect={() => {
                    onSelect(type);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-xs cursor-pointer"
                >
                  <Check
                    className={`mr-1.5 h-3 w-3 ${
                      value === type ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span>{type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
