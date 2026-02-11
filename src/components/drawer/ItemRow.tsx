import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ProductDto } from "@/types";
import type { OrderFormItem } from "@/lib/view-models";
import { useDictionaries } from "@/contexts/DictionaryContext";
import { AutocompleteField } from "./AutocompleteField";

interface ItemRowProps {
  item: OrderFormItem;
  index: number;
  onChange: (item: OrderFormItem) => void;
  onRemove: () => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

/**
 * Single editable row of a cargo item.
 * Product (autocomplete), quantity (tons), notes, and remove button.
 */
export function ItemRow({
  item,
  index,
  onChange,
  onRemove,
  disabled = false,
  errors,
}: ItemRowProps) {
  const { products } = useDictionaries();

  const handleProductSelect = (product: ProductDto | null) => {
    if (product) {
      onChange({
        ...item,
        productId: product.id,
        productNameSnapshot: product.name,
        defaultLoadingMethodSnapshot: product.defaultLoadingMethodCode,
      });
    } else {
      onChange({
        ...item,
        productId: null,
        productNameSnapshot: null,
        defaultLoadingMethodSnapshot: null,
      });
    }
  };

  const handleQuantityChange = (value: string) => {
    const num = value === "" ? null : parseFloat(value);
    onChange({
      ...item,
      quantityTons: isNaN(num as number) ? null : num,
    });
  };

  const handleNotesChange = (value: string) => {
    onChange({
      ...item,
      notes: value || null,
    });
  };

  return (
    <div className="grid grid-cols-[1fr_100px_1fr_40px] gap-2 items-end">
      {/* Product autocomplete */}
      <AutocompleteField<ProductDto>
        label={index === 0 ? "Towar" : ""}
        placeholder="Wybierz towar..."
        items={products}
        value={item.productId}
        displayValue={item.productNameSnapshot}
        searchFields={["name", "description"]}
        onSelect={handleProductSelect}
        disabled={disabled}
        error={errors?.[`items.${index}.productId`]}
      />

      {/* Quantity */}
      <div className="space-y-1.5">
        {index === 0 && <label className="text-sm font-medium">Ilość (t)</label>}
        <Input
          type="number"
          min={0}
          step={0.01}
          value={item.quantityTons ?? ""}
          onChange={(e) => handleQuantityChange(e.target.value)}
          placeholder="0.00"
          disabled={disabled}
          className={errors?.[`items.${index}.quantityTons`] ? "border-destructive" : undefined}
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        {index === 0 && <label className="text-sm font-medium">Uwagi</label>}
        <Input
          value={item.notes ?? ""}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Uwagi do pozycji..."
          disabled={disabled}
          maxLength={500}
        />
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        className="text-muted-foreground hover:text-destructive"
        title="Usuń pozycję"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
