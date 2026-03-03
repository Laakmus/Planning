// Pickery daty i czasu dla dokumentu A4

import React, { useRef, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TIME_SLOTS } from "./constants";

// ---------------------------------------------------------------------------
// TimePickerPopover — lista slotow co 30 min
// ---------------------------------------------------------------------------

export function TimePickerPopover({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Wyswietl HH:MM
  const display = value ? value.substring(0, 5) : "";

  if (disabled) {
    return (
      <span
        className="text-[7px] font-bold"
        style={{ letterSpacing: "0.21px" }}
      >
        {display}
      </span>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        // Scroll do wybranego czasu przy otwieraniu
        if (isOpen && display) {
          requestAnimationFrame(() => {
            const el = listRef.current?.querySelector(
              `[data-time="${display}"]`,
            );
            el?.scrollIntoView({ block: "center" });
          });
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="bg-transparent border-none outline-none text-[7px] font-bold cursor-pointer text-left hover:bg-yellow-50/50 rounded-sm px-0.5 -mx-0.5"
          style={{ color: "#000", letterSpacing: "0.21px" }}
        >
          {display || "\u2014"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-24 p-0"
        align="start"
        side="bottom"
        sideOffset={2}
      >
        <div
          ref={listRef}
          className="max-h-48 overflow-y-auto py-1"
        >
          {TIME_SLOTS.map((slot) => (
            <div
              key={slot}
              data-time={slot}
              className={`px-3 py-1 text-xs cursor-pointer hover:bg-gray-100 ${
                display === slot ? "font-bold bg-gray-50" : ""
              }`}
              onClick={() => {
                onChange(slot);
                setOpen(false);
              }}
            >
              {slot}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// DatePickerPopover — kalendarz z shadcn Calendar
// ---------------------------------------------------------------------------

export function DatePickerPopover({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Parse ISO date string na obiekt Date
  const selectedDate = value ? new Date(value + "T00:00:00") : undefined;

  if (disabled) {
    return (
      <span
        className="text-[7px] font-bold"
        style={{ letterSpacing: "0.14px" }}
      >
        {value ?? ""}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-0.5 text-[7px] font-bold bg-transparent border-none outline-none cursor-pointer text-left w-full hover:bg-yellow-50/50 rounded-sm px-0.5 -mx-0.5"
          style={{ color: "#000", letterSpacing: "0.14px" }}
        >
          <span className="truncate flex-1">
            {value || "wybierz dat\u0119..."}
          </span>
          <CalendarIcon
            className="shrink-0 opacity-40"
            style={{ width: 8, height: 8 }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={2}>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) {
              // Format do YYYY-MM-DD
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, "0");
              const d = String(date.getDate()).padStart(2, "0");
              onChange(`${y}-${m}-${d}`);
            } else {
              onChange(null);
            }
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
