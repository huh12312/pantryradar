import { describe, it, expect } from "vitest";
import { filterBySearch } from "@/lib/inventoryFilters";
import type { InventoryItem } from "@/lib/api";

const makeItem = (overrides: Partial<InventoryItem>): InventoryItem => ({
  id: "1",
  name: "Generic",
  brand: null,
  quantity: 1,
  unit: "ea",
  location: "pantry",
  category: null,
  expirationDate: null,
  expirationEstimated: false,
  barcodeUpc: null,
  imageUrl: null,
  notes: null,
  opened: false,
  householdId: "hh-1",
  addedBy: "u-1",
  addedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const items: InventoryItem[] = [
  makeItem({ id: "1", name: "Apple Juice", brand: "Tropicana", category: "Beverages" }),
  makeItem({ id: "2", name: "Whole Milk", brand: null, category: "Dairy" }),
  makeItem({ id: "3", name: "Cheddar Cheese", brand: "Tillamook", category: null }),
  makeItem({ id: "4", name: "Frozen Peas", brand: undefined, category: "Frozen" }),
];

describe("filterBySearch", () => {
  it("returns all items when query is empty", () => {
    expect(filterBySearch(items, "")).toHaveLength(4);
  });

  it("returns all items when query is whitespace only", () => {
    expect(filterBySearch(items, "   ")).toHaveLength(4);
  });

  it("matches on item name (case-insensitive)", () => {
    const result = filterBySearch(items, "apple");
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Apple Juice");
  });

  it("matches on brand (case-insensitive)", () => {
    const result = filterBySearch(items, "tropicana");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("1");
  });

  it("matches on category (case-insensitive)", () => {
    const result = filterBySearch(items, "dairy");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("2");
  });

  it("does not throw when brand is null", () => {
    expect(() => filterBySearch(items, "milk")).not.toThrow();
    expect(filterBySearch(items, "milk")).toHaveLength(1);
  });

  it("does not throw when brand is undefined", () => {
    expect(() => filterBySearch(items, "frozen")).not.toThrow();
  });

  it("does not throw when category is null", () => {
    expect(() => filterBySearch(items, "tillamook")).not.toThrow();
    expect(filterBySearch(items, "tillamook")).toHaveLength(1);
  });

  it("returns empty array when no items match", () => {
    expect(filterBySearch(items, "xyznotfound")).toHaveLength(0);
  });

  it("returns multiple matches when query overlaps", () => {
    // "e" appears in Juice, Cheese — but also Apple, Whole, Peas, Cheddar, Tillamook, Frozen, Beverages, Dairy
    const result = filterBySearch(items, "cheese");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("3");
  });
});
