import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface LockIndicatorProps {
  /** User ID who holds the lock (null = not locked) */
  lockedByUserId: string | null;
  /** Display name of the user who holds the lock */
  lockedByUserName: string | null;
}

/**
 * Small lock icon with tooltip, shown when an order is being edited by another user.
 * Renders nothing if the order is not locked.
 */
export function LockIndicator({ lockedByUserId, lockedByUserName }: LockIndicatorProps) {
  if (!lockedByUserId) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Lock className="h-3 w-3 text-orange-500 shrink-0" />
      </TooltipTrigger>
      <TooltipContent>
        Edytowane przez {lockedByUserName ?? "innego użytkownika"}
      </TooltipContent>
    </Tooltip>
  );
}
