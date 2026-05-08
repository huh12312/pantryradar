import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/ratelimit";
import { searchProductChain } from "../lib/providers/chain";
import type { ProductSearchResult } from "../lib/providers/types";

const products = new Hono();

products.use("*", authMiddleware);
products.use(
  "*",
  rateLimitMiddleware({
    limit: process.env.NODE_ENV === "production" ? 30 : 1000,
    windowMs: 60 * 1000,
  })
);

// 5-minute in-memory cache — protects Kroger's 10k/day quota from typeahead bursts
const searchCache = new Map<string, { results: ProductSearchResult[]; expiresAt: number }>();
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_MAX = 500;

function getCached(key: string): ProductSearchResult[] | null {
  const entry = searchCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.results;
}

function setCached(key: string, results: ProductSearchResult[]): void {
  if (searchCache.size >= SEARCH_CACHE_MAX) {
    const first = searchCache.keys().next().value;
    if (first) searchCache.delete(first);
  }
  searchCache.set(key, { results, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
}

/**
 * GET /products/search?q=&limit=
 * Fan-out search across all configured providers (Kroger, Open Food Facts).
 * Returns merged, deduplicated, confidence-ranked results.
 * Expiration estimation is intentionally skipped here — trigger /barcode/:upc on selection.
 */
products.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  const limitParam = parseInt(c.req.query("limit") ?? "10", 10);
  const limit = isNaN(limitParam) || limitParam < 1 ? 10 : Math.min(limitParam, 10);

  if (q.length < 2) {
    return c.json(
      { success: false, error: "Query must be at least 2 characters" },
      400
    );
  }

  const cacheKey = `${q.toLowerCase()}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return c.json({ success: true, data: cached });
  }

  try {
    const results = await searchProductChain(q, { limit });
    setCached(cacheKey, results);
    return c.json({ success: true, data: results });
  } catch (error) {
    console.error("Product search error:", error);
    return c.json({ success: false, error: "Search failed. Please try again." }, 500);
  }
});

export default products;
