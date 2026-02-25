/**
 * Ikona blokady edycji zlecenia z tooltipem.
 * Wyświetlana gdy zlecenie jest zablokowane przez INNEGO użytkownika.
 */

import { Lock } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LockIndicatorProps {
  /** Imię i nazwisko użytkownika blokującego (null → nie wyświetlaj). */
  lockedByUserName: string | null;
}

export function LockIndicator({ lockedByUserName }: LockIndicatorProps) {
  if (!lockedByUserName) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center justify-center text-amber-500 dark:text-amber-400 cursor-default">
            <Lock className="w-3.5 h-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-xs">Edytowane przez: {lockedByUserName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
