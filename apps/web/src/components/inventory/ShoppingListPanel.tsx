import { Button } from "@/components/ui/button";
import { ShoppingCart, Trash2, Check } from "lucide-react";
import type { ShoppingListItem } from "@/lib/api";

interface ShoppingListPanelProps {
  items: ShoppingListItem[];
  onPurchased: (item: ShoppingListItem) => void;
  onDelete: (id: string) => void;
}

export function ShoppingListPanel({ items, onPurchased, onDelete }: ShoppingListPanelProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <ShoppingCart className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">Nothing on the re-order list</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {[item.brand, item.suggestedQty && `qty ${item.suggestedQty}`, item.unit]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 h-7 text-xs"
            onClick={() => onPurchased(item)}
          >
            <Check className="h-3 w-3 mr-1" />
            Purchased
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-7 w-7 text-muted-foreground"
            aria-label="Remove"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
