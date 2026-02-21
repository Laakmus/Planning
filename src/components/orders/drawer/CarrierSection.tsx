/**
 * Sekcja 3 – Firma transportowa.
 * Autocomplete firmy, wariant pojazdu, wymagane dokumenty.
 */

import { Label } from "@/components/ui/label";
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
  function handleCarrierChange(_id: string | null, item: CompanyDto | null) {
    onChange({ carrierCompanyId: item?.id ?? null });
  }

  const selectedCarrier = formData.carrierCompanyId
    ? companies.find((c) => c.id === formData.carrierCompanyId)
    : null;

  return (
    <div className="space-y-4">
      {/* Firma transportowa */}
      <AutocompleteField
        label="Firma transportowa"
        placeholder="Wybierz przewoźnika…"
        items={companies}
        value={formData.carrierCompanyId}
        displayField="name"
        searchFields={["name"]}
        onChange={handleCarrierChange}
        disabled={isReadOnly}
      />

      {/* NIP (readonly) */}
      {selectedCarrier?.taxId && (
        <div className="space-y-1">
          <Label className="text-xs text-slate-500 dark:text-slate-400">NIP</Label>
          <p className="text-sm text-slate-700 dark:text-slate-300 pl-1">{selectedCarrier.taxId}</p>
        </div>
      )}

      {/* Wariant pojazdu */}
      <div className="space-y-1">
        <Label className="text-xs font-medium">
          Wariant pojazdu<span className="text-red-500 ml-0.5">*</span>
        </Label>
        <Select
          value={formData.vehicleVariantCode}
          onValueChange={(v) => onChange({ vehicleVariantCode: v })}
          disabled={isReadOnly}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Wybierz wariant…" />
          </SelectTrigger>
          <SelectContent>
            {vehicleVariants
              .filter((vv) => vv.isActive)
              .map((vv) => (
                <SelectItem key={vv.code} value={vv.code} className="text-sm">
                  {vv.name}
                  {vv.capacityVolumeM3 != null && ` (${vv.capacityVolumeM3}m³)`}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Wymagane dokumenty */}
      <div className="space-y-1">
        <Label className="text-xs font-medium">Wymagane dokumenty</Label>
        <Select
          value={formData.requiredDocumentsText ?? ""}
          onValueChange={(v) => onChange({ requiredDocumentsText: v || null })}
          disabled={isReadOnly}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Wybierz dokumenty…" />
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
