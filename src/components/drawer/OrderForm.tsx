import { useState, useEffect, useCallback, useRef } from "react";
import { Separator } from "@/components/ui/separator";
import type {
  OrderDetailDto,
  OrderDetailStopDto,
  OrderDetailItemDto,
  UpdateOrderCommand,
  UpdateOrderStopInput,
  UpdateOrderItemInput,
  TransportTypeCode,
  CompanyDto,
  LocationDto,
} from "@/types";
import type { OrderFormData, OrderFormStop, OrderFormItem } from "@/lib/view-models";
import { HeaderSection } from "./HeaderSection";
import { PartiesSection } from "./PartiesSection";
import { CargoSection } from "./CargoSection";
import { RouteSection } from "./RouteSection";
import { FinanceSection } from "./FinanceSection";
import { DocumentsSection } from "./DocumentsSection";
import { StatusChangeSection } from "./StatusChangeSection";

interface OrderFormProps {
  order: OrderDetailDto;
  stops: OrderDetailStopDto[];
  items: OrderDetailItemDto[];
  isReadOnly: boolean;
  onDirtyChange: (isDirty: boolean) => void;
  /** Register a function that returns current form data as UpdateOrderCommand.
   *  The getter validates and throws FormValidationError if invalid. */
  registerDataGetter: (getter: () => UpdateOrderCommand) => void;
}

/** Custom error thrown when form validation fails */
export class FormValidationError extends Error {
  constructor(
    public readonly fieldErrors: Record<string, string>,
  ) {
    super("Popraw błędy w formularzu");
    this.name = "FormValidationError";
  }
}

// ============================================================================
// DTO ↔ ViewModel mapping
// ============================================================================

function mapToFormData(
  order: OrderDetailDto,
  stops: OrderDetailStopDto[],
  items: OrderDetailItemDto[],
): OrderFormData {
  return {
    transportTypeCode: (order.transportTypeCode as TransportTypeCode) ?? "PL",
    currencyCode: order.currencyCode ?? "PLN",
    priceAmount: order.priceAmount,
    paymentTermDays: order.paymentTermDays,
    paymentMethod: order.paymentMethod,
    totalLoadTons: order.totalLoadTons,
    totalLoadVolumeM3: order.totalLoadVolumeM3,
    carrierCompanyId: order.carrierCompanyId,
    shipperLocationId: order.shipperLocationId,
    receiverLocationId: order.receiverLocationId,
    vehicleVariantCode: order.vehicleVariantCode ?? "",
    specialRequirements: order.specialRequirements,
    requiredDocumentsText: order.requiredDocumentsText,
    generalNotes: order.generalNotes,
    complaintReason: order.complaintReason,
    senderContactName: order.senderContactName,
    senderContactPhone: order.senderContactPhone,
    senderContactEmail: order.senderContactEmail,
    stops: stops.map(
      (s): OrderFormStop => ({
        id: s.id,
        kind: s.kind,
        sequenceNo: s.sequenceNo,
        dateLocal: s.dateLocal,
        timeLocal: s.timeLocal,
        locationId: s.locationId,
        locationNameSnapshot: s.locationNameSnapshot,
        companyNameSnapshot: s.companyNameSnapshot,
        addressSnapshot: s.addressSnapshot,
        notes: s.notes,
        _deleted: false,
      }),
    ),
    items: items.map(
      (i): OrderFormItem => ({
        id: i.id,
        productId: i.productId,
        productNameSnapshot: i.productNameSnapshot,
        defaultLoadingMethodSnapshot: i.defaultLoadingMethodSnapshot,
        quantityTons: i.quantityTons,
        notes: i.notes,
        _deleted: false,
      }),
    ),
  };
}

