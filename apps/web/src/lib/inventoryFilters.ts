import type { InventoryItem } from "@/lib/api";

export function filterBySearch(items: InventoryItem[], query: string): InventoryItem[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.brand?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
  );
}
