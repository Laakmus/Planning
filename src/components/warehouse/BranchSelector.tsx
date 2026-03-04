/**
 * Selektor oddziałów — dropdown do przełączania między lokalizacjami firmy użytkownika.
 */

import { useDictionaries } from "@/contexts/DictionaryContext";
import { useAuth } from "@/contexts/AuthContext";

interface BranchSelectorProps {
  value: string;
  onChange: (locationId: string) => void;
}

export function BranchSelector({ value, onChange }: BranchSelectorProps) {
  const { locations } = useDictionaries();
  const { user } = useAuth();

  // Znajdź firmę użytkownika na podstawie jego locationId
  const userLocation = locations.find((l) => l.id === user?.locationId);
  if (!userLocation) return null;

  // Pokaż tylko lokalizacje tej samej firmy
  const companyLocations = locations.filter((l) => l.companyId === userLocation.companyId);

  if (companyLocations.length <= 1) return null;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium px-3 pr-8 focus:ring-2 focus:ring-primary/20 focus:border-primary"
    >
      {companyLocations.map((loc) => (
        <option key={loc.id} value={loc.id}>
          {loc.name}
        </option>
      ))}
    </select>
  );
}
