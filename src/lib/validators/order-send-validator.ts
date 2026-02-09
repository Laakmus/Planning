import type {
  OrderDetailDto,
  OrderDetailStopDto,
  OrderDetailItemDto,
} from "../../types";

/**
 * Validation error item — describes a single missing/invalid field
 * that prevents the order from being sent.
 */
export interface SendValidationError {
  field: string;
  message: string;
}

/**
 * Validates that a transport order has all required data for sending.
 *
 * Business rules (from the plan):
 * - transportTypeCode — required
 * - carrierCompanyId — required (carrier must be set)
 * - shipperLocationId — required (shipper)
 * - receiverLocationId — required (receiver)
 * - items — min 1 item with productNameSnapshot and quantityTons
 * - stops — min 1 LOADING and min 1 UNLOADING with dateLocal and timeLocal
 * - priceAmount — required
 * - vehicleVariantCode — required
 * - paymentTermDays, paymentMethod — optional (do not block sending)
 *
 * @returns Array of validation errors. Empty array = order is valid for sending.
 */
export function validateOrderForSending(
  order: OrderDetailDto,
  stops: OrderDetailStopDto[],
  items: OrderDetailItemDto[]
): SendValidationError[] {
  const errors: SendValidationError[] = [];

  // --- Header fields ---

  if (!order.transportTypeCode) {
    errors.push({
      field: "transportTypeCode",
      message: "Typ transportu jest wymagany",
    });
  }

  if (!order.carrierCompanyId) {
    errors.push({
      field: "carrierCompanyId",
      message: "Przewoźnik jest wymagany",
    });
  }

  if (!order.shipperLocationId) {
    errors.push({
      field: "shipperLocationId",
      message: "Nadawca (lokalizacja) jest wymagany",
    });
  }

  if (!order.receiverLocationId) {
    errors.push({
      field: "receiverLocationId",
      message: "Odbiorca (lokalizacja) jest wymagany",
    });
  }

  if (order.priceAmount == null) {
    errors.push({
      field: "priceAmount",
      message: "Cena frachtu jest wymagana",
    });
  }

  if (!order.vehicleVariantCode) {
    errors.push({
      field: "vehicleVariantCode",
      message: "Wariant pojazdu jest wymagany",
    });
  }

  // --- Items validation ---

  const validItems = items.filter(
    (item) => item.productNameSnapshot && item.quantityTons != null
  );

  if (validItems.length === 0) {
    errors.push({
      field: "items",
      message:
        "Wymagana min. 1 pozycja z nazwą towaru i ilością (tony)",
    });
  }

  // --- Stops validation ---

  const loadingStops = stops.filter((s) => s.kind === "LOADING");
  const unloadingStops = stops.filter((s) => s.kind === "UNLOADING");

  // At least 1 LOADING stop with date and time
  const validLoadingStops = loadingStops.filter(
    (s) => s.dateLocal && s.timeLocal
  );

  if (validLoadingStops.length === 0) {
    errors.push({
      field: "stops",
      message:
        "Wymagany min. 1 punkt załadunku z datą i godziną",
    });
  }

  // At least 1 UNLOADING stop with date and time
  const validUnloadingStops = unloadingStops.filter(
    (s) => s.dateLocal && s.timeLocal
  );

  if (validUnloadingStops.length === 0) {
    errors.push({
      field: "stops",
      message:
        "Wymagany min. 1 punkt rozładunku z datą i godziną",
    });
  }

  return errors;
}
