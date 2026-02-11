import { Badge } from "@/components/ui/badge";

interface TransportTypeBadgeProps {
  code: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  PL: "PL",
  EXP: "EXP",
  EXP_K: "EX-K",
  IMP: "IMP",
};

/**
 * Compact badge displaying the transport type code.
 */
export function TransportTypeBadge({ code }: TransportTypeBadgeProps) {
  if (!code) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <Badge variant="outline" className="text-xs font-medium">
      {TYPE_LABELS[code] ?? code}
    </Badge>
  );
}
