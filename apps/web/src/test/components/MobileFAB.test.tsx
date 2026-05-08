import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileFAB } from "@/components/layout/MobileFAB";

describe("MobileFAB", () => {
  it("renders with default 'Add item' label", () => {
    render(<MobileFAB onClick={() => {}} />);
    expect(screen.getByRole("button", { name: /add item/i })).toBeVisible();
  });

  it("invokes onClick when activated", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MobileFAB onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: /add item/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("hides at md+ breakpoints via responsive classes", () => {
    render(<MobileFAB onClick={() => {}} />);
    const fab = screen.getByRole("button", { name: /add item/i });
    expect(fab.className).toMatch(/md:hidden/);
  });

  it("accepts a custom label", () => {
    render(<MobileFAB onClick={() => {}} label="Quick add" />);
    expect(screen.getByRole("button", { name: /quick add/i })).toBeVisible();
  });
});
