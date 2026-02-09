/**
 * ERP Client — stub for MVP.
 *
 * In the production version this module will call the external ERP API
 * to fetch companies, locations, and products data for synchronization.
 *
 * Currently returns empty arrays to allow the sync flow to work
 * end-to-end without an actual ERP connection.
 */

import type { DictionarySyncResource } from "../../types";

/** Shape of a company record returned from ERP */
export interface ErpCompany {
  erpId: string;
  name: string;
  taxId: string | null;
  type: string | null;
  notes: string | null;
}

/** Shape of a location record returned from ERP */
export interface ErpLocation {
  erpId: string;
  name: string;
  companyErpId: string;
  streetAndNumber: string;
  city: string;
  postalCode: string;
  country: string;
  notes: string | null;
}

/** Shape of a product record returned from ERP */
export interface ErpProduct {
  erpId: string;
  name: string;
  description: string | null;
  defaultLoadingMethodCode: string;
}

/**
 * Fetches companies from the external ERP system.
 * MVP stub — returns an empty array.
 */
export async function fetchCompaniesFromErp(): Promise<ErpCompany[]> {
  // TODO: Implement actual ERP API call
  return [];
}

/**
 * Fetches locations from the external ERP system.
 * MVP stub — returns an empty array.
 */
export async function fetchLocationsFromErp(): Promise<ErpLocation[]> {
  // TODO: Implement actual ERP API call
  return [];
}

/**
 * Fetches products from the external ERP system.
 * MVP stub — returns an empty array.
 */
export async function fetchProductsFromErp(): Promise<ErpProduct[]> {
  // TODO: Implement actual ERP API call
  return [];
}

/**
 * Convenience function that fetches data for a specific resource type.
 */
export async function fetchResourceFromErp(
  resource: DictionarySyncResource
): Promise<ErpCompany[] | ErpLocation[] | ErpProduct[]> {
  switch (resource) {
    case "COMPANIES":
      return fetchCompaniesFromErp();
    case "LOCATIONS":
      return fetchLocationsFromErp();
    case "PRODUCTS":
      return fetchProductsFromErp();
  }
}
