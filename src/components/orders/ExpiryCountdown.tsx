/**
 * Odliczanie do wygaśnięcia anulowanego zlecenia.
 * Anulowane zlecenia są fizycznie usuwane po 24h od anulowania.
 * Wyświetla "Wygasa za X h Y min" z kolorami wg pozostałego czasu:
 * - > 2h: text-muted-foreground (normalny)
 * - <= 2h: pomarańczowy
 * - < 1h: czerwony
 * Aktualizuje się co minutę.
 */

import { useEffect, useState } from "react";

/** Czas życia anulowanego zlecenia w milisekundach (24h). */
const EXPIRY_DURATION_MS = 24 * 60 * 60 * 1000;

interface ExpiryCountdownProps {
  /** Data ostatniej aktualizacji (proxy dla daty anulowania) — ISO string. */
  updatedAt: string;
}

/** Oblicza pozostały czas do wygaśnięcia w milisekundach. */
function calcRemainingMs(updatedAt: string): number {
  const expiresAt = new Date(updatedAt).getTime() + EXPIRY_DURATION_MS;
  return expiresAt - Date.now();
}

/** Formatuje milisekundy na czytelny tekst "X h Y min". */
function formatRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return "Wygasło";

  const totalMinutes = Math.floor(remainingMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0 && minutes <= 0) return "Wygasa za <1 min";
  if (hours <= 0) return `Wygasa za ${minutes} min`;
  if (minutes === 0) return `Wygasa za ${hours} h`;
  return `Wygasa za ${hours} h ${minutes} min`;
}

/** Zwraca klasę koloru wg pozostałego czasu. */
function getColorClass(remainingMs: number): string {
  const hours = remainingMs / (60 * 60 * 1000);
  if (hours < 1) return "text-red-500 dark:text-red-400";
  if (hours <= 2) return "text-orange-500 dark:text-orange-400";
  return "text-muted-foreground";
}

export function ExpiryCountdown({ updatedAt }: ExpiryCountdownProps) {
  const [remainingMs, setRemainingMs] = useState(() => calcRemainingMs(updatedAt));

  useEffect(() => {
    // Aktualizuj natychmiast przy zmianie updatedAt
    setRemainingMs(calcRemainingMs(updatedAt));

    // Odświeżaj co minutę
    const interval = setInterval(() => {
      setRemainingMs(calcRemainingMs(updatedAt));
    }, 60_000);

    return () => clearInterval(interval);
  }, [updatedAt]);

  // Nie wyświetlaj jeśli już wygasło
  if (remainingMs <= 0) {
    return (
      <span className="text-[10px] text-red-500 dark:text-red-400 whitespace-nowrap">
        Wygasło
      </span>
    );
  }

  return (
    <span className={`text-[10px] whitespace-nowrap ${getColorClass(remainingMs)}`}>
      {formatRemaining(remainingMs)}
    </span>
  );
}
