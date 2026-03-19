/**
 * Hook do pobierania danych widoku magazynowego per tydzień.
 * Parsuje week/year z URL, fetchuje dane z API, obsługuje nawigację tydzień +/-.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getISOWeeksInYear } from "date-fns";
import type { WarehouseWeekResponseDto } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

/** Oblicz bieżący numer tygodnia ISO */
function getCurrentISOWeek(): { week: number; year: number } {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

/** Parsuj week/year z URL (tylko client-side) */
function getInitialWeekYear(): { week: number; year: number } {
  const current = getCurrentISOWeek();
  if (typeof window === "undefined") return current;
  const searchParams = new URLSearchParams(window.location.search);
  return {
    week: parseInt(searchParams.get("week") ?? "") || current.week,
    year: parseInt(searchParams.get("year") ?? "") || current.year,
  };
}

export function useWarehouseWeek(locationId?: string) {
  const [week, setWeek] = useState(() => getInitialWeekYear().week);
  const [year, setYear] = useState(() => getInitialWeekYear().year);
  const [data, setData] = useState<WarehouseWeekResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { api } = useAuth();
  const staleRef = useRef(false);

  // Fetch data
  useEffect(() => {
    staleRef.current = false;
    setIsLoading(true);
    setError(null);

    const params: Record<string, any> = { week, year };
    if (locationId) params.locationId = locationId;

    api.get<WarehouseWeekResponseDto>("/api/v1/warehouse/orders", params)
      .then((result) => {
        if (!staleRef.current) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!staleRef.current) {
          setError(err instanceof Error ? err.message : "Błąd ładowania danych");
          setIsLoading(false);
        }
      });

    return () => { staleRef.current = true; };
  }, [api, week, year, locationId]);

  // Aktualizuj URL (tylko client-side)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("week", String(week));
    url.searchParams.set("year", String(year));
    window.history.replaceState({}, "", url.toString());
  }, [week, year]);

  const prevWeek = useCallback(() => {
    if (week <= 1) {
      // Poprzedni rok może mieć 52 lub 53 tygodnie
      const weeksInPrevYear = getISOWeeksInYear(new Date(year - 1, 6, 1));
      setWeek(weeksInPrevYear);
      setYear(y => y - 1);
    } else {
      setWeek(w => w - 1);
    }
  }, [week, year]);

  const nextWeek = useCallback(() => {
    // Bieżący rok może mieć 52 lub 53 tygodnie
    const weeksInCurrentYear = getISOWeeksInYear(new Date(year, 6, 1));
    if (week >= weeksInCurrentYear) {
      setWeek(1);
      setYear(y => y + 1);
    } else {
      setWeek(w => w + 1);
    }
  }, [week, year]);

  const goToWeek = useCallback((w: number) => {
    if (w >= 1 && w <= 53) setWeek(w);
  }, []);

  return { data, isLoading, error, week, year, prevWeek, nextWeek, goToWeek };
}
