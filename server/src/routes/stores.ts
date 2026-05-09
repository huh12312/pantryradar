import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { krogerClient } from "../lib/providers/kroger";
import type { StoreResult } from "../lib/providers/kroger";

const stores = new Hono();

stores.use("*", authMiddleware);

// 1-hour in-memory cache per zip — location data changes rarely
const locationCache = new Map<string, { results: StoreResult[]; expiresAt: number }>();
const LOCATION_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * GET /stores/search?zip=28607
 * Returns Kroger-family stores near the given zip code.
 * Includes Harris Teeter, Kroger, Fred Meyer, and all other banners.
 */
stores.get("/search", async (c) => {
  const zip = (c.req.query("zip") ?? "").trim();

  if (!/^\d{5}$/.test(zip)) {
    return c.json({ success: false, error: "zip must be a 5-digit US zip code" }, 400);
  }

  if (!krogerClient) {
    return c.json({ success: false, error: "Kroger integration not configured" }, 503);
  }

  const cached = locationCache.get(zip);
  if (cached && Date.now() < cached.expiresAt) {
    return c.json({ success: true, data: cached.results });
  }

  try {
    const results = await krogerClient.searchLocations(zip);
    locationCache.set(zip, { results, expiresAt: Date.now() + LOCATION_CACHE_TTL_MS });
    return c.json({ success: true, data: results });
  } catch (error) {
    console.error("Store search error:", error);
    return c.json({ success: false, error: "Store search failed. Please try again." }, 500);
  }
});

export default stores;
