import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TransportTypeCode, CurrencyCode } from "@/types";
import { useDictionaries } from "@/contexts/DictionaryContext";
import { StatusBadge } from "@/components/orders/StatusBadge";

interface HeaderSectionProps {
  orderNo: string;
  createdAt: string;
  statusCode: string;
  transportTypeCode: TransportTypeCode;
  currencyCode: CurrencyCode;
  isReadOnly: boolean;
  errors?: Record<string, string>;
  onTransportTypeChange: (value: TransportTypeCode) => void;
  onCurrencyChange: (value: CurrencyCode) => void;
}

/**
 * Header section of the order form:
 * Order number (readonly), creation date, status badge, transport type, currency.
 */
export function HeaderSection({
  orderNo,
  createdAt,
  statusCode,
  transportTypeCode,
  currencyCode,
  isReadOnly,
  errors,
  onTransportTypeChange,
  onCurrencyChange,
}: HeaderSectionProps) {
  const { transportTypes, orderStatuses } = useDictionaries();

  // Resolve status name for badge
  const statusObj = orderStatuses.find((s) => s.code === statusCode);
  const statusName = statusObj?.name ?? statusCode;

  // Format creation date for display
  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString("pl-PL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Informacje podstawowe
      </legend>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Order number — always readonly */}
        <div className="space-y-1.5">
          <Label>Nr zlecenia</Label>
          <Input value={orderNo} disabled className="font-mono" />
        </div>

        {/* Creation date — always readonly */}
        <div className="space-y-1.5">
          <Label>Data utworzenia</Label>
          <Input value={formattedDate} disabled />
        </div>

        {/* Status badge — always readonly */}
        <div className="space-y-1.5">
          <Label>Status</Label>
          <div className="flex items-center h-9">
            <StatusBadge statusCode={statusCode as any} statusName={statusName} />
          </div>
        </div>

        {/* Spacer on desktop */}
        <div className="hidden sm:block" />

        {/* Transport type */}
        <div className="space-y-1.5">
          <Label>
            Typ transportu <span className="text-destructive">*</span>
          </Label>
          <Select
            value={transportTypeCode}
            onValueChange={(val) => onTransportTypeChange(val as TransportTypeCode)}
            disabled={isReadOnly}
          >
            <SelectTrigger
              className={errors?.transportTypeCode ? "border-destructive" : undefined}
            >
              <SelectValue placeholder="Wybierz typ" />
            </SelectTrigger>
            <SelectContent>
              {transportTypes.map((tt) => (
                <SelectItem key={tt.code} value={tt.code}>
                  {tt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.transportTypeCode && (
            <p className="text-xs text-destructive">{errors.transportTypeCode}</p>
          )}
        </div>

        {/* Currency */}
        <div className="space-y-1.5">
          <Label>
            Waluta <span className="text-destructive">*</span>
          </Label>
          <Select
            value={currencyCode}
            onValueChange={(val) => onCurrencyChange(val as CurrencyCode)}
            disabled={isReadOnly}
          >
            <SelectTrigger
              className={errors?.currencyCode ? "border-destructive" : undefined}
            >
              <SelectValue placeholder="Wybierz walutę" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PLN">PLN</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
          {errors?.currencyCode && (
            <p className="text-xs text-destructive">{errors.currencyCode}</p>
          )}
        </div>
      </div>
    </fieldset>
  );
}