function mapToCommand(formData: OrderFormData): UpdateOrderCommand {
  const stops: UpdateOrderStopInput[] = formData.stops.map((s) => ({
    id: s.id,
    kind: s.kind,
    sequenceNo: s.sequenceNo,
    dateLocal: s.dateLocal,
    timeLocal: s.timeLocal,
    locationId: s.locationId,
    notes: s.notes,
    _deleted: s._deleted,
  }));

  const items: UpdateOrderItemInput[] = formData.items.map((i) => ({
    id: i.id,
    productId: i.productId,
    productNameSnapshot: i.productNameSnapshot,
    quantityTons: i.quantityTons,
    notes: i.notes,
    _deleted: i._deleted,
  }));

  return {
    transportTypeCode: formData.transportTypeCode,
    currencyCode: formData.currencyCode,
    priceAmount: formData.priceAmount,
    paymentTermDays: formData.paymentTermDays,
    paymentMethod: formData.paymentMethod,
    totalLoadTons: formData.totalLoadTons,
    totalLoadVolumeM3: formData.totalLoadVolumeM3,
    carrierCompanyId: formData.carrierCompanyId,
    shipperLocationId: formData.shipperLocationId,
    receiverLocationId: formData.receiverLocationId,
    vehicleVariantCode: formData.vehicleVariantCode,
    specialRequirements: formData.specialRequirements,
    requiredDocumentsText: formData.requiredDocumentsText,
    generalNotes: formData.generalNotes,
    complaintReason: formData.complaintReason,
    senderContactName: formData.senderContactName,
    senderContactPhone: formData.senderContactPhone,
    senderContactEmail: formData.senderContactEmail,
    stops,
    items,
  };
}

// ============================================================================
// Technical validation (section 9.1 of the implementation plan)
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;

