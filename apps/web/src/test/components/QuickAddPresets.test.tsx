import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickAddPresets } from "@/components/inventory/QuickAddPresets";

const onSelect = vi.fn();

describe("QuickAddPresets", () => {
  it("renders search input", () => {
    render(<QuickAddPresets onSelect={onSelect} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it("filters presets by name", () => {
    render(<QuickAddPresets onSelect={onSelect} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "apple" },
    });
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("Salmon Fillet")).not.toBeInTheDocument();
  });

  it("calls onSelect with preset data when item clicked", () => {
    render(<QuickAddPresets onSelect={onSelect} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "apple" },
    });
    fireEvent.click(screen.getByText("Apple"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Apple", unit: "lb", category: "Produce" })
    );
  });

  it("shows AI suggest button after 3 chars with no match", () => {
    render(<QuickAddPresets onSelect={onSelect} isSuggestLoading={false} onAISuggest={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "xyz" },
    });
    expect(screen.getByRole("button", { name: /ai suggest/i })).toBeInTheDocument();
  });
});
