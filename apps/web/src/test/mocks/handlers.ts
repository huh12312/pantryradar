import { http, HttpResponse } from "msw";

// Vitest jsdom defaults to http://localhost:3000. fetchApi uses relative paths
// which resolve against the test origin, so handlers must match that base.
const API_BASE = "http://localhost:3000";

type ItemBody = {
  name?: string;
  brand?: string;
  category?: string;
  location?: string;
  quantity?: number;
  unit?: string;
  barcodeUpc?: string;
  expirationDate?: string | null;
  notes?: string | null;
};

type HouseholdBody = {
  name?: string;
};

type AuthBody = {
  email?: string;
  password?: string;
  name?: string;
};

export const handlers = [
  // Items endpoints
  http.get(`${API_BASE}/api/items`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        items: [
          {
            id: "1",
            householdId: "household-1",
            name: "Milk",
            brand: "Great Value",
            category: "Dairy",
            location: "fridge",
            quantity: 1,
            unit: "gallon",
            barcodeUpc: "041220000000",
            expirationDate: "2024-12-31",
            expirationEstimated: false,
            addedBy: "user-1",
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            notes: null,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      },
    });
  }),

  http.get(`${API_BASE}/api/items/:id`, ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      success: true,
      data: {
        id,
        householdId: "household-1",
        name: "Milk",
        brand: "Great Value",
        category: "Dairy",
        location: "fridge",
        quantity: 1,
        unit: "gallon",
        barcodeUpc: "041220000000",
        expirationDate: "2024-12-31",
        expirationEstimated: false,
        addedBy: "user-1",
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: null,
      },
    });
  }),

  http.post(`${API_BASE}/api/items`, async ({ request }) => {
    const body = (await request.json()) as ItemBody;
    return HttpResponse.json(
      {
        success: true,
        data: {
          id: "new-item-id",
          householdId: "household-1",
          ...body,
          expirationEstimated: false,
          addedBy: "user-1",
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  }),

  http.patch(`${API_BASE}/api/items/:id`, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as ItemBody;
    return HttpResponse.json({
      success: true,
      data: {
        id,
        householdId: "household-1",
        name: "Milk",
        brand: "Great Value",
        category: "Dairy",
        location: "fridge",
        quantity: 1,
        unit: "gallon",
        ...body,
        expirationEstimated: false,
        addedBy: "user-1",
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }),

  http.delete(`${API_BASE}/api/items/:id`, () => {
    return HttpResponse.json({ success: true, data: null });
  }),

  // Households endpoints
  http.post(`${API_BASE}/api/households`, async ({ request }) => {
    const body = (await request.json()) as HouseholdBody;
    return HttpResponse.json(
      {
        success: true,
        data: {
          id: "new-household-id",
          name: body.name,
          inviteCode: "ABC12345",
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  }),

  http.get(`${API_BASE}/api/households/me`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: "household-1",
        name: "Smith Family",
        inviteCode: "ABC12345",
        createdAt: new Date().toISOString(),
      },
    });
  }),

  http.post(`${API_BASE}/api/households/join`, async ({ request }) => {
    const body = (await request.json()) as { inviteCode?: string };
    if (body.inviteCode === "ABC12345") {
      return HttpResponse.json({
        success: true,
        data: {
          id: "household-1",
          name: "Smith Family",
          inviteCode: "ABC12345",
          createdAt: new Date().toISOString(),
        },
      });
    }
    return HttpResponse.json(
      { success: false, error: "Invalid invite code" },
      { status: 403 }
    );
  }),

  // Barcode endpoints
  http.get(`${API_BASE}/api/barcode/:barcode`, ({ params }) => {
    const { barcode } = params;
    if (barcode === "999999999999") {
      return HttpResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      success: true,
      data: {
        name: "Coca-Cola Classic",
        brand: "Coca-Cola",
        category: "Beverages",
        imageUrl: "https://example.com/coke.jpg",
      },
    });
  }),

  // Receipt endpoints
  http.post(`${API_BASE}/api/receipt`, async () => {
    return HttpResponse.json({
      success: true,
      data: {
        storeName: "Walmart",
        lineItems: [
          {
            raw: "GV MLK HLF GL",
            decoded: "Great Value Milk Half Gallon",
            confidence: 0.95,
            quantity: 1,
            price: 3.99,
          },
          {
            raw: "BNNNS ORGNIC",
            decoded: "Organic Bananas",
            confidence: 0.88,
            quantity: 1,
            price: 2.49,
          },
        ],
        total: 6.48,
      },
    });
  }),

  // Auth endpoints (Better Auth)
  http.post(`${API_BASE}/api/auth/sign-in/email`, async () => {
    return HttpResponse.json({
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
      },
      token: "mock-jwt-token",
    });
  }),

  http.post(`${API_BASE}/api/auth/sign-up/email`, async ({ request }) => {
    const body = (await request.json()) as AuthBody;
    return HttpResponse.json(
      {
        user: {
          id: "new-user-id",
          email: body.email,
          name: body.name,
        },
        token: "mock-jwt-token",
      },
      { status: 201 }
    );
  }),

  http.get(`${API_BASE}/api/auth/session`, () => {
    return HttpResponse.json({
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
      },
    });
  }),

  http.post(`${API_BASE}/api/auth/sign-out`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Config
  http.get(`${API_BASE}/api/config`, () => {
    return HttpResponse.json({ signupEnabled: true });
  }),
];
