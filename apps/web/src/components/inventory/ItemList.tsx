import { useState } from "react";
import { ShoppingCart, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ItemCard } from "./ItemCard";
import type { InventoryItem } from "@/lib/api";
import { FOOD_CATEGORIES } from "@pantrymaid/shared/constants";

interface ItemListProps {
  items: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onConsume?: (item: InventoryItem) => void;
  consumingIds?: Set<string>;
}

const CATEGORY_ORDER = new Map<string, number>(FOOD_CATEGORIES.map((cat, i) => [cat, i]));

function sortAndGroup(items: InventoryItem[]): Array<{ category: string; items: InventoryItem[] }> {
  const sorted = [...items].sort((a, b) => {
    const ai = CATEGORY_ORDER.get(a.category ?? "") ?? FOOD_CATEGORIES.length;
    const bi = CATEGORY_ORDER.get(b.category ?? "") ?? FOOD_CATEGORIES.length;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });

  const groups: Array<{ category: string; items: InventoryItem[] }> = [];
  for (const item of sorted) {
    const label = item.category ?? "Uncategorised";
    const last = groups[groups.length - 1];
    if (last && last.category === label) {
      last.items.push(item);
    } else {
      groups.push({ category: label, items: [item] });
    }
  }
  return groups;
}

export function ItemList({ items, onEdit, onDelete, onConsume, consumingIds }: ItemListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(category: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="p-4 bg-secondary rounded-2xl mb-3">
          <ShoppingCart className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Nothing here yet</p>
        <p className="text-xs text-muted-foreground mt-1">Add your first item using the + button</p>
      </div>
    );
  }

  const groups = sortAndGroup(items);

  return (
    <div className="space-y-3">
      {groups.map(({ category, items: groupItems }) => {
        const isCollapsed = collapsed.has(category);
        return (
          <div key={category}>
            <button
              type="button"
              onClick={() => toggle(category)}
              aria-expanded={!isCollapsed}
              aria-controls={`category-group-${category.replace(/\s+/g, "-").toLowerCase()}`}
              className="w-full flex items-center justify-between px-1 min-h-12 md:min-h-9 mb-1.5 group"
            >
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                {category}
                <span className="ml-1.5 text-muted-foreground/40">{groupItems.length}</span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 md:h-3 md:w-3 text-muted-foreground/60 group-hover:text-muted-foreground transition-all duration-200",
                  isCollapsed && "-rotate-90"
                )}
              />
            </button>
            <div
              id={`category-group-${category.replace(/\s+/g, "-").toLowerCase()}`}
              hidden={isCollapsed}
              className="space-y-2"
            >
              {groupItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onConsume={onConsume ?? (() => {})}
                  isConsuming={consumingIds?.has(item.id) ?? false}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
