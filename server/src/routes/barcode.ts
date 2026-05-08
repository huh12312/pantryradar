import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { normalizeCategoryFromOff } from "../lib/openfoodfacts";
import { lookupProductChain } from "../lib/providers/chain";
import { estimateExpiration, extractBrandFromName } from "../lib/openai";

const barcode = new Hono();

// Barcode lookup requires authentication
barcode.use("*", authMiddleware);

/**
 * GET /barcode/:upc - Look up product by UPC barcode
 * Uses product_cache layer with 7-day TTL
 */
barcode.get("/:upc", async (c) => {
  try {
    const upc = c.req.param("upc");

    // Validate UPC format
    if (!upc || !/^\d+$/.test(upc)) {
      return c.json(
        {
          success: false,
          error: "Invalid UPC format. Must be numeric.",
        },
        400
      );
    }

    // Look up via provider chain: Kroger → Open Food Facts (with automatic cache layer)
    const product = await lookupProductChain(upc);

    if (!product) {
      return c.json(
        {
          success: false,
          error: "Product not found",
          upc,
        },
        404
      );
    }

    const productName = product.name || "Unknown Product";

    const normalizedCategory = normalizeCategoryFromOff(product.category ?? null);

    // Run expiration estimation and brand extraction in parallel
    const [expirationEstimate, inferredBrand] = await Promise.all([
      estimateExpiration(productName, normalizedCategory || undefined).catch((err) => {
        console.error("Error estimating expiration:", err);
        return null;
      }),
      // Only call brand extraction if OFF didn't supply one
      !product.brand
        ? extractBrandFromName(productName).catch(() => null)
        : Promise.resolve(null),
    ]);

    const result = {
      upc: product.upc,
      name: productName,
      brand: product.brand || inferredBrand || undefined,
      category: normalizedCategory ?? undefined,
      imageUrl: product.imageUrl || undefined,
      source: product.source,
      expiration: expirationEstimate?.days
        ? {
            days: expirationEstimate.days,
            label: expirationEstimate.label,
            confidence: expirationEstimate.confidence as
              | "high"
              | "medium"
              | "low",
          }
        : undefined,
    };

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error looking up barcode:", error);
    return c.json(
      {
        success: false,
        error: "Failed to look up barcode. Please try again.",
      },
      500
    );
  }
});

export default barcode;
