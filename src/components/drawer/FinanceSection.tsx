import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FinanceSectionProps {
  priceAmount: number | null;
  currencyCode: string;
  paymentTermDays: number | null;
  paymentMethod: string | null;
  isReadOnly: boolean;
  errors?: Record<string, string>;
  onFieldChange: (field: string, value: string | number | null) => void;
}

/**
 * Finance section of the order form:
 * Price, payment term (days), payment method.
 */
export function FinanceSection({
  priceAmount,
  currencyCode,
  paymentTermDays,
  paymentMethod,
  isReadOnly,
  errors,
  onFieldChange,
}: FinanceSectionProps) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Finanse
      </legend>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Price */}
        <div className="space-y-1.5">
          <Label>
            Cena frachtu ({currencyCode})
          </Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={priceAmount ?? ""}
            onChange={(e) => {
              const val = e.target.value === "" ? null : parseFloat(e.target.value);
              onFieldChange("priceAmount", isNaN(val as number) ? null : val);
            }}
            placeholder="0.00"
            disabled={isReadOnly}
            className={errors?.priceAmount ? "border-destructive" : undefined}
          />
          {errors?.priceAmount && (
            <p className="text-xs text-destructive">{errors.priceAmount}</p>
          )}
        </div>

        {/* Payment term */}
        <div className="space-y-1.5">
          <Label>Termin płatności (dni)</Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={paymentTermDays ?? ""}
            onChange={(e) => {
              const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
              onFieldChange("paymentTermDays", isNaN(val as number) ? null : val);
            }}
            placeholder="30"
            disabled={isReadOnly}
            className={errors?.paymentTermDays ? "border-destructive" : undefined}
          />
          {errors?.paymentTermDays && (
            <p className="text-xs text-destructive">{errors.paymentTermDays}</p>
          )}
        </div>

        {/* Payment method */}
        <div className="space-y-1.5">
          <Label>Forma płatności</Label>
          <Input
            value={paymentMethod ?? ""}
            onChange={(e) => onFieldChange("paymentMethod", e.target.value || null)}
            placeholder="Przelew..."
            disabled={isReadOnly}
          />
        </div>
      </div>
    </fieldset>
  );
}
