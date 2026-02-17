/**
 * Sekcja 5 – Uwagi ogólne.
 */

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrderFormData } from "@/lib/view-models";

interface NotesSectionProps {
  formData: OrderFormData;
  isReadOnly: boolean;
  onChange: (patch: Partial<OrderFormData>) => void;
}

const MAX_NOTES = 1000;

export function NotesSection({ formData, isReadOnly, onChange }: NotesSectionProps) {
  const notes = formData.generalNotes ?? "";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Uwagi ogólne</Label>
        <span className="text-[10px] text-slate-400">
          {notes.length}/{MAX_NOTES}
        </span>
      </div>
      <Textarea
        value={notes}
        onChange={(e) => onChange({ generalNotes: e.target.value || null })}
        disabled={isReadOnly}
        rows={4}
        maxLength={MAX_NOTES}
        className="text-sm resize-none"
        placeholder="Dodatkowe uwagi do zlecenia…"
      />
    </div>
  );
}