function validateFormData(data: OrderFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  // transportTypeCode — required, must be valid enum
  if (!data.transportTypeCode) {
    errors.transportTypeCode = "Typ transportu jest wymagany";
  }

  // currencyCode — required, must be valid enum
  if (!data.currencyCode) {
    errors.currencyCode = "Waluta jest wymagana";
  }

  // vehicleVariantCode — required, non-empty
  if (!data.vehicleVariantCode || data.vehicleVariantCode.trim() === "") {
    errors.vehicleVariantCode = "Wariant pojazdu jest wymagany";
  }

  // priceAmount — >= 0 if provided
  if (data.priceAmount !== null && data.priceAmount !== undefined && data.priceAmount < 0) {
    errors.priceAmount = "Cena nie może być ujemna";
  }

  // paymentTermDays — integer >= 0 if provided
  if (data.paymentTermDays !== null && data.paymentTermDays !== undefined) {
    if (data.paymentTermDays < 0 || !Number.isInteger(data.paymentTermDays)) {
      errors.paymentTermDays = "Termin płatności musi być liczbą całkowitą >= 0";
    }
  }

  // senderContactEmail — email format if provided
  if (data.senderContactEmail && !EMAIL_REGEX.test(data.senderContactEmail)) {
    errors.senderContactEmail = "Nieprawidłowy format adresu email";
  }

  // generalNotes — max 1000 chars
  if (data.generalNotes && data.generalNotes.length > 1000) {
    errors.generalNotes = "Uwagi ogólne: maksymalnie 1000 znaków";
  }

  // requiredDocumentsText — max 500 chars
  if (data.requiredDocumentsText && data.requiredDocumentsText.length > 500) {
    errors.requiredDocumentsText = "Wymagane dokumenty: maksymalnie 500 znaków";
  }

  // specialRequirements — max 1000 chars
  if (data.specialRequirements && data.specialRequirements.length > 1000) {
    errors.specialRequirements = "Wymagania specjalne: maksymalnie 1000 znaków";
  }

  // Validate stops
  const visibleStops = data.stops.filter((s) => !s._deleted);
  const loadingStops = visibleStops.filter((s) => s.kind === "LOADING");
  const unloadingStops = visibleStops.filter((s) => s.kind === "UNLOADING");

  if (loadingStops.length > 8) {
    errors["stops.loading"] = "Maksymalnie 8 punktów załadunku";
  }
  if (unloadingStops.length > 3) {
    errors["stops.unloading"] = "Maksymalnie 3 punkty rozładunku";
  }

  visibleStops.forEach((stop, index) => {
    // dateLocal — YYYY-MM-DD format if provided
    if (stop.dateLocal && !DATE_REGEX.test(stop.dateLocal)) {
      errors[`stops.${index}.dateLocal`] = "Nieprawidłowy format daty (YYYY-MM-DD)";
    }
    // timeLocal — HH:MM or HH:MM:SS format if provided
    if (stop.timeLocal && !TIME_REGEX.test(stop.timeLocal)) {
      errors[`stops.${index}.timeLocal`] = "Nieprawidłowy format czasu (HH:MM)";
    }
    // notes — max 500 chars
    if (stop.notes && stop.notes.length > 500) {
      errors[`stops.${index}.notes`] = "Uwagi: maksymalnie 500 znaków";
    }
  });

  // Validate items
  const visibleItems = data.items.filter((i) => !i._deleted);
  visibleItems.forEach((item, index) => {
    // quantityTons — >= 0 if provided
    if (item.quantityTons !== null && item.quantityTons !== undefined && item.quantityTons < 0) {
      errors[`items.${index}.quantityTons`] = "Ilość nie może być ujemna";
    }
    // notes — max 500 chars
    if (item.notes && item.notes.length > 500) {
      errors[`items.${index}.notes`] = "Uwagi: maksymalnie 500 znaków";
    }
  });

  return errors;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Order form with sections: Header, Parties, Cargo, Route, Finance, Documents, Status.
 * Manages local form state, dirty tracking, technical validation, and data getter for save.
 */
export function OrderForm({
  order,
  stops,
  items,
  isReadOnly,
  onDirtyChange,
  registerDataGetter,
}: OrderFormProps) {
  const [formData, setFormData] = useState<OrderFormData>(() =>
    mapToFormData(order, stops, items),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const initialDataRef = useRef<string>("");
  // Keep a mutable ref to formData so the getter always has the latest
  const formDataRef = useRef<OrderFormData>(formData);
  formDataRef.current = formData;

  // Store initial data for dirty checking
  useEffect(() => {
    const initial = mapToFormData(order, stops, items);
    setFormData(initial);
    initialDataRef.current = JSON.stringify(initial);
    setErrors({});
    onDirtyChange(false);
  }, [order, stops, items, onDirtyChange]);

  // Register data getter with validation
  useEffect(() => {
    registerDataGetter(() => {
      const currentData = formDataRef.current;
      const validationErrors = validateFormData(currentData);

      if (Object.keys(validationErrors).length > 0) {
        // Set errors in the form so inline messages appear
        setErrors(validationErrors);
        throw new FormValidationError(validationErrors);
      }

      setErrors({});
      return mapToCommand(currentData);
    });
  }, [registerDataGetter]);

  // Check dirty state on every form data change
  useEffect(() => {
    const current = JSON.stringify(formData);
    const isDirty = current !== initialDataRef.current;
    onDirtyChange(isDirty);
  }, [formData, onDirtyChange]);

  // -- Generic field change handler --
  const updateField = useCallback(<K extends keyof OrderFormData>(
    field: K,
    value: OrderFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (errors[field as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  }, [errors]);

  // -- Carrier change --
  const handleCarrierChange = useCallback((company: CompanyDto | null) => {
    setFormData((prev) => ({
      ...prev,
      carrierCompanyId: company?.id ?? null,
    }));
  }, []);

  // -- Shipper location change --
  const handleShipperChange = useCallback((location: LocationDto | null) => {
    setFormData((prev) => ({
      ...prev,
      shipperLocationId: location?.id ?? null,
    }));
  }, []);

  // -- Receiver location change --
  const handleReceiverChange = useCallback((location: LocationDto | null) => {
    setFormData((prev) => ({
      ...prev,
      receiverLocationId: location?.id ?? null,
    }));
  }, []);

  // -- Contact field change --
  const handleContactFieldChange = useCallback((field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value || null }));
  }, []);

  // -- Generic number/string field change --
  const handleGenericFieldChange = useCallback((field: string, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      {/* Header: Order no, date, status, transport type, currency */}
      <HeaderSection
        orderNo={order.orderNo}
        createdAt={order.createdAt}
        statusCode={order.statusCode}
        transportTypeCode={formData.transportTypeCode}
        currencyCode={formData.currencyCode}
        isReadOnly={isReadOnly}
        errors={errors}
        onTransportTypeChange={(val) => updateField("transportTypeCode", val)}
        onCurrencyChange={(val) => updateField("currencyCode", val)}
      />

      <Separator />

      {/* Parties: Carrier, Shipper, Receiver, Contact */}
      <PartiesSection
        carrierCompanyId={formData.carrierCompanyId}
        carrierNameSnapshot={order.carrierNameSnapshot}
        carrierAddressSnapshot={order.carrierAddressSnapshot}
        shipperLocationId={formData.shipperLocationId}
        shipperNameSnapshot={order.shipperNameSnapshot}
        shipperAddressSnapshot={order.shipperAddressSnapshot}
        receiverLocationId={formData.receiverLocationId}
        receiverNameSnapshot={order.receiverNameSnapshot}
        receiverAddressSnapshot={order.receiverAddressSnapshot}
        senderContactName={formData.senderContactName}
        senderContactPhone={formData.senderContactPhone}
        senderContactEmail={formData.senderContactEmail}
        isReadOnly={isReadOnly}
        errors={errors}
        onCarrierChange={handleCarrierChange}
        onShipperChange={handleShipperChange}
        onReceiverChange={handleReceiverChange}
        onContactFieldChange={handleContactFieldChange}
      />

      <Separator />

      {/* Cargo: Vehicle, weight, items */}
      <CargoSection
        vehicleVariantCode={formData.vehicleVariantCode}
        totalLoadTons={formData.totalLoadTons}
        totalLoadVolumeM3={formData.totalLoadVolumeM3}
        specialRequirements={formData.specialRequirements}
        items={formData.items}
        isReadOnly={isReadOnly}
        errors={errors}
        onVehicleVariantChange={(code) => updateField("vehicleVariantCode", code)}
        onFieldChange={handleGenericFieldChange}
        onItemsChange={(newItems) => updateField("items", newItems)}
      />

      <Separator />

      {/* Route: Loading/Unloading points */}
      <RouteSection
        stops={formData.stops}
        isReadOnly={isReadOnly}
        errors={errors}
        onStopsChange={(newStops) => updateField("stops", newStops)}
      />

      <Separator />

      {/* Finance: Price, payment */}
      <FinanceSection
        priceAmount={formData.priceAmount}
        currencyCode={formData.currencyCode}
        paymentTermDays={formData.paymentTermDays}
        paymentMethod={formData.paymentMethod}
        isReadOnly={isReadOnly}
        errors={errors}
        onFieldChange={handleGenericFieldChange}
      />

      <Separator />

      {/* Documents & Notes */}
      <DocumentsSection
        requiredDocumentsText={formData.requiredDocumentsText}
        generalNotes={formData.generalNotes}
        complaintReason={formData.complaintReason}
        isReadOnly={isReadOnly}
        errors={errors}
        onFieldChange={(field, value) => {
          setFormData((prev) => ({ ...prev, [field]: value }));
        }}
      />

      <Separator />

      {/* Status change (only for non-readonly) */}
      <StatusChangeSection
        orderId={order.id}
        currentStatusCode={order.statusCode}
        isReadOnly={isReadOnly}
        onStatusChanged={() => {
          // Parent will handle reload via onOrderUpdated
        }}
      />
    </form>
  );
}
