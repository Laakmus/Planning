import { useState, useCallback, useRef } from "react";
import type {
  OrderDetailResponseDto,
  UpdateOrderCommand,
  UpdateOrderResponseDto,
  PrepareEmailResponseDto,
  LockOrderResponseDto,
} from "@/types";
import { apiClient, ApiError } from "@/lib/api-client";

interface UseOrderDetailReturn {
  /** Full order detail data (order + stops + items) */
  orderData: OrderDetailResponseDto | null;
  /** Whether the detail is currently loading */
  isLoading: boolean;
  /** Whether the order is locked by us (editing allowed) */
  isLocked: boolean;
  /** Whether we should show read-only mode (locked by another user or failed to lock) */
  isReadOnly: boolean;
  /** Name of user who holds the lock (if locked by someone else) */
  lockedByUserName: string | null;
  /** Error message for lock failure or data load failure */
  error: string | null;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Open the order detail: lock → load detail */
  openOrder: (orderId: string) => Promise<void>;
  /** Close the order: unlock if locked by us */
  closeOrder: () => Promise<void>;
  /** Save order data with PUT */
  saveOrder: (data: UpdateOrderCommand) => Promise<boolean>;
  /** Generate PDF — returns blob URL for download */
  generatePdf: () => Promise<string | null>;
  /** Send email — returns emailOpenUrl or throws */
  sendEmail: () => Promise<PrepareEmailResponseDto | null>;
  /** Reload the order detail data without re-locking */
  reloadOrder: () => Promise<void>;
}

/**
 * Hook managing order detail in the drawer:
 * - Lock/unlock flow
 * - Load order detail
 * - Save (PUT), generate PDF, prepare email
 * - Read-only fallback when lock fails (409)
 */
export function useOrderDetail(): UseOrderDetailReturn {
  const [orderData, setOrderData] = useState<OrderDetailResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [lockedByUserName, setLockedByUserName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Store the currently opened order ID
  const currentOrderIdRef = useRef<string | null>(null);

  const loadDetail = useCallback(async (orderId: string): Promise<OrderDetailResponseDto | null> => {
    try {
      const data = await apiClient.get<OrderDetailResponseDto>(
        `/api/v1/orders/${orderId}`,
      );
      return data;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError("Zlecenie nie istnieje");
        } else {
          setError(err.body.error.message);
        }
      } else {
        setError("Błąd ładowania zlecenia");
      }
      return null;
    }
  }, []);

  const openOrder = useCallback(
    async (orderId: string) => {
      setIsLoading(true);
      setError(null);
      setIsReadOnly(false);
      setIsLocked(false);
      setLockedByUserName(null);
      currentOrderIdRef.current = orderId;

      // Step 1: Try to lock the order
      try {
        await apiClient.post<LockOrderResponseDto>(
          `/api/v1/orders/${orderId}/lock`,
        );
        setIsLocked(true);
        setIsReadOnly(false);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          // Order locked by another user — open in read-only mode
          setIsLocked(false);
          setIsReadOnly(true);
          // Try to extract locked-by info from error or we'll get it from order detail
          setLockedByUserName(null);
        } else {
          // Other errors — still try to open in read-only
          setIsLocked(false);
          setIsReadOnly(true);
        }
      }

      // Step 2: Load order detail
      const data = await loadDetail(orderId);
      if (data) {
        setOrderData(data);
        // If we couldn't lock but the order has a lock, show who locked it
        if (!isLocked && data.order.lockedByUserId) {
          // We need to show the locked-by user name — it's in the list item
          // but not always in detail. We'll use the detail's lockedByUserId as indicator.
          setLockedByUserName(null); // Will be updated from list data if needed
        }
      }

      setIsLoading(false);
    },
    [loadDetail, isLocked],
  );

  const closeOrder = useCallback(async () => {
    const orderId = currentOrderIdRef.current;

    // Only unlock if we hold the lock
    if (orderId && isLocked) {
      try {
        await apiClient.post(`/api/v1/orders/${orderId}/unlock`);
      } catch {
        // Silently ignore unlock errors (e.g. lock already expired)
      }
    }

    // Reset all state
    currentOrderIdRef.current = null;
    setOrderData(null);
    setIsLocked(false);
    setIsReadOnly(false);
    setLockedByUserName(null);
    setError(null);
    setIsSaving(false);
  }, [isLocked]);

  const reloadOrder = useCallback(async () => {
    const orderId = currentOrderIdRef.current;
    if (!orderId) return;

    setIsLoading(true);
    const data = await loadDetail(orderId);
    if (data) {
      setOrderData(data);
    }
    setIsLoading(false);
  }, [loadDetail]);

  const saveOrder = useCallback(
    async (data: UpdateOrderCommand): Promise<boolean> => {
      const orderId = currentOrderIdRef.current;
      if (!orderId) return false;

      setIsSaving(true);
      setError(null);

      try {
        await apiClient.put<UpdateOrderResponseDto>(
          `/api/v1/orders/${orderId}`,
          data,
        );
        // Reload order detail to get updated data
        const refreshed = await loadDetail(orderId);
        if (refreshed) {
          setOrderData(refreshed);
        }
        setIsSaving(false);
        return true;
      } catch (err) {
        setIsSaving(false);
        if (err instanceof ApiError) {
          throw err; // Re-throw so the form can handle field-level errors
        }
        throw new Error("Nie udało się zapisać zlecenia");
      }
    },
    [loadDetail],
  );

  const generatePdf = useCallback(async (): Promise<string | null> => {
    const orderId = currentOrderIdRef.current;
    if (!orderId) return null;

    try {
      const blob = await apiClient.post<Blob>(
        `/api/v1/orders/${orderId}/pdf`,
        { regenerate: false },
      );
      // Create a download URL from the blob
      const url = URL.createObjectURL(blob);
      return url;
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new Error("Nie udało się wygenerować PDF");
    }
  }, []);

  const sendEmail = useCallback(async (): Promise<PrepareEmailResponseDto | null> => {
    const orderId = currentOrderIdRef.current;
    if (!orderId) return null;

    try {
      const result = await apiClient.post<PrepareEmailResponseDto>(
        `/api/v1/orders/${orderId}/prepare-email`,
      );
      return result;
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new Error("Nie udało się przygotować maila");
    }
  }, []);

  return {
    orderData,
    isLoading,
    isLocked,
    isReadOnly,
    lockedByUserName,
    error,
    isSaving,
    openOrder,
    closeOrder,
    saveOrder,
    generatePdf,
    sendEmail,
    reloadOrder,
  };
}
