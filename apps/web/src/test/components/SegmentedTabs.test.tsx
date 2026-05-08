import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedTabs } from "@/components/layout/SegmentedTabs";

describe("SegmentedTabs", () => {
  it("renders four tabs with role=tab", () => {
    render(<SegmentedTabs value="all" onChange={() => {}} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveTextContent("All");
    expect(tabs[1]).toHaveTextContent("Pantry");
    expect(tabs[2]).toHaveTextContent("Fridge");
    expect(tabs[3]).toHaveTextContent("Freezer");
  });

  it("marks the active tab with aria-selected", () => {
    render(<SegmentedTabs value="fridge" onChange={() => {}} />);
    const fridge = screen.getByRole("tab", { name: /fridge/i });
    expect(fridge).toHaveAttribute("aria-selected", "true");
  });

  it("calls onChange when a tab is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedTabs value="all" onChange={onChange} />);
    await user.click(screen.getByRole("tab", { name: /freezer/i }));
    expect(onChange).toHaveBeenCalledWith("freezer");
  });

  it("supports ArrowRight keyboard navigation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedTabs value="all" onChange={onChange} />);
    const allTab = screen.getByRole("tab", { name: /all/i });
    allTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("pantry");
  });

  it("renders count badges when provided", () => {
    render(
      <SegmentedTabs
        value="all"
        onChange={() => {}}
        counts={{ all: 12, pantry: 3, fridge: 7, freezer: 2 }}
      />
    );
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
