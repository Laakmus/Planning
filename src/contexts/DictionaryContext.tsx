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
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import type { DictionariesResponse } from "@/types";
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
  // Flaga zapobiegająca powtórnemu wyświetlaniu toasta o błędzie słowników
  const errorShownRef = useRef(false);

  // Klucz cache w sessionStorage
  const CACHE_KEY = "planning:dictionaries";
  // Czas ważności cache: 1 godzina
  const CACHE_TTL_MS = 3_600_000;

  /**
   * Odczytaj słowniki z sessionStorage (jeśli cache < 1h).
   * Zwraca null gdy brak cache, cache wygasł lub sessionStorage niedostępne.
   */
  const readCache = useCallback((): DictionariesResponse | null => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { data: DictionariesResponse; timestamp: number };
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        return parsed.data;
      }
    } catch {
      // sessionStorage niedostępne lub dane uszkodzone — ignoruj
    }
    return null;
  }, []);

  /** Zapisz słowniki do sessionStorage z aktualnym timestamp. */
  const writeCache = useCallback((data: DictionariesResponse): void => {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {
      // sessionStorage pełne lub niedostępne — ignoruj
    }
  }, []);

  /** Usuń cache słowników z sessionStorage. */
  const clearCache = useCallback((): void => {
    try {
      sessionStorage.removeItem(CACHE_KEY);
    } catch {
      // sessionStorage niedostępne — ignoruj
    }
  }, []);

  // Załaduj wszystkie słowniki jednym zapytaniem (z cache sessionStorage)
  const loadDictionaries = useCallback(async () => {
    // Sprawdź cache sessionStorage
    const cached = readCache();
    if (cached) {
      setState({
        companies: cached.companies,
        locations: cached.locations,
        products: cached.products,
        transportTypes: cached.transportTypes,
        orderStatuses: cached.orderStatuses,
        vehicleVariants: cached.vehicleVariants,
        isLoading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await api.get<DictionariesResponse>("/api/v1/dictionaries");

      // Zapisz do cache
      writeCache(data);

      setState({
        companies: data.companies,
        locations: data.locations,
        products: data.products,
        transportTypes: data.transportTypes,
        orderStatuses: data.orderStatuses,
        vehicleVariants: data.vehicleVariants,
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
  }, [api, readCache, writeCache]);

  // Ładuj słowniki po zalogowaniu (gdy user się pojawi)
  useEffect(() => {
    if (user) {
      loadDictionaries();
    } else {
      // Wyczyść cache po wylogowaniu
      setState(INITIAL_STATE);
      clearCache();
      errorShownRef.current = false;
    }
  }, [user, loadDictionaries, clearCache]);

  // Jednorazowy toast o błędzie ładowania słowników
  useEffect(() => {
    if (state.error && !errorShownRef.current) {
      errorShownRef.current = true;
      toast.error("Nie udało się załadować słowników. Spróbuj odświeżyć stronę.");
    }
    if (!state.error) {
      errorShownRef.current = false;
    }
  }, [state.error]);

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
