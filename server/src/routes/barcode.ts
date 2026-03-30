import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { openFoodFactsClient } from "../lib/openfoodfacts";
import { estimateExpiration } from "../lib/openai";

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

    // Look up in Open Food Facts (with automatic cache layer)
    const product = await openFoodFactsClient.getProductByBarcode(upc);

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

    // Estimate expiration date
    let expirationEstimate: {
      days?: number;
      label?: string;
      confidence?: string;
    } = {};
    try {
      const estimate = await estimateExpiration(
        product.name || "Unknown",
        product.category || undefined
      );
      expirationEstimate = {
        days: estimate.days,
        label: estimate.label,
        confidence: estimate.confidence,
      };
    } catch (error) {
      console.error("Error estimating expiration:", error);
      // Continue without expiration estimate
    }

    const result = {
      upc: product.upc,
      name: product.name || "Unknown Product",
      brand: product.brand || undefined,
      category: product.category || undefined,
      imageUrl: product.imageUrl || undefined,
      expiration: expirationEstimate.days
        ? {
            days: expirationEstimate.days,
            label: expirationEstimate.label!,
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
