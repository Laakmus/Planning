import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanyDto, LocationDto } from "@/types";
import { useDictionaries } from "@/contexts/DictionaryContext";
import { AutocompleteField } from "./AutocompleteField";

interface PartiesSectionProps {
  carrierCompanyId: string | null;
  carrierNameSnapshot: string | null;
  carrierAddressSnapshot: string | null;
  shipperLocationId: string | null;
  shipperNameSnapshot: string | null;
  shipperAddressSnapshot: string | null;
  receiverLocationId: string | null;
  receiverNameSnapshot: string | null;
  receiverAddressSnapshot: string | null;
  senderContactName: string | null;
  senderContactPhone: string | null;
  senderContactEmail: string | null;
  isReadOnly: boolean;
  errors?: Record<string, string>;
  onCarrierChange: (company: CompanyDto | null) => void;
  onShipperChange: (location: LocationDto | null) => void;
  onReceiverChange: (location: LocationDto | null) => void;
  onContactFieldChange: (field: string, value: string) => void;
}

/**
 * Parties section of the order form:
 * Carrier (company autocomplete), Shipper (location autocomplete),
 * Receiver (location autocomplete), and contact fields.
 */
export function PartiesSection({
  carrierCompanyId,
  carrierNameSnapshot,
  carrierAddressSnapshot,
  shipperLocationId,
  shipperNameSnapshot,
  shipperAddressSnapshot,
  receiverLocationId,
  receiverNameSnapshot,
  receiverAddressSnapshot,
  senderContactName,
  senderContactPhone,
  senderContactEmail,
  isReadOnly,
  errors,
  onCarrierChange,
  onShipperChange,
  onReceiverChange,
  onContactFieldChange,
}: PartiesSectionProps) {
  const { companies, locations } = useDictionaries();

  // Format a location display string
  const formatLocationDisplay = (name: string | null, address: string | null): string | null => {
    if (!name) return null;
    return address ? `${name} — ${address}` : name;
  };

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Strony
      </legend>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Carrier (company) */}
        <div className="sm:col-span-2">
          <AutocompleteField<CompanyDto>
            label="Przewoźnik"
            placeholder="Wybierz przewoźnika..."
            items={companies}
            value={carrierCompanyId}
            displayValue={carrierNameSnapshot}
            searchFields={["name", "taxId"]}
            onSelect={onCarrierChange}
            disabled={isReadOnly}
            error={errors?.carrierCompanyId}
          />
          {carrierAddressSnapshot && (
            <p className="text-xs text-muted-foreground mt-1">
              {carrierAddressSnapshot}
            </p>
          )}
        </div>

        {/* Shipper (location) */}
        <AutocompleteField<LocationDto>
          label="Nadawca (lokalizacja)"
          placeholder="Wybierz nadawcę..."
          items={locations}
          value={shipperLocationId}
          displayValue={formatLocationDisplay(shipperNameSnapshot, shipperAddressSnapshot)}
          searchFields={["name", "city", "streetAndNumber"]}
          onSelect={onShipperChange}
          disabled={isReadOnly}
          error={errors?.shipperLocationId}
        />

        {/* Receiver (location) */}
        <AutocompleteField<LocationDto>
          label="Odbiorca (lokalizacja)"
          placeholder="Wybierz odbiorcę..."
          items={locations}
          value={receiverLocationId}
          displayValue={formatLocationDisplay(receiverNameSnapshot, receiverAddressSnapshot)}
          searchFields={["name", "city", "streetAndNumber"]}
          onSelect={onReceiverChange}
          disabled={isReadOnly}
          error={errors?.receiverLocationId}
        />
      </div>

      {/* Contact fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Osoba kontaktowa</Label>
          <Input
            value={senderContactName ?? ""}
            onChange={(e) => onContactFieldChange("senderContactName", e.target.value)}
            placeholder="Imię i nazwisko"
            disabled={isReadOnly}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Telefon kontaktowy</Label>
          <Input
            value={senderContactPhone ?? ""}
            onChange={(e) => onContactFieldChange("senderContactPhone", e.target.value)}
            placeholder="+48..."
            disabled={isReadOnly}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Email kontaktowy</Label>
          <Input
            type="email"
            value={senderContactEmail ?? ""}
            onChange={(e) => onContactFieldChange("senderContactEmail", e.target.value)}
            placeholder="email@firma.pl"
            disabled={isReadOnly}
            className={errors?.senderContactEmail ? "border-destructive" : undefined}
          />
          {errors?.senderContactEmail && (
            <p className="text-xs text-destructive">{errors.senderContactEmail}</p>
          )}
        </div>
      </div>
    </fieldset>
  );
}
