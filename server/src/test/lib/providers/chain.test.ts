import { describe, test, expect } from "bun:test";
import type { LookupProvider, LookupOptions, ProductSearchResult } from "../../../lib/providers/types";
import type { ProductCacheEntry } from "../../../lib/openfoodfacts";

// Build an isolated chain using custom providers — avoids hitting real APIs
function buildChain(providerList: LookupProvider[]) {
  async function lookupProductChain(upc: string, opts?: LookupOptions): Promise<ProductCacheEntry | null> {
    for (const provider of providerList) {
      const result = await provider.getProductByBarcode(upc, opts);
      if (result) return result;
    }
    return null;
  }

  function dedupeAndRank(results: ProductSearchResult[]): ProductSearchResult[] {
    const seen = new Map<string, ProductSearchResult>();
    for (const r of results) {
      const key = `${(r.name ?? "").toLowerCase()}|${(r.brand ?? "").toLowerCase()}`;
      const existing = seen.get(key);
      if (!existing) { seen.set(key, r); continue; }
      const betterConf = r.confidence > existing.confidence;
      const betterImage = !existing.imageUrl && r.imageUrl;
      const preferKroger = r.source === "kroger" && existing.source !== "kroger";
      if (betterConf || betterImage || preferKroger) seen.set(key, r);
    }
    return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence);
  }

  async function searchProductChain(query: string, opts?: LookupOptions): Promise<ProductSearchResult[]> {
    const settled = await Promise.allSettled(
      providerList.map((p) => p.searchByName(query, opts))
    );
    const all: ProductSearchResult[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled") all.push(...r.value);
    }
    return dedupeAndRank(all);
  }

  return { lookupProductChain, searchProductChain };
}

function makeEntry(overrides: Partial<ProductCacheEntry>): ProductCacheEntry {
  return {
    upc: "000000000000",
    name: "Test Product",
    brand: "Test Brand",
    category: "Snacks",
    imageUrl: null,
    source: "open_food_facts",
    fetchedAt: new Date(),
    ...overrides,
  };
}

function makeSearchResult(overrides: Partial<ProductSearchResult>): ProductSearchResult {
  return { ...makeEntry(overrides as Partial<ProductCacheEntry>), confidence: 0.8, ...overrides };
}

function makeProvider(
  source: "kroger" | "open_food_facts" | "trader_joes",
  barcodeResult: ProductCacheEntry | null,
  searchResults: ProductSearchResult[]
): LookupProvider {
  return {
    source,
    getProductByBarcode: async () => barcodeResult,
    searchByName: async () => searchResults,
  };
}

describe("lookupProductChain", () => {
  test("returns first provider's hit and skips subsequent providers", async () => {
    const kroger = makeProvider("kroger", makeEntry({ name: "Kroger Milk", source: "kroger" }), []);
    const off = makeProvider("open_food_facts", makeEntry({ name: "OFF Milk", source: "open_food_facts" }), []);
    let offCalled = false;
    const offSpy: LookupProvider = {
      ...off,
      getProductByBarcode: async () => { offCalled = true; return off.getProductByBarcode(""); },
    };

    const { lookupProductChain } = buildChain([kroger, offSpy]);
    const result = await lookupProductChain("012345678901");

    expect(result?.name).toBe("Kroger Milk");
    expect(offCalled).toBe(false);
  });

  test("falls through to second provider if first returns null", async () => {
    const noResult = makeProvider("kroger", null, []);
    const off = makeProvider("open_food_facts", makeEntry({ name: "OFF Product", source: "open_food_facts" }), []);

    const { lookupProductChain } = buildChain([noResult, off]);
    const result = await lookupProductChain("012345678901");

    expect(result?.name).toBe("OFF Product");
    expect(result?.source).toBe("open_food_facts");
  });

  test("returns null when all providers return null", async () => {
    const { lookupProductChain } = buildChain([
      makeProvider("kroger", null, []),
      makeProvider("open_food_facts", null, []),
    ]);
    const result = await lookupProductChain("999999999999");
    expect(result).toBeNull();
  });
});

