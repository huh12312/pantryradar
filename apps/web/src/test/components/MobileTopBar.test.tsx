import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

const renderWithTheme = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <ThemeProvider>{ui}</ThemeProvider>
    </MemoryRouter>
  );

const baseProps = {
  inviteCode: "ABC-123",
  onSearchToggle: vi.fn(),
  onAdd: vi.fn(),
  onScan: vi.fn(),
  onReceipt: vi.fn(),
  onLogout: vi.fn(),
};

describe("MobileTopBar", () => {
  it("renders the brand and primary actions", () => {
    renderWithTheme(<MobileTopBar {...baseProps} />);
    expect(screen.getByText(/pantryradar/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /search items/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /add item/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /more options/i })).toBeVisible();
  });

  it("invokes onAdd when the plus button is clicked", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    renderWithTheme(<MobileTopBar {...baseProps} onAdd={onAdd} />);
    await user.click(screen.getByRole("button", { name: /add item/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("invokes onSearchToggle when the search button is clicked", async () => {
    const user = userEvent.setup();
    const onSearchToggle = vi.fn();
    renderWithTheme(<MobileTopBar {...baseProps} onSearchToggle={onSearchToggle} />);
    await user.click(screen.getByRole("button", { name: /search items/i }));
    expect(onSearchToggle).toHaveBeenCalledTimes(1);
  });

  it("hides at md+ breakpoint via responsive class", () => {
    renderWithTheme(<MobileTopBar {...baseProps} />);
    const header = screen.getByTestId("mobile-top-bar");
    expect(header.className).toMatch(/md:hidden/);
  });
});
