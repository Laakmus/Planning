import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type {
  CompanyDto,
  LocationDto,
  ProductDto,
  TransportTypeDto,
  OrderStatusDto,
  VehicleVariantDto,
  ListResponse,
} from "@/types";
import type { DictionaryState } from "@/lib/view-models";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "./AuthContext";

interface DictionaryContextValue extends DictionaryState {
  refreshDictionaries: () => Promise<void>;
}

const INITIAL_STATE: DictionaryState = {
  companies: [],
  locations: [],
  products: [],
  transportTypes: [],
  orderStatuses: [],
  vehicleVariants: [],
  isLoading: false,
  error: null,
};

const DictionaryContext = createContext<DictionaryContextValue | null>(null);

export function DictionaryProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<DictionaryState>(INITIAL_STATE);

  const loadDictionaries = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Fetch all 6 dictionaries in parallel
      const [companies, locations, products, transportTypes, orderStatuses, vehicleVariants] =
        await Promise.all([
          apiClient.get<ListResponse<CompanyDto>>("/api/v1/companies", {
            params: { activeOnly: true },
          }),
          apiClient.get<ListResponse<LocationDto>>("/api/v1/locations", {
            params: { activeOnly: true },
          }),
          apiClient.get<ListResponse<ProductDto>>("/api/v1/products", {
            params: { activeOnly: true },
          }),
          apiClient.get<ListResponse<TransportTypeDto>>("/api/v1/transport-types", {
            params: { activeOnly: true },
          }),
          apiClient.get<ListResponse<OrderStatusDto>>("/api/v1/order-statuses"),
          apiClient.get<ListResponse<VehicleVariantDto>>("/api/v1/vehicle-variants", {
            params: { activeOnly: true },
          }),
        ]);

      setState({
        companies: companies.items,
        locations: locations.items,
        products: products.items,
        transportTypes: transportTypes.items,
        orderStatuses: orderStatuses.items,
        vehicleVariants: vehicleVariants.items,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Błąd ładowania słowników",
      }));
    }
  }, []);

  // Load dictionaries when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadDictionaries();
    } else {
      setState(INITIAL_STATE);
    }
  }, [isAuthenticated, loadDictionaries]);

  return (
    <DictionaryContext.Provider
      value={{
        ...state,
        refreshDictionaries: loadDictionaries,
      }}
    >
      {children}
    </DictionaryContext.Provider>
  );
}

/**
 * Hook to access dictionary data.
 * Must be used inside DictionaryProvider.
 */
export function useDictionaries(): DictionaryContextValue {
  const context = useContext(DictionaryContext);
  if (!context) {
    throw new Error("useDictionaries must be used within a DictionaryProvider");
  }
  return context;
}
