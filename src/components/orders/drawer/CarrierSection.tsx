/**
 * Sekcja 3 – Firma transportowa.
 * Autocomplete firmy, NIP (readonly), typ auta + objętość (2 selecty), wymagane dokumenty.
 */

import { useState, useMemo, useCallback } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function CarrierSection({
  formData,
  companies,
  vehicleVariants,
  isReadOnly,
  onChange,
}: CarrierSectionProps) {
  const selectedCarrier = formData.carrierCompanyId
    ? companies.find((c) => c.id === formData.carrierCompanyId)
    : null;

  // Derive initial vehicleType from current vehicleVariantCode
  const currentVariant = vehicleVariants.find(
    (v) => v.code === formData.vehicleVariantCode,
  );

  const [selectedVehicleType, setSelectedVehicleType] = useState<string>(
    currentVariant?.vehicleType ?? "",
  );

  const [volumeInput, setVolumeInput] = useState<string>(
    currentVariant?.capacityVolumeM3 != null
      ? String(currentVariant.capacityVolumeM3)
      : "",
  );

  const uniqueVehicleTypes = useMemo(() => {
    const types = new Set(
      vehicleVariants.filter((v) => v.isActive).map((v) => v.vehicleType),
    );
    return Array.from(types);
  }, [vehicleVariants]);

  const findVariantByVolume = useCallback(
    (type: string, volume: number) => {
      return vehicleVariants.find(
        (v) =>
          v.isActive &&
          v.vehicleType === type &&
          v.capacityVolumeM3 === volume,
      );
    },
    [vehicleVariants],
  );

  function handleCarrierChange(
    _id: string | null,
    item: CompanyDto | null,
  ) {
    onChange({ carrierCompanyId: item?.id ?? null });
  }

  function handleVehicleTypeChange(type: string) {
    setSelectedVehicleType(type);
    // Try to match current volume input to new type
    const vol = parseFloat(volumeInput);
    if (!isNaN(vol)) {
      const match = findVariantByVolume(type, vol);
      onChange({ vehicleVariantCode: match?.code ?? "" });
    } else {
      onChange({ vehicleVariantCode: "" });
    }
  }

  function handleVolumeInputChange(value: string) {
    setVolumeInput(value);
    const vol = parseFloat(value);
    if (!isNaN(vol) && selectedVehicleType) {
      const match = findVariantByVolume(selectedVehicleType, vol);
      onChange({ vehicleVariantCode: match?.code ?? "" });
    } else {
      onChange({ vehicleVariantCode: "" });
    }
  }

  return (
    <div className="space-y-2">
      {/* Row 1: Firma 50% + Typ auta 30% + Objętość 20% */}
      <div className="flex gap-2">
        {/* Firma transportowa (autocomplete) */}
        <div className="basis-1/2 min-w-0">
          <label className="text-xs font-semibold text-slate-400 block mb-1">
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
          <label className="text-xs font-semibold text-slate-400 block mb-1">
            Typ auta *
          </label>
          <Select
            value={selectedVehicleType}
            onValueChange={handleVehicleTypeChange}
            disabled={isReadOnly}
          >
            <SelectTrigger className="w-full h-8 text-sm">
              <SelectValue placeholder="Wybierz typ..." />
            </SelectTrigger>
            <SelectContent>
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
          <label className="text-xs font-semibold text-slate-400 block mb-1">
            m³ *
          </label>
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="m³"
            value={volumeInput}
            onChange={(e) => handleVolumeInputChange(e.target.value)}
            disabled={isReadOnly || !selectedVehicleType}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Row 2: Wymagane dokumenty — full width */}
      <div>
        <label className="text-xs font-semibold text-slate-400 block mb-1">
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
    </div>
  );
}
