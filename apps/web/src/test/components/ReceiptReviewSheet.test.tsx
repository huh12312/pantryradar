import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReceiptReviewSheet } from "@/components/inventory/ReceiptReviewSheet";
import type { ReceiptProcessingResult } from "@pantrymaid/shared/schemas";

const receiptData = {
  storeName: "Walmart",
  total: 6.48,
  lineItems: [
    { raw: "GV MLK", decoded: "Milk", confidence: 0.95, quantity: 2, price: 3.99 },
    { raw: "BNNS", decoded: "Bananas", confidence: 0.88, quantity: 1, price: 2.49 },
  ],
} as unknown as ReceiptProcessingResult;

function renderSheet(onConfirm = vi.fn()) {
  render(
    <ReceiptReviewSheet
      open
      onOpenChange={vi.fn()}
      receiptData={receiptData}
      onConfirm={onConfirm}
      isSubmitting={false}
    />
  );
  return onConfirm;
}

describe("ReceiptReviewSheet", () => {
  it("maps only the selected items into the confirm payload", async () => {
    const user = userEvent.setup();
    const onConfirm = renderSheet();

    // Both items are selected by default.
    expect(screen.getByRole("button", { name: /add 2 items to inventory/i })).toBeInTheDocument();

    // Deselect the second item (Bananas).
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);

    expect(screen.getByRole("button", { name: /add 1 item to inventory/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add 1 item to inventory/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const payload = onConfirm.mock.calls[0][0];
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      name: "Milk",
      quantity: 2,
      location: "pantry",
      unit: "unit",
    });
  });

  it("toggles all items with select all / deselect all", async () => {
    const user = userEvent.setup();
    renderSheet();

    // Starts all-selected.
    const toggle = screen.getByRole("button", { name: /deselect all/i });
    await user.click(toggle);

    // Nothing selected → confirm is disabled with the prompt label.
    const confirm = screen.getByRole("button", { name: /select items to add/i });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("button", { name: /select all/i })).toBeInTheDocument();
  });
});
