import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { server } from "../mocks/server";
import { useInventoryMutations, type MutationCallbacks } from "@/hooks/useInventoryMutations";
import { queryKeys } from "@/lib/queryKeys";
import type { InventoryItem } from "@/lib/api";

const API_BASE = "http://localhost:3000";

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "1",
    name: "Milk",
    quantity: 5,
    unit: "gallon",
    location: "fridge",
    ...overrides,
  } as unknown as InventoryItem;
}

function makeCallbacks(): MutationCallbacks {
  return {
    onItemSaved: vi.fn(),
    onItemSaveError: vi.fn(),
    onDeleteError: vi.fn(),
    onReceiptUploaded: vi.fn(),
    onReceiptUploadError: vi.fn(),
    onBulkAddSuccess: vi.fn(),
    onBulkAddError: vi.fn(),
    onShoppingListError: vi.fn(),
    onConsumeSuccess: vi.fn(),
    onConsumeError: vi.fn(),
    onPurchasedSuccess: vi.fn(),
    onPurchasedError: vi.fn(),
  };
}

function renderWithCache(items: InventoryItem[], callbacks: MutationCallbacks) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // Seed the house-scoped list cache the same way InventoryPage reads it.
  queryClient.setQueryData(queryKeys.inventory.list(null), items);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useInventoryMutations(callbacks), { wrapper });
  const readQty = (id: string) =>
    queryClient
      .getQueryData<InventoryItem[]>(queryKeys.inventory.list(null))
      ?.find((i) => i.id === id)?.quantity;
  return { ...view, queryClient, readQty };
}

describe("useInventoryMutations — optimistic quantity stepper", () => {
  beforeEach(() => {
    // Echo the PATCHed quantity back so success reflects the requested value.
    server.use(
      http.patch(`${API_BASE}/api/items/:id`, async ({ params, request }) => {
        const body = (await request.json()) as { quantity?: number };
        return HttpResponse.json({
          success: true,
          data: { id: params.id, name: "Milk", location: "fridge", unit: "gallon", ...body },
        });
      })
    );
  });

  it("applies the decrement to the cache immediately (optimistic)", async () => {
    const callbacks = makeCallbacks();
    const item = makeItem({ quantity: 5 });
    const { result, readQty } = renderWithCache([item], callbacks);

    act(() => {
      result.current.adjustQuantity(item, -1, [item]);
    });

    // Cache reflects the new value before the request resolves (optimistic).
    await waitFor(() => expect(readQty("1")).toBe(4));
    await waitFor(() => expect(callbacks.onConsumeSuccess).toHaveBeenCalled());
  });

  it("composes rapid taps off the optimistic value (no lost decrements)", async () => {
    const callbacks = makeCallbacks();
    const item = makeItem({ quantity: 5 });
    const { result, readQty } = renderWithCache([item], callbacks);

    act(() => {
      result.current.adjustQuantity(item, -1, [item]);
      result.current.adjustQuantity(item, -1, [item]);
      result.current.adjustQuantity(item, -1, [item]);
    });

    // Three taps from 5 must land on 2, even though each was fired with the
    // same stale `item` snapshot.
    await waitFor(() => expect(readQty("1")).toBe(2));
  });

  it("never drops below zero", async () => {
    const callbacks = makeCallbacks();
    const item = makeItem({ quantity: 1 });
    const { result, readQty } = renderWithCache([item], callbacks);

    act(() => {
      result.current.adjustQuantity(item, -1, [item]);
      result.current.adjustQuantity(item, -1, [item]);
    });

    await waitFor(() => expect(readQty("1")).toBe(0));
  });

  it("rolls back the cache and reports an error when the request fails", async () => {
    server.use(
      http.patch(`${API_BASE}/api/items/:id`, () =>
        HttpResponse.json({ success: false, error: "boom" }, { status: 500 })
      )
    );
    const callbacks = makeCallbacks();
    const item = makeItem({ quantity: 5 });
    const { result, readQty } = renderWithCache([item], callbacks);

    act(() => {
      result.current.adjustQuantity(item, -1, [item]);
    });

    // After the failure the cache is rolled back to its pre-mutation value.
    await waitFor(() => expect(callbacks.onConsumeError).toHaveBeenCalled());
    await waitFor(() => expect(readQty("1")).toBe(5));
  });
});
