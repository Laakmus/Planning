import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrderFormItem } from "@/lib/view-models";
import { useDictionaries } from "@/contexts/DictionaryContext";
import { ItemList } from "./ItemList";

interface CargoSectionProps {
  vehicleVariantCode: string;
  totalLoadTons: number | null;
  totalLoadVolumeM3: number | null;
  specialRequirements: string | null;
  items: OrderFormItem[];
  isReadOnly: boolean;
  errors?: Record<string, string>;
  onVehicleVariantChange: (code: string) => void;
  onFieldChange: (field: string, value: string | number | null) => void;
  onItemsChange: (items: OrderFormItem[]) => void;
}

/**
 * Cargo section of the order form:
 * Vehicle variant, total load weight/volume, special requirements,
 * and the list of cargo items (products).
 */
export function CargoSection({
  vehicleVariantCode,
  totalLoadTons,
  totalLoadVolumeM3,
  specialRequirements,
  items,
  isReadOnly,
  errors,
  onVehicleVariantChange,
  onFieldChange,
  onItemsChange,
}: CargoSectionProps) {
  const { vehicleVariants } = useDictionaries();

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Ładunek
      </legend>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Vehicle variant */}
        <div className="space-y-1.5">
          <Label>
            Wariant pojazdu <span className="text-destructive">*</span>
          </Label>
          <Select
            value={vehicleVariantCode}
            onValueChange={onVehicleVariantChange}
            disabled={isReadOnly}
          >
            <SelectTrigger
              className={errors?.vehicleVariantCode ? "border-destructive" : undefined}
            >
              <SelectValue placeholder="Wybierz wariant" />
            </SelectTrigger>
            <SelectContent>
              {vehicleVariants.map((vv) => (
                <SelectItem key={vv.code} value={vv.code}>
                  {vv.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.vehicleVariantCode && (
            <p className="text-xs text-destructive">{errors.vehicleVariantCode}</p>
          )}
        </div>

        {/* Total load weight */}
        <div className="space-y-1.5">
          <Label>Waga ładunku (t)</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={totalLoadTons ?? ""}
            onChange={(e) => {
              const val = e.target.value === "" ? null : parseFloat(e.target.value);
              onFieldChange("totalLoadTons", isNaN(val as number) ? null : val);
            }}
            placeholder="0.00"
            disabled={isReadOnly}
          />
        </div>

        {/* Total load volume */}
        <div className="space-y-1.5">
          <Label>Objętość ładunku (m³)</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={totalLoadVolumeM3 ?? ""}
            onChange={(e) => {
              const val = e.target.value === "" ? null : parseFloat(e.target.value);
              onFieldChange("totalLoadVolumeM3", isNaN(val as number) ? null : val);
            }}
            placeholder="0.00"
            disabled={isReadOnly}
          />
        </div>
      </div>

      {/* Special requirements */}
      <div className="space-y-1.5">
        <Label>Wymagania specjalne</Label>
        <Textarea
          value={specialRequirements ?? ""}
          onChange={(e) => onFieldChange("specialRequirements", e.target.value || null)}
          placeholder="Wymagania dotyczące transportu..."
          rows={2}
          maxLength={1000}
          disabled={isReadOnly}
          className={errors?.specialRequirements ? "border-destructive" : undefined}
        />
        {errors?.specialRequirements && (
          <p className="text-xs text-destructive">{errors.specialRequirements}</p>
        )}
      </div>

      {/* Cargo items list */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Pozycje towarowe</Label>
        <ItemList
          items={items}
          onChange={onItemsChange}
          disabled={isReadOnly}
          errors={errors}
        />
      </div>
    </fieldset>
  );
}
