import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShoppingListPanel } from "@/components/inventory/ShoppingListPanel";
import type { ShoppingListItem } from "@/lib/api";

const items: ShoppingListItem[] = [
  {
    id: "sl1",
    householdId: "hh1",
    name: "Milk",
    brand: "Organic Valley",
    unit: "unit",
    suggestedQty: 1,
    status: "pending",
    addedBy: "u1",
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("ShoppingListPanel", () => {
  it("renders shopping list items", () => {
    render(
      <ShoppingListPanel
        items={items}
        onPurchased={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText("Milk")).toBeInTheDocument();
  });

  it("shows empty state when no items", () => {
    render(
      <ShoppingListPanel items={[]} onPurchased={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText(/nothing on the re-order list/i)).toBeInTheDocument();
  });

  it("calls onPurchased when Purchased button clicked", () => {
    const onPurchased = vi.fn();
    render(
      <ShoppingListPanel items={items} onPurchased={onPurchased} onDelete={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /purchased/i }));
    expect(onPurchased).toHaveBeenCalledWith(items[0]);
  });

  it("calls onDelete when delete button clicked", () => {
    const onDelete = vi.fn();
    render(
      <ShoppingListPanel items={items} onPurchased={vi.fn()} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onDelete).toHaveBeenCalledWith("sl1");
  });
});
