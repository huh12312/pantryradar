import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemList } from "@/components/inventory/ItemList";
import { colorMap } from "@/lib/inventoryColors";
import type { InventoryItem } from "@/lib/api";

interface LocationSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: InventoryItem[];
  color: "violet" | "blue" | "cyan";
  onAdd: () => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onConsume: (item: InventoryItem) => void;
  consumingIds?: Set<string>;
}

export function LocationSection({
  title,
  icon: Icon,
  items,
  color,
  onAdd,
  onEdit,
  onDelete,
  onConsume,
  consumingIds,
}: LocationSectionProps) {
  return (
    <div data-testid={`section-${title.toLowerCase()}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${colorMap[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-xl"
          onClick={onAdd}
          aria-label={`Add item to ${title}`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <ItemList
        items={items}
        onEdit={onEdit}
        onDelete={onDelete}
        onConsume={onConsume}
        consumingIds={consumingIds}
      />
    </div>
  );
}
