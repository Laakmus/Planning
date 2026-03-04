/**
 * Badge typu operacji: Zał (załadunek) lub Roz (rozładunek).
 */

interface OperationTypeBadgeProps {
  type: "LOADING" | "UNLOADING";
}

export function OperationTypeBadge({ type }: OperationTypeBadgeProps) {
  if (type === "LOADING") {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
        Zał
      </span>
    );
  }

  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
      Roz
    </span>
  );
}
