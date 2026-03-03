// Inline edytory tekstu, liczb i textarea dla dokumentu A4

import React from "react";

// ---------------------------------------------------------------------------
// EditableText — edytowalny tekst inline
// ---------------------------------------------------------------------------

export function EditableText({
  value,
  onChange,
  className,
  disabled,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  [key: string]: any;
}) {
  if (disabled) return <span className={className}>{value}</span>;
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-transparent border-none outline-none w-full ${className ?? ""}`}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// EditableNumber — edytowalna liczba inline (obsluga null, przecinki)
// ---------------------------------------------------------------------------

export function EditableNumber({
  value,
  onChange,
  className,
  disabled,
  suffix,
  ...props
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  className?: string;
  disabled?: boolean;
  suffix?: string;
  [key: string]: any;
}) {
  if (disabled) {
    return (
      <span className={className}>
        {value != null ? value : ""}
        {suffix && value != null ? ` ${suffix}` : ""}
      </span>
    );
  }
  return (
    <input
      type="text"
      value={value != null ? String(value) : ""}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.,]/g, "");
        if (raw === "") {
          onChange(null);
        } else {
          const parsed = parseFloat(raw.replace(",", "."));
          onChange(isNaN(parsed) ? null : parsed);
        }
      }}
      className={`bg-transparent border-none outline-none w-full ${className ?? ""}`}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// EditableTextarea — edytowalny textarea inline
// ---------------------------------------------------------------------------

export function EditableTextarea({
  value,
  onChange,
  className,
  disabled,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  [key: string]: any;
}) {
  if (disabled) {
    return (
      <span className={className} style={{ whiteSpace: "pre-wrap" }}>
        {value}
      </span>
    );
  }
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-transparent border-none outline-none w-full resize-none ${className ?? ""}`}
      {...props}
    />
  );
}
