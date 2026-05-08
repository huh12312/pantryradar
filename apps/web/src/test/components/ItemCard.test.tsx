import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ItemCard } from "@/components/inventory/ItemCard";
import type { InventoryItem } from "@/lib/api";

const baseItem: InventoryItem = {
  id: "1",
  name: "Milk",
  brand: "Organic Valley",
  quantity: 3,
  unit: "unit",
  location: "fridge",
  category: "Dairy",
  expirationDate: null,
  expirationEstimated: false,
  barcodeUpc: null,
  imageUrl: null,
  notes: null,
  opened: false,
  householdId: "hh1",
  addedBy: "u1",
  addedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("ItemCard consume button", () => {
  it("shows consume button when quantity > 0", () => {
    render(<ItemCard item={baseItem} onEdit={vi.fn()} onDelete={vi.fn()} onConsume={vi.fn()} />);
    expect(screen.getByRole("button", { name: /consume/i })).toBeInTheDocument();
  });

  it("hides consume button when quantity is 0", () => {
    render(<ItemCard item={{ ...baseItem, quantity: 0 }} onEdit={vi.fn()} onDelete={vi.fn()} onConsume={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /consume/i })).not.toBeInTheDocument();
  });

  it("calls onConsume with item when clicked", () => {
    const onConsume = vi.fn();
    render(<ItemCard item={baseItem} onEdit={vi.fn()} onDelete={vi.fn()} onConsume={onConsume} />);
    fireEvent.click(screen.getByRole("button", { name: /consume/i }));
    expect(onConsume).toHaveBeenCalledWith(baseItem);
  });
});

describe("ItemCard opened badge", () => {
  it("shows opened badge when opened is true", () => {
    render(<ItemCard item={{ ...baseItem, opened: true }} onEdit={vi.fn()} onDelete={vi.fn()} onConsume={vi.fn()} />);
    expect(screen.getByTitle(/opened/i)).toBeInTheDocument();
  });

  it("does not show opened badge when opened is false", () => {
    render(<ItemCard item={baseItem} onEdit={vi.fn()} onDelete={vi.fn()} onConsume={vi.fn()} />);
    expect(screen.queryByTitle(/opened/i)).not.toBeInTheDocument();
  });
});
