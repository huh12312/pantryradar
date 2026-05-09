import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { KrogerClient } from "../../../lib/providers/kroger";

const TOKEN_RESPONSE = {
  access_token: "test-token-xyz",
  token_type: "bearer",
  expires_in: 1800,
};

const makeProductResponse = (overrides?: Partial<{
  upc: string;
  description: string;
  brand: string;
  xlarge: boolean;
}>) => ({
  data: [{
    productId: "0001111041700",
    upc: overrides?.upc ?? "0001111041700",
    description: overrides?.description ?? "Kroger Whole Milk",
    brand: overrides?.brand ?? "Kroger",
    categories: ["dairy"],
    images: [{
      perspective: "front",
      sizes: [
        { size: "thumbnail", url: "https://example.com/thumb.jpg" },
        ...(overrides?.xlarge !== false ? [{ size: "xlarge", url: "https://example.com/xlarge.jpg" }] : []),
      ],
    }],
    items: [{
      price: { regular: 3.49, promo: 2.99 },
      inventory: { stockLevel: "HIGH" },
    }],
  }],
});

describe("KrogerClient", () => {
  let client: KrogerClient;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    client = new KrogerClient("test-client-id", "test-client-secret");
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("getProductByBarcode pads UPC to 13 digits in the request URL", async () => {
    let capturedUrl = "";
    global.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      capturedUrl = urlStr;
      return new Response(JSON.stringify(makeProductResponse({ upc: "0012345678901" })), { status: 200 });
    });

    await client.getProductByBarcode("12345678901");
    expect(capturedUrl).toContain("filter.term=0012345678901");
  });

  test("token is cached across multiple calls (only one auth request)", async () => {
    let tokenRequests = 0;
    global.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("oauth2/token")) {
        tokenRequests++;
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      return new Response(JSON.stringify(makeProductResponse()), { status: 200 });
    });

    await client.getProductByBarcode("012345678901");
    await client.getProductByBarcode("012345678901");
    await client.searchByName("milk");

    expect(tokenRequests).toBe(1);
  });

  test("prefers xlarge image from front perspective", async () => {
    global.fetch = mock(async (url: string | URL | Request) => {
      if (url.toString().includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      return new Response(JSON.stringify(makeProductResponse()), { status: 200 });
    });

    const result = await client.getProductByBarcode("012345678901");
    expect(result?.imageUrl).toBe("https://example.com/xlarge.jpg");
  });

  test("falls back to thumbnail if xlarge is absent", async () => {
    global.fetch = mock(async (url: string | URL | Request) => {
      if (url.toString().includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      return new Response(JSON.stringify(makeProductResponse({ xlarge: false })), { status: 200 });
    });

    const result = await client.getProductByBarcode("012345678901");
    expect(result?.imageUrl).toBe("https://example.com/thumb.jpg");
  });

  test("returns null when product not found (empty data array)", async () => {
    global.fetch = mock(async (url: string | URL | Request) => {
      if (url.toString().includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });

    const result = await client.getProductByBarcode("999999999999");
    expect(result).toBeNull();
  });

  test("returns null on API error (non-200 status)", async () => {
    global.fetch = mock(async (url: string | URL | Request) => {
      if (url.toString().includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    });

    const result = await client.getProductByBarcode("012345678901");
    expect(result).toBeNull();
  });

  test("refreshes token on 401 and retries once", async () => {
    let tokenRequests = 0;
    let productRequests = 0;
    global.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("oauth2/token")) {
        tokenRequests++;
        return new Response(JSON.stringify({ ...TOKEN_RESPONSE, access_token: `token-${tokenRequests}` }), { status: 200 });
      }
      productRequests++;
      // First product call returns 401; second succeeds
      if (productRequests === 1) {
        return new Response("Unauthorized", { status: 401 });
      }
      return new Response(JSON.stringify(makeProductResponse()), { status: 200 });
    });

    const result = await client.getProductByBarcode("012345678901");
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Kroger Whole Milk");
    expect(tokenRequests).toBe(2);
  });

  test("searchByName returns results sorted by confidence", async () => {
    global.fetch = mock(async (url: string | URL | Request) => {
      if (url.toString().includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      // Return two products: one exact match, one partial
      return new Response(JSON.stringify({
        data: [
          { productId: "a", upc: "111", description: "Kroger Milk", brand: "Kroger", categories: [], images: [], items: [] },
          { productId: "b", upc: "222", description: "Kroger Whole Milk 1 Gallon", brand: "Kroger", categories: [], images: [], items: [] },
        ],
      }), { status: 200 });
    });

    const results = await client.searchByName("Kroger Milk");
    expect(results.length).toBe(2);
    // Exact or closest match should come first (higher confidence)
    expect(results[0]!.confidence).toBeGreaterThanOrEqual(results[1]!.confidence);
  });

  test("maps product fields correctly", async () => {
    global.fetch = mock(async (url: string | URL | Request) => {
      if (url.toString().includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      return new Response(JSON.stringify(makeProductResponse()), { status: 200 });
    });

    const result = await client.getProductByBarcode("0001111041700");
    expect(result?.upc).toBe("0001111041700");
    expect(result?.name).toBe("Kroger Whole Milk");
    expect(result?.brand).toBe("Kroger");
    expect(result?.source).toBe("kroger");
    expect(result?.fetchedAt).toBeInstanceOf(Date);
  });

  test("getProductByBarcode appends filter.locationId when provided", async () => {
    let capturedUrl = "";
    global.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      capturedUrl = urlStr;
      return new Response(JSON.stringify(makeProductResponse()), { status: 200 });
    });

    await client.getProductByBarcode("012345678901", { locationId: "09700165" });
    expect(capturedUrl).toContain("filter.locationId=09700165");
  });

  test("getProductByBarcode omits filter.locationId when not provided", async () => {
    let capturedUrl = "";
    global.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      capturedUrl = urlStr;
      return new Response(JSON.stringify(makeProductResponse()), { status: 200 });
    });

    await client.getProductByBarcode("012345678901");
    expect(capturedUrl).not.toContain("filter.locationId");
  });

  test("searchByName appends filter.locationId when provided", async () => {
    let capturedUrl = "";
    global.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      capturedUrl = urlStr;
      return new Response(JSON.stringify(makeProductResponse()), { status: 200 });
    });

    await client.searchByName("milk", { locationId: "09700165" });
    expect(capturedUrl).toContain("filter.locationId=09700165");
  });

  test("searchByName includes stock when locationId is provided", async () => {
    global.fetch = mock(async (url: string | URL | Request) => {
      if (url.toString().includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      return new Response(JSON.stringify(makeProductResponse()), { status: 200 });
    });

    const results = await client.searchByName("milk", { locationId: "09700165" });
    expect(results[0]?.stock).toBe("high");
  });

  test("searchByName suppresses stock when locationId is absent", async () => {
    global.fetch = mock(async (url: string | URL | Request) => {
      if (url.toString().includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      return new Response(JSON.stringify(makeProductResponse()), { status: 200 });
    });

    const results = await client.searchByName("milk");
    expect(results[0]?.stock).toBeUndefined();
  });

  test("searchLocations returns mapped store results", async () => {
    const locationResponse = {
      data: [{
        locationId: "09700165",
        name: "Harris Teeter - Shops at Shadowline",
        chain: "HART",
        address: {
          addressLine1: "240 Shadowline Dr",
          city: "Boone",
          state: "NC",
          zipCode: "28607",
        },
      }],
    };

    global.fetch = mock(async (url: string | URL | Request) => {
      if (url.toString().includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      return new Response(JSON.stringify(locationResponse), { status: 200 });
    });

    const results = await client.searchLocations("28607");
    expect(results).toHaveLength(1);
    expect(results[0]?.locationId).toBe("09700165");
    expect(results[0]?.name).toBe("Harris Teeter - Shops at Shadowline");
    expect(results[0]?.chain).toBe("HART");
    expect(results[0]?.city).toBe("Boone");
    expect(results[0]?.state).toBe("NC");
  });

  test("searchLocations includes zip in request URL", async () => {
    let capturedUrl = "";
    global.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      capturedUrl = urlStr;
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });

    await client.searchLocations("28607");
    expect(capturedUrl).toContain("filter.zipCode.near=28607");
    expect(capturedUrl).toContain("filter.radiusInMiles=15");
  });

  test("searchLocations returns empty array on API error", async () => {
    global.fetch = mock(async (url: string | URL | Request) => {
      if (url.toString().includes("oauth2/token")) {
        return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
      }
      return new Response("Internal Server Error", { status: 500 });
    });

    const results = await client.searchLocations("28607");
    expect(results).toHaveLength(0);
  });
});
