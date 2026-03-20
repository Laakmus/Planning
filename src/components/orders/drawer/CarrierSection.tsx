/**
 * Sekcja 3 – Firma transportowa.
 * Autocomplete firmy, NIP (readonly), typ auta + objętość (2 niezależne pola), wymagane dokumenty.
 */

import { memo, useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyDto, VehicleVariantDto } from "@/types";
import type { OrderFormData } from "@/lib/view-models";

import { AutocompleteField } from "./AutocompleteField";

interface CarrierSectionProps {
  formData: OrderFormData;
  companies: CompanyDto[];
  vehicleVariants: VehicleVariantDto[];
  isReadOnly: boolean;
  onChange: (patch: Partial<OrderFormData>) => void;
}

const REQUIRED_DOCS_OPTIONS = [
  { value: "WZ, KPO, kwit wagowy", label: "WZ, KPO, kwit wagowy" },
  { value: "WZE, Aneks VII, CMR", label: "WZE, Aneks VII, CMR" },
];

export const CarrierSection = memo(function CarrierSection({
  formData,
  companies,
  vehicleVariants,
  isReadOnly,
  onChange,
}: CarrierSectionProps) {
  const selectedCarrier = formData.carrierCompanyId
    ? companies.find((c) => c.id === formData.carrierCompanyId)
    : null;

  // Lista unikalnych typów pojazdów do selecta
  const uniqueVehicleTypes = useMemo(() => {
    const types = new Set(
      vehicleVariants.filter((v) => v.isActive).map((v) => v.vehicleType),
    );
    return Array.from(types);
  }, [vehicleVariants]);

  function handleCarrierChange(
    _id: string | null,
    item: CompanyDto | null,
  ) {
    onChange({ carrierCompanyId: item?.id ?? null });
  }

  function handleVehicleTypeChange(type: string) {
    // Specjalna wartość "__clear__" = wyczyść pole (null)
    onChange({ vehicleTypeText: type === "__clear__" ? null : type });
  }

  function handleVolumeInputChange(value: string) {
    const parsed = value === "" ? null : parseFloat(value);
    onChange({ vehicleCapacityVolumeM3: parsed != null && !isNaN(parsed) ? parsed : null });
  }

  return (
    <div className="space-y-2">
      {/* Row 1: Firma 50% + Typ auta 30% + Objętość 20% */}
      <div className="flex gap-2">
        {/* Firma transportowa (autocomplete) */}
        <div className="basis-1/2 min-w-0">
          <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 block mb-1">
            Nazwa firmy (przewoźnik) *
          </label>
          <AutocompleteField
            compact
            placeholder="Wpisz nazwę przewoźnika..."
            items={companies}
            value={formData.carrierCompanyId}
            displayField="name"
            searchFields={["name"]}
            onChange={handleCarrierChange}
            disabled={isReadOnly}
          />
          {/* NIP as inline text below carrier name */}
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 pl-0.5">
            NIP: {selectedCarrier?.taxId || "—"}
          </p>
        </div>

        {/* Typ auta — 30% */}
        <div className="basis-[30%] min-w-0">
          <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 block mb-1">
            Typ auta *
          </label>
          <Select
            value={formData.vehicleTypeText ?? ""}
            onValueChange={handleVehicleTypeChange}
            disabled={isReadOnly}
          >
            <SelectTrigger className="w-full h-8 text-sm">
              <SelectValue placeholder="Wybierz typ..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__clear__" className="text-sm text-slate-400">
                — Brak —
              </SelectItem>
              {uniqueVehicleTypes.map((type) => (
                <SelectItem key={type} value={type} className="text-sm">
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Objętość m³ — 20% */}
        <div className="basis-[20%] min-w-0">
          <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 block mb-1">
            m³ *
          </label>
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="m³"
            value={formData.vehicleCapacityVolumeM3 ?? ""}
            onChange={(e) => handleVolumeInputChange(e.target.value)}
            disabled={isReadOnly}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Row 2: Wymagane dokumenty — full width */}
      <div>
        <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 block mb-1">
          Wymagane dokumenty
        </label>
        <Select
          value={formData.requiredDocumentsText ?? ""}
          onValueChange={(v) => onChange({ requiredDocumentsText: v || null })}
          disabled={isReadOnly}
        >
          <SelectTrigger className="w-full h-8 text-sm">
            <SelectValue placeholder="Wybierz dokumenty..." />
          </SelectTrigger>
          <SelectContent>
            {REQUIRED_DOCS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 3: Dane do awizacji — full width */}
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Dane do awizacji</Label>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {(formData.notificationDetails ?? "").length}/500
          </span>
        </div>
        <Textarea
          value={formData.notificationDetails ?? ""}
          onChange={(e) => onChange({ notificationDetails: e.target.value || null })}
          disabled={isReadOnly}
          rows={4}
          maxLength={500}
          className="text-sm resize-none mt-1"
          placeholder="Informacje do awizacji dla przewoźnika…"
        />
      </div>
    </div>
  );
});
