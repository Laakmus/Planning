import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface DatePickerFieldProps {
  label?: string;
  value: string | null; // YYYY-MM-DD
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

/**
 * Date picker field using shadcn Calendar + Popover.
 * Stores date as YYYY-MM-DD string.
 */
export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = "Wybierz datę",
  disabled = false,
  error,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  // Parse the value string to a Date object
  const dateValue = value
    ? parse(value, "yyyy-MM-dd", new Date())
    : undefined;

  const isValidDate = dateValue && isValid(dateValue);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
    } else {
      onChange(null);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start font-normal",
              !isValidDate && "text-muted-foreground",
              error && "border-destructive",
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {isValidDate
              ? format(dateValue, "dd.MM.yyyy", { locale: pl })
              : placeholder}
            {value && !disabled && (
              <X
                className="ml-auto h-3 w-3 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={isValidDate ? dateValue : undefined}
            onSelect={handleSelect}
            locale={pl}
            autoFocus
          />
        </PopoverContent>
      </Popover>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
