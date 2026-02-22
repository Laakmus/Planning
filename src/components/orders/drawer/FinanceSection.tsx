/**
 * Sekcja 4 – Finanse.
 * Stawka, waluta, termin płatności, forma płatności.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CurrencyCode, OrderFormData } from "@/lib/view-models";

interface FinanceSectionProps {
  formData: OrderFormData;
  isReadOnly: boolean;
  onChange: (patch: Partial<OrderFormData>) => void;
}

const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: "PLN", label: "PLN" },
  { code: "EUR", label: "EUR" },
  { code: "USD", label: "USD" },
];

const PAYMENT_METHODS = [
  { value: "Przelew", label: "Przelew" },
  { value: "Gotówka", label: "Gotówka" },
  { value: "Karta", label: "Karta" },
];

export function FinanceSection({
  formData,
  isReadOnly,
  onChange,
}: FinanceSectionProps) {
  return (
    <div className="flex gap-2">
      {/* Stawka */}
      <div className="basis-[35%] min-w-0 space-y-1">
        <Label className="text-xs font-medium">
          Stawka<span className="text-red-500 ml-0.5">*</span>
        </Label>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={formData.priceAmount ?? ""}
          onChange={(e) =>
            onChange({ priceAmount: e.target.value !== "" ? parseFloat(e.target.value) : null })
          }
          disabled={isReadOnly}
          className="h-8 text-sm"
          placeholder="0.00"
        />
      </div>

      {/* Waluta */}
      <div className="basis-[15%] min-w-0 space-y-1">
        <Label className="text-xs font-medium">
          Waluta<span className="text-red-500 ml-0.5">*</span>
        </Label>
        <Select
          value={formData.currencyCode}
          onValueChange={(v) => onChange({ currencyCode: v as CurrencyCode })}
          disabled={isReadOnly}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code} className="text-sm">
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Termin płatności */}
      <div className="basis-[25%] min-w-0 space-y-1">
        <Label className="text-xs">Termin (dni)</Label>
        <Input
          type="number"
          min={0}
          step={1}
          value={formData.paymentTermDays ?? ""}
          onChange={(e) =>
            onChange({ paymentTermDays: e.target.value !== "" ? parseInt(e.target.value, 10) : null })
          }
          disabled={isReadOnly}
          className="h-8 text-sm"
          placeholder="21"
        />
      </div>

      {/* Forma płatności */}
      <div className="basis-[25%] min-w-0 space-y-1">
        <Label className="text-xs">Forma płatności</Label>
        <Select
          value={formData.paymentMethod ?? "Przelew"}
          onValueChange={(v) => onChange({ paymentMethod: v })}
          disabled={isReadOnly}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((pm) => (
              <SelectItem key={pm.value} value={pm.value} className="text-sm">
                {pm.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
