import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

describe("Sheet", () => {
  it("renders bottom variant content with sheet-content testid", () => {
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <SheetTitle>Hello</SheetTitle>
          <p>Body</p>
        </SheetContent>
      </Sheet>
    );
    const content = screen.getByTestId("sheet-content");
    expect(content).toBeInTheDocument();
    expect(content.className).toMatch(/bottom-0/);
    expect(screen.getByText("Hello")).toBeVisible();
  });

  it("renders dialog variant centered", () => {
    render(
      <Sheet open>
        <SheetContent side="dialog">
          <SheetTitle>Centered</SheetTitle>
        </SheetContent>
      </Sheet>
    );
    const content = screen.getByTestId("sheet-content");
    expect(content.className).toMatch(/translate-x-\[-50%\]/);
  });

  it("renders right variant slide-in from right", () => {
    render(
      <Sheet open>
        <SheetContent side="right">
          <SheetTitle>Side</SheetTitle>
        </SheetContent>
      </Sheet>
    );
    const content = screen.getByTestId("sheet-content");
    expect(content.className).toMatch(/right-0/);
  });

  it("calls onOpenChange when the close button is activated by keyboard", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={handleOpenChange}>
        <SheetContent side="bottom">
          <SheetTitle>Reachable</SheetTitle>
        </SheetContent>
      </Sheet>
    );

    const closeButton = screen.getByRole("button", { name: /close/i });
    closeButton.focus();
    expect(closeButton).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders the drag handle on bottom variant", () => {
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <SheetTitle>Handle</SheetTitle>
        </SheetContent>
      </Sheet>
    );
    const content = screen.getByTestId("sheet-content");
    const handle = content.querySelector('[aria-hidden="true"]');
    expect(handle).not.toBeNull();
    expect(handle?.className).toMatch(/h-1\.5/);
  });

  it("does not render drag handle on dialog variant", () => {
    render(
      <Sheet open>
        <SheetContent side="dialog">
          <SheetTitle>NoHandle</SheetTitle>
        </SheetContent>
      </Sheet>
    );
    const content = screen.getByTestId("sheet-content");
    const handles = content.querySelectorAll('div[aria-hidden="true"].h-1\\.5');
    expect(handles.length).toBe(0);
  });
});
