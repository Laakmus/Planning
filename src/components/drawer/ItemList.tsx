import { useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderFormItem } from "@/lib/view-models";
import { ItemRow } from "./ItemRow";

interface ItemListProps {
  items: OrderFormItem[];
  onChange: (items: OrderFormItem[]) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

/**
 * List of editable cargo item rows.
 * Supports adding new items and removing existing ones (soft-delete for saved items).
 */
export function ItemList({
  items,
  onChange,
  disabled = false,
  errors,
}: ItemListProps) {
  // Only show non-deleted items
  const visibleItems = items.filter((item) => !item._deleted);

  const handleItemChange = useCallback(
    (index: number, updatedItem: OrderFormItem) => {
      const newItems = [...items];
      // Find the actual index in the full items array (including deleted)
      let visibleIndex = 0;
      for (let i = 0; i < newItems.length; i++) {
        if (!newItems[i]._deleted) {
          if (visibleIndex === index) {
            newItems[i] = updatedItem;
            break;
          }
          visibleIndex++;
        }
      }
      onChange(newItems);
    },
    [items, onChange],
  );

  const handleRemoveItem = useCallback(
    (index: number) => {
      const newItems = [...items];
      let visibleIndex = 0;
      for (let i = 0; i < newItems.length; i++) {
        if (!newItems[i]._deleted) {
          if (visibleIndex === index) {
            if (newItems[i].id) {
              // Existing item — soft delete
              newItems[i] = { ...newItems[i], _deleted: true };
            } else {
              // New item — remove from array
              newItems.splice(i, 1);
            }
            break;
          }
          visibleIndex++;
        }
      }
      onChange(newItems);
    },
    [items, onChange],
  );

  const handleAddItem = useCallback(() => {
    const newItem: OrderFormItem = {
      id: null,
      productId: null,
      productNameSnapshot: null,
      defaultLoadingMethodSnapshot: null,
      quantityTons: null,
      notes: null,
      _deleted: false,
    };
    onChange([...items, newItem]);
  }, [items, onChange]);

  return (
    <div className="space-y-3">
      {visibleItems.map((item, index) => (
        <ItemRow
          key={item.id ?? `new-${index}`}
          item={item}
          index={index}
          onChange={(updated) => handleItemChange(index, updated)}
          onRemove={() => handleRemoveItem(index)}
          disabled={disabled}
          errors={errors}
        />
      ))}

      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          className="w-full"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Dodaj pozycję
        </Button>
      )}
    </div>
  );
}
