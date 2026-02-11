import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ComplaintReasonDialogProps {
  isOpen: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Modal dialog requiring a complaint reason when changing status to REK.
 * Validates that the reason is non-empty and max 1000 characters.
 */
export function ComplaintReasonDialog({
  isOpen,
  onConfirm,
  onCancel,
}: ComplaintReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    const trimmed = reason.trim();

    if (!trimmed) {
      setError("Powód reklamacji jest wymagany");
      return;
    }

    if (trimmed.length > 1000) {
      setError("Powód reklamacji nie może przekraczać 1000 znaków");
      return;
    }

    setError(null);
    onConfirm(trimmed);
    // Reset state after confirm
    setReason("");
  };

  const handleCancel = () => {
    setReason("");
    setError(null);
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Powód reklamacji</DialogTitle>
          <DialogDescription>
            Podaj powód zmiany statusu na Reklamacja. Pole jest wymagane.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="complaint-reason">Powód reklamacji</Label>
          <Textarea
            id="complaint-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Opisz powód reklamacji..."
            rows={4}
            maxLength={1000}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground text-right">
            {reason.length}/1000
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Anuluj
          </Button>
          <Button onClick={handleConfirm}>Potwierdź</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
