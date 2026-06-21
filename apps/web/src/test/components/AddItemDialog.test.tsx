import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import type { ProductSearchResult } from "@/lib/api";

const API_BASE = "http://localhost:3000";

// ---------------------------------------------------------------------------
// Minimal wrapper: QueryClientProvider only (no router/theme needed here).
// ---------------------------------------------------------------------------
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderDialog(props: Partial<Parameters<typeof AddItemDialog>[0]> = {}) {
  const queryClient = makeQueryClient();

  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    ...props,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AddItemDialog {...defaults} />
    </QueryClientProvider>
  );
}

// A minimal ProductSearchResult the search handler returns.
const SEARCH_RESULT: ProductSearchResult = {
  name: "Coca-Cola Classic",
  brand: "Coca-Cola",
  category: "Beverages",
  imageUrl: undefined,
  upc: "049000028911",
  source: "open_food_facts",
  confidence: 0.9,
};

// ---------------------------------------------------------------------------
// Scan button — presence / absence
// ---------------------------------------------------------------------------

describe("AddItemDialog — Scan barcode button", () => {
  it("renders when onScanRequest is provided", () => {
    renderDialog({ onScanRequest: vi.fn() });
    expect(screen.getByRole("button", { name: "Scan barcode" })).toBeInTheDocument();
  });

  it("is absent when onScanRequest is not provided", () => {
    renderDialog();
    expect(screen.queryByRole("button", { name: "Scan barcode" })).not.toBeInTheDocument();
  });

  it("calls onScanRequest exactly once when clicked", async () => {
    const onScanRequest = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onScanRequest });

    await user.click(screen.getByRole("button", { name: "Scan barcode" }));

    expect(onScanRequest).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// barcodeNotice banner — role="status" and text
// ---------------------------------------------------------------------------

describe("AddItemDialog — barcodeNotice banner", () => {
  it("renders with role=status when a notice string is provided", () => {
    const notice = "We couldn't find that product in our database.";
    renderDialog({ barcodeNotice: notice });

    const banner = screen.getByRole("status");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(notice);
  });

  it("is absent when barcodeNotice is null", () => {
    renderDialog({ barcodeNotice: null });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("is absent when barcodeNotice is undefined", () => {
    renderDialog();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Product-search combobox regression — scan button must not break search
// ---------------------------------------------------------------------------

describe("AddItemDialog — product search with onScanRequest present", () => {
  beforeEach(() => {
    // Add handlers for the two APIs the dialog calls on open / on search.
    server.use(
      // getItems (duplicate-warning check) — already in default handlers but
      // override explicitly so this test stays self-contained.
      http.get(`${API_BASE}/api/items`, () =>
        HttpResponse.json({ success: true, data: { items: [], total: 0, page: 1, pageSize: 50 } })
      ),
      // Product search — no default handler exists for this endpoint.
      http.get(`${API_BASE}/api/products/search`, () =>
        HttpResponse.json({ success: true, data: [SEARCH_RESULT] })
      )
    );
  });

  it("shows search results when typing into the search input alongside the scan button", async () => {
    const user = userEvent.setup();
    renderDialog({ onScanRequest: vi.fn() });

    // The scan button is visible.
    expect(screen.getByRole("button", { name: "Scan barcode" })).toBeInTheDocument();

    // Type into the product-search input (identified by label).
    const searchInput = screen.getByLabelText(/search products/i);
    await user.type(searchInput, "co");

    // Wait for the listbox with results to appear (debounce is 300 ms).
    await waitFor(
      () => {
        expect(
          screen.getByRole("listbox", { name: /product search results/i })
        ).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // The mocked result should appear in the list.
    expect(screen.getByRole("option", { name: /coca-cola classic/i })).toBeInTheDocument();
  });
});
