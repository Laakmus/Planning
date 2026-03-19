/**
 * Sekcja 2 – Towar.
 * Lista pozycji towarowych.
 */

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductDto } from "@/types";
import type { LoadingMethodCode, OrderFormData, OrderFormItem } from "@/lib/view-models";

import { AutocompleteField } from "./AutocompleteField";

interface CargoSectionProps {
  formData: OrderFormData;
  products: ProductDto[];
  isReadOnly: boolean;
  onChange: (patch: Partial<OrderFormData>) => void;
}

const LOADING_METHODS: { code: LoadingMethodCode; label: string }[] = [
  { code: "LUZEM", label: "Luzem" },
  { code: "PALETA_BIGBAG", label: "Bigbag" },
  { code: "PALETA", label: "Paleta" },
  { code: "KOSZE", label: "Inne" },
];

export function CargoSection({
  formData,
  products,
  isReadOnly,
  onChange,
}: CargoSectionProps) {
  const activeItems = formData.items.filter((it) => !it._deleted);
  const totalTons = activeItems.reduce((sum, it) => sum + (it.quantityTons ?? 0), 0);

  // Stan dialogu potwierdzenia usunięcia towaru
  const [pendingRemoveIdx, setPendingRemoveIdx] = useState<number | null>(null);

  function patchItem(idx: number, patch: Partial<OrderFormItem>) {
    const updated = formData.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange({ items: updated });
  }

  /** Sprawdza czy pozycja towarowa ma wypełnione dane */
  function itemHasData(item: OrderFormItem): boolean {
    return item.productId !== null || item.quantityTons !== null || item.notes !== null;
  }

  function doRemoveItem(idx: number) {
    const item = formData.items[idx];
    let updated: OrderFormItem[];
    if (item.id === null) {
      updated = formData.items.filter((_, i) => i !== idx);
    } else {
      updated = formData.items.map((it, i) => (i === idx ? { ...it, _deleted: true } : it));
    }
    onChange({ items: updated });
  }

  function removeItem(idx: number) {
    const item = formData.items[idx];
    // Jeśli pozycja ma dane — pokaż dialog potwierdzenia
    if (itemHasData(item)) {
      setPendingRemoveIdx(idx);
    } else {
      doRemoveItem(idx);
    }
  }

  function addItem() {
    const newItem: OrderFormItem = {
      id: null,
      productId: null,
      productNameSnapshot: null,
      defaultLoadingMethodSnapshot: null,
      loadingMethodCode: null,
      quantityTons: null,
      notes: null,
      _deleted: false,
      _clientKey: crypto.randomUUID(),
    };
    onChange({ items: [...formData.items, newItem] });
  }

  function handleProductChange(idx: number, _id: string | null, item: ProductDto | null) {
    patchItem(idx, {
      productId: item?.id ?? null,
      productNameSnapshot: item?.name ?? null,
      defaultLoadingMethodSnapshot: item?.defaultLoadingMethodCode ?? null,
      loadingMethodCode: (item?.defaultLoadingMethodCode as LoadingMethodCode) ?? null,
    });
  }

  return (
    <div className="space-y-4">
      {/* Lista pozycji */}
      <div className="space-y-3">
        {formData.items.map((item, idx) => {
          if (item._deleted) return null;
          const itemNo = formData.items.filter((it, i) => !it._deleted && i <= idx).length;
          return (
            <div
              key={item._clientKey || item.id || idx}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 p-3 space-y-0 hover:border-amber-500/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2 py-0.5 bg-amber-500/10 text-amber-500 dark:bg-amber-400/10 dark:text-amber-400 rounded uppercase">
                  Produkt {itemNo}
                </span>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    aria-label="Usuń towar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Produkt + Waga + Sposób załadunku — single row grid */}
              <div className="grid grid-cols-12 gap-2">
                {/* Nazwa towaru */}
                <div className="col-span-12 md:col-span-6">
                  <AutocompleteField
                    label="Nazwa towaru"
                    placeholder="Wybierz towar…"
                    items={products}
                    value={item.productId}
                    displayField="name"
                    searchFields={["name"]}
                    onChange={(id, prod) => handleProductChange(idx, id, prod as ProductDto | null)}
                    disabled={isReadOnly}
                    required
                  />
                </div>

                {/* Waga */}
                <div className="col-span-6 md:col-span-2 space-y-1">
                  <Label className="text-xs">
                    Waga (t)<span className="text-red-500 ml-0.5">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.quantityTons ?? ""}
                    onChange={(e) =>
                      patchItem(idx, {
                        quantityTons: e.target.value !== "" ? parseFloat(e.target.value) : null,
                      })
                    }
                    disabled={isReadOnly}
                    className="h-8 text-sm"
                    placeholder="0.00"
                  />
                </div>

                {/* Sposób załadunku */}
                <div className="col-span-6 md:col-span-4 space-y-1">
                  <Label className="text-xs">Sposób załadunku</Label>
                  <Select
                    value={item.loadingMethodCode ?? ""}
                    onValueChange={(v) =>
                      patchItem(idx, { loadingMethodCode: (v || null) as LoadingMethodCode | null })
                    }
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Wybierz…" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOADING_METHODS.map((lm) => (
                        <SelectItem key={lm.code} value={lm.code} className="text-sm">
                          {lm.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {item.defaultLoadingMethodSnapshot && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      Domyślnie: {item.defaultLoadingMethodSnapshot}
                    </p>
                  )}
                </div>
              </div>

              {/* Komentarz */}
              <div className="space-y-1">
                <Label className="text-xs">Komentarz</Label>
                <Input
                  value={item.notes ?? ""}
                  onChange={(e) => patchItem(idx, { notes: e.target.value || null })}
                  disabled={isReadOnly}
                  className="h-8 text-sm"
                  placeholder="Uwagi do towaru…"
                  maxLength={500}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Podsumowanie tonażu */}
      {activeItems.length > 0 && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
            Razem: {totalTons.toFixed(2)}t
          </span>
        </div>
      )}

      {/* Dodaj towar */}
      {!isReadOnly && (
        <button
          type="button"
          onClick={addItem}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 hover:border-amber-500/50 transition-all"
        >
          <Plus className="w-4 h-4" />
          Dodaj kolejny asortyment
        </button>
      )}

      {/* Dialog potwierdzenia usunięcia towaru z danymi */}
      <AlertDialog open={pendingRemoveIdx !== null} onOpenChange={(open) => { if (!open) setPendingRemoveIdx(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć pozycję towarową?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć tę pozycję? Dane zostaną utracone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRemoveIdx !== null) {
                  doRemoveItem(pendingRemoveIdx);
                  setPendingRemoveIdx(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
