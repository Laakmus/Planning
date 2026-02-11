import { useState } from "react";
import { Plus } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import type { CreateOrderResponseDto } from "@/types";
import { toast } from "sonner";

interface AddOrderButtonProps {
  onOrderCreated: (orderId: string) => void;
}

/**
 * "+ Dodaj nowy wiersz" button.
 * Creates a draft order with default values and notifies parent.
 * Hidden for READ_ONLY users.
 */
export function AddOrderButton({ onOrderCreated }: AddOrderButtonProps) {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);

  // Don't render for READ_ONLY users
  if (user?.role === "READ_ONLY") return null;

  async function handleClick() {
    setIsCreating(true);

    try {
      const response = await apiClient.post<CreateOrderResponseDto>("/api/v1/orders", {
        transportTypeCode: "PL",
        currencyCode: "PLN",
        vehicleVariantCode: "STANDARD",
      });

      toast.success(`Utworzono zlecenie ${response.orderNo}`);
      onOrderCreated(response.id);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.body.error.message
          : "Nie udało się utworzyć zlecenia";
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isCreating}
      className="bg-primary hover:bg-blue-600 text-white text-xs font-semibold h-9 px-4 rounded-md flex items-center space-x-2 transition-colors disabled:opacity-50"
    >
      <Plus className="h-4 w-4" />
      <span>{isCreating ? "Tworzenie..." : "Nowe Zlecenie"}</span>
    </button>
  );
}
