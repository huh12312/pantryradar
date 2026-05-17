import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { useAuth } from "@/lib/auth";
import { useHouseStore } from "@/lib/houseStore";
import type { InventoryItem } from "@/lib/api";
import InventoryPage from "@/pages/InventoryPage";

const API_BASE = "http://localhost:3000";

const mockUser = { id: "user-1", email: "test@example.com", name: "Test User" };

const mockItems: InventoryItem[] = [
  {
    id: "item-pantry",
    name: "Pasta",
    brand: null,
    quantity: 2,
    unit: "box",
    location: "pantry",
    category: "Grains & Cereals",
    expirationDate: null,
    expirationEstimated: false,
    barcodeUpc: null,
    imageUrl: null,
    notes: null,
    opened: false,
    householdId: "household-1",
    addedBy: "user-1",
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "item-fridge",
    name: "Milk",
    brand: "Organic Valley",
    quantity: 1,
    unit: "gallon",
    location: "fridge",
    category: "Dairy",
    expirationDate: null,
    expirationEstimated: false,
    barcodeUpc: null,
    imageUrl: null,
    notes: null,
    opened: false,
    householdId: "household-1",
    addedBy: "user-1",
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "item-freezer",
    name: "Ice Cream",
    brand: null,
    quantity: 1,
    unit: "tub",
    location: "freezer",
    category: "Frozen",
    expirationDate: null,
    expirationEstimated: false,
    barcodeUpc: null,
    imageUrl: null,
    notes: null,
    opened: false,
    householdId: "household-1",
    addedBy: "user-1",
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderInventoryPage() {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/inventory"]}>
        <ThemeProvider>
          <InventoryPage />
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("InventoryPage", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.setState({ user: mockUser, isAuthenticated: true });
    useHouseStore.setState({ selectedHouseId: null });
  });

  it("shows loading state initially and then renders inventory sections", async () => {
    server.use(
      http.get(`${API_BASE}/api/items`, async () => {
        return HttpResponse.json({
          success: true,
          data: { items: mockItems, total: 3, page: 1, pageSize: 50 },
        });
      }),
    );

    renderInventoryPage();

    // Loading spinner should appear initially
    expect(screen.getByText(/loading your inventory/i)).toBeInTheDocument();

    // After data loads, the three sections should be visible
    await waitFor(() => {
      expect(screen.getByTestId("section-pantry")).toBeInTheDocument();
    });
    expect(screen.getByTestId("section-fridge")).toBeInTheDocument();
    expect(screen.getByTestId("section-freezer")).toBeInTheDocument();
  });

  it("shows error banner when delete mutation fails", async () => {
    server.use(
      http.get(`${API_BASE}/api/items`, () => {
        return HttpResponse.json({
          success: true,
          data: { items: mockItems, total: 3, page: 1, pageSize: 50 },
        });
      }),
      http.delete(`${API_BASE}/api/items/:id`, () => {
        return HttpResponse.json(
          { success: false, error: "Failed to delete item." },
          { status: 500 },
        );
      }),
    );

    const user = userEvent.setup();
    renderInventoryPage();

    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByTestId("section-fridge")).toBeInTheDocument();
    });

    // Click delete on Milk (fridge item)
    const deleteButton = screen.getByRole("button", { name: /delete milk/i });
    await user.click(deleteButton);

    // Error banner should appear
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("opens re-order dialog when last unit of an item is consumed", async () => {
    const singleUnitItem: InventoryItem = {
      ...mockItems[1]!, // Milk, quantity 1
      id: "item-milk-1",
      quantity: 1,
    };

    server.use(
      http.get(`${API_BASE}/api/items`, () =>
        HttpResponse.json({
          success: true,
          data: { items: [singleUnitItem], total: 1, page: 1, pageSize: 50 },
        }),
      ),
      http.patch(`${API_BASE}/api/items/:id`, () =>
        HttpResponse.json({
          success: true,
          data: { ...singleUnitItem, quantity: 0 },
        }),
      ),
    );

    const user = userEvent.setup();
    renderInventoryPage();

    await waitFor(() => {
      expect(screen.getByTestId("section-fridge")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /consume one/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByText(/you're out of/i)).toBeInTheDocument();
  });
});
