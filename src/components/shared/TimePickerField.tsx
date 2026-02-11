import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TimePickerFieldProps {
  label?: string;
  value: string | null; // HH:MM or HH:MM:SS
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

/**
 * Simple time input field (HH:MM format).
 * Uses native HTML time input for best UX.
 */
export function TimePickerField({
  label,
  value,
  onChange,
  placeholder = "HH:MM",
  disabled = false,
  error,
}: TimePickerFieldProps) {
  // Normalize value to HH:MM for the input
  const inputValue = value ? value.slice(0, 5) : "";

  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}
      <Input
        type="time"
        value={inputValue}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val || null);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(error && "border-destructive")}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
