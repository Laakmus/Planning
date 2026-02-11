import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DocumentsSectionProps {
  requiredDocumentsText: string | null;
  generalNotes: string | null;
  complaintReason: string | null;
  isReadOnly: boolean;
  errors?: Record<string, string>;
  onFieldChange: (field: string, value: string | null) => void;
}

/**
 * Documents/Notes section of the order form:
 * Required documents text, general notes, and complaint reason (if applicable).
 */
export function DocumentsSection({
  requiredDocumentsText,
  generalNotes,
  complaintReason,
  isReadOnly,
  errors,
  onFieldChange,
}: DocumentsSectionProps) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Dokumenty i uwagi
      </legend>

      {/* Required documents */}
      <div className="space-y-1.5">
        <Label>Wymagane dokumenty</Label>
        <Textarea
          value={requiredDocumentsText ?? ""}
          onChange={(e) =>
            onFieldChange("requiredDocumentsText", e.target.value || null)
          }
          placeholder="Lista wymaganych dokumentów..."
          rows={2}
          maxLength={500}
          disabled={isReadOnly}
          className={errors?.requiredDocumentsText ? "border-destructive" : undefined}
        />
        {errors?.requiredDocumentsText && (
          <p className="text-xs text-destructive">{errors.requiredDocumentsText}</p>
        )}
        <p className="text-xs text-muted-foreground text-right">
          {(requiredDocumentsText ?? "").length}/500
        </p>
      </div>

      {/* General notes */}
      <div className="space-y-1.5">
        <Label>Uwagi ogólne</Label>
        <Textarea
          value={generalNotes ?? ""}
          onChange={(e) =>
            onFieldChange("generalNotes", e.target.value || null)
          }
          placeholder="Dodatkowe uwagi do zlecenia..."
          rows={3}
          maxLength={1000}
          disabled={isReadOnly}
          className={errors?.generalNotes ? "border-destructive" : undefined}
        />
        {errors?.generalNotes && (
          <p className="text-xs text-destructive">{errors.generalNotes}</p>
        )}
        <p className="text-xs text-muted-foreground text-right">
          {(generalNotes ?? "").length}/1000
        </p>
      </div>

      {/* Complaint reason — visible when status is REK or when there's a value */}
      {complaintReason !== null && complaintReason !== undefined && (
        <div className="space-y-1.5">
          <Label className="text-red-600">Powód reklamacji</Label>
          <Textarea
            value={complaintReason ?? ""}
            onChange={(e) =>
              onFieldChange("complaintReason", e.target.value || null)
            }
            placeholder="Powód reklamacji..."
            rows={2}
            maxLength={1000}
            disabled={isReadOnly}
            className="border-red-200"
          />
        </div>
      )}
    </fieldset>
  );
}
