/**
 * DictionaryContext — globalny cache słowników referencyjnych.
 *
 * Po zalogowaniu ładuje 6 słowników równolegle (companies, locations,
 * products, transportTypes, orderStatuses, vehicleVariants) i udostępnia
 * je wszystkim komponentom potomnym.
 *
 * Musi być zagnieżdżony wewnątrz <AuthProvider> — korzysta z useAuth().api.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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
import { useAuth } from "./AuthContext";

// ---------------------------------------------------------------------------
// Typy kontekstu
// ---------------------------------------------------------------------------

interface DictionaryContextValue extends DictionaryState {
  /** Ponowne załadowanie wszystkich słowników (np. po synchronizacji ERP). */
  refreshDictionaries: () => Promise<void>;
}

const DictionaryContext = createContext<DictionaryContextValue | null>(null);

// ---------------------------------------------------------------------------
// Stan początkowy
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface DictionaryProviderProps {
  children: ReactNode;
}

export function DictionaryProvider({ children }: DictionaryProviderProps) {
  const { user, api } = useAuth();
  const [state, setState] = useState<DictionaryState>(INITIAL_STATE);

  // Załaduj wszystkie 6 słowników równolegle
  const loadDictionaries = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const [
        companiesRes,
        locationsRes,
        productsRes,
        transportTypesRes,
        orderStatusesRes,
        vehicleVariantsRes,
      ] = await Promise.all([
        api.get<ListResponse<CompanyDto>>("/api/v1/companies"),
        api.get<ListResponse<LocationDto>>("/api/v1/locations"),
        api.get<ListResponse<ProductDto>>("/api/v1/products"),
        api.get<ListResponse<TransportTypeDto>>("/api/v1/transport-types"),
        api.get<ListResponse<OrderStatusDto>>("/api/v1/order-statuses"),
        api.get<ListResponse<VehicleVariantDto>>("/api/v1/vehicle-variants"),
      ]);

      setState({
        companies: companiesRes.items,
        locations: locationsRes.items,
        products: productsRes.items,
        transportTypes: transportTypesRes.items,
        orderStatuses: orderStatusesRes.items,
        vehicleVariants: vehicleVariantsRes.items,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Błąd ładowania słowników.";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, [api]);

  // Ładuj słowniki po zalogowaniu (gdy user się pojawi)
  useEffect(() => {
    if (user) {
      loadDictionaries();
    } else {
      // Wyczyść cache po wylogowaniu
      setState(INITIAL_STATE);
    }
  }, [user, loadDictionaries]);

  const value = useMemo<DictionaryContextValue>(
    () => ({
      ...state,
      refreshDictionaries: loadDictionaries,
    }),
    [state, loadDictionaries],
  );

  return (
    <DictionaryContext.Provider value={value}>
      {children}
    </DictionaryContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook zwracający słowniki referencyjne.
 * Musi być używany wewnątrz <DictionaryProvider>.
 */
export function useDictionaries(): DictionaryContextValue {
  const ctx = useContext(DictionaryContext);
  if (!ctx) {
    throw new Error(
      "useDictionaries() musi być używany wewnątrz <DictionaryProvider>",
    );
  }
  return ctx;
}
