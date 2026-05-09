import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OverflowMenu } from "@/components/layout/OverflowMenu";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

const renderWithTheme = (ui: React.ReactNode) =>
  render(<MemoryRouter><ThemeProvider>{ui}</ThemeProvider></MemoryRouter>);

const baseProps = {
  inviteCode: "TEAM-42",
  onScan: vi.fn(),
  onReceipt: vi.fn(),
  onLogout: vi.fn(),
};

describe("OverflowMenu", () => {
  it("opens menu and reveals each action", async () => {
    const user = userEvent.setup();
    renderWithTheme(<OverflowMenu {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /more options/i }));
    expect(
      await screen.findByRole("menuitem", { name: /scan barcode/i })
    ).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: /upload receipt/i })
    ).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeVisible();
  });

  it("invokes onScan when the scan menu item is selected", async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    renderWithTheme(<OverflowMenu {...baseProps} onScan={onScan} />);
    await user.click(screen.getByRole("button", { name: /more options/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /scan barcode/i })
    );
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it("invokes onLogout when sign out is selected", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    renderWithTheme(<OverflowMenu {...baseProps} onLogout={onLogout} />);
    await user.click(screen.getByRole("button", { name: /more options/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /sign out/i })
    );
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("renders the invite code when provided", async () => {
    const user = userEvent.setup();
    renderWithTheme(<OverflowMenu {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /more options/i }));
    expect(await screen.findByText(/invite: TEAM-42/i)).toBeVisible();
  });
});
