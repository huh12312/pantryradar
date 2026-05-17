import type { ProductCacheEntry } from "../openfoodfacts";
import type { LookupProvider, LookupOptions, ProductSearchResult } from "./types";
import { krogerClient } from "./kroger";
import { openFoodFactsProvider } from "./openFoodFacts";

function buildProviders(): LookupProvider[] {
  const list: LookupProvider[] = [];
  if (krogerClient) list.push(krogerClient);
  list.push(openFoodFactsProvider);
  return list;
}

// Singleton list — Kroger client is only available when env vars are set
const providers = buildProviders();

/**
 * Try each provider in order, returning the first hit.
 * Used for UPC barcode lookup.
 */
export async function lookupProductChain(
  upc: string,
  opts?: LookupOptions
): Promise<ProductCacheEntry | null> {
  for (const provider of providers) {
    try {
      const result = await provider.getProductByBarcode(upc, opts);
      if (result) return result;
    } catch (err) {
      console.error(`Provider ${provider.source} barcode lookup failed:`, err);
    }
  }
  return null;
}

function dedupeAndRank(results: ProductSearchResult[]): ProductSearchResult[] {
  const seen = new Map<string, ProductSearchResult>();

  for (const r of results) {
    const key = `${(r.name ?? "").toLowerCase()}|${(r.brand ?? "").toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, r);
      continue;
    }
    // Keep whichever entry is richer: higher confidence > has image > Kroger source
    const betterConf = r.confidence > existing.confidence;
    const betterImage = !existing.imageUrl && r.imageUrl;
    const preferKroger = r.source === "kroger" && existing.source !== "kroger";
    if (betterConf || betterImage || preferKroger) {
      seen.set(key, r);
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence);
}

/**
 * Fan out to all providers in parallel, merge and rank results.
 * Used for free-text product search (name-based, no UPC).
 */
export async function searchProductChain(
  query: string,
  opts?: LookupOptions
): Promise<ProductSearchResult[]> {
  const settled = await Promise.allSettled(providers.map((p) => p.searchByName(query, opts)));

  const all: ProductSearchResult[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  return dedupeAndRank(all);
}

// Exported for testing
export { providers };