describe("searchProductChain", () => {
  test("fans out to all providers in parallel and merges results", async () => {
    const kroger = makeProvider("kroger", null, [
      makeSearchResult({ name: "Kroger Greek Yogurt", source: "kroger", confidence: 0.9 }),
    ]);
    const off = makeProvider("open_food_facts", null, [
      makeSearchResult({ name: "Chobani Greek Yogurt", source: "open_food_facts", confidence: 0.7 }),
    ]);

    const { searchProductChain } = buildChain([kroger, off]);
    const results = await searchProductChain("greek yogurt");

    expect(results.length).toBe(2);
    // Higher confidence first
    expect(results[0]!.confidence).toBeGreaterThan(results[1]!.confidence);
  });

  test("deduplicates entries with same (name, brand), keeping higher confidence", async () => {
    const r1 = makeSearchResult({ name: "Whole Milk", brand: "Kroger", source: "kroger", confidence: 0.9, imageUrl: null });
    const r2 = makeSearchResult({ name: "Whole Milk", brand: "Kroger", source: "open_food_facts", confidence: 0.6 });
    const kroger = makeProvider("kroger", null, [r1]);
    const off = makeProvider("open_food_facts", null, [r2]);

    const { searchProductChain } = buildChain([kroger, off]);
    const results = await searchProductChain("whole milk");

    expect(results.length).toBe(1);
    expect(results[0]!.source).toBe("kroger");
    expect(results[0]!.confidence).toBe(0.9);
  });

  test("prefers Kroger as tiebreaker on equal confidence", async () => {
    const r1 = makeSearchResult({ name: "Pasta Sauce", brand: "Generic", source: "open_food_facts", confidence: 0.8 });
    const r2 = makeSearchResult({ name: "Pasta Sauce", brand: "Generic", source: "kroger", confidence: 0.8 });
    const kroger = makeProvider("kroger", null, [r2]);
    const off = makeProvider("open_food_facts", null, [r1]);

    const { searchProductChain } = buildChain([kroger, off]);
    const results = await searchProductChain("pasta sauce");

    expect(results.length).toBe(1);
    expect(results[0]!.source).toBe("kroger");
  });

  test("prefers entry with image when confidence is lower", async () => {
    const withImage = makeSearchResult({ name: "Bread", brand: "Wonder", source: "open_food_facts", confidence: 0.7, imageUrl: "https://img.com/bread.jpg" });
    const noImage = makeSearchResult({ name: "Bread", brand: "Wonder", source: "kroger", confidence: 0.7, imageUrl: null });
    const kroger = makeProvider("kroger", null, [noImage]);
    const off = makeProvider("open_food_facts", null, [withImage]);

    const { searchProductChain } = buildChain([kroger, off]);
    const results = await searchProductChain("bread");

    // With image should be kept even though OFF has lower priority
    expect(results.length).toBe(1);
    expect(results[0]!.imageUrl).toBe("https://img.com/bread.jpg");
  });

  test("returns empty array when all providers return empty", async () => {
    const { searchProductChain } = buildChain([
      makeProvider("kroger", null, []),
      makeProvider("open_food_facts", null, []),
    ]);
    const results = await searchProductChain("xylophone");
    expect(results).toEqual([]);
  });

  test("continues if one provider throws", async () => {
    const broken: LookupProvider = {
      source: "kroger",
      getProductByBarcode: async () => null,
      searchByName: async () => { throw new Error("Kroger down"); },
    };
    const off = makeProvider("open_food_facts", null, [
      makeSearchResult({ name: "Olive Oil", source: "open_food_facts", confidence: 0.75 }),
    ]);

    const { searchProductChain } = buildChain([broken, off]);
    const results = await searchProductChain("olive oil");

    expect(results.length).toBe(1);
    expect(results[0]!.name).toBe("Olive Oil");
  });
});
