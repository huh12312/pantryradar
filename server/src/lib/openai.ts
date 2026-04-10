/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

export const openai: OpenAI = new OpenAI({
  apiKey,
});

/**
 * Types for OpenAI responses
 */
export interface DecodedItem {
  raw: string;
  decoded: string;
  confidence: number;
}

export interface ExpirationEstimate {
  days: number;
  label: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Zod schemas for structured output
 */
const DecodedItemSchema = z.object({
  raw: z.string(),
  decoded: z.string(),
  confidence: z.number().min(0).max(1),
});

const DecodeResultSchema = z.object({
  items: z.array(DecodedItemSchema),
});

const ExpirationEstimateSchema = z.object({
  days: z.number().int().positive(),
  label: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

/**
 * In-memory cache for expiration estimates (24h TTL)
 */
const expirationCache = new Map<
  string,
  { estimate: ExpirationEstimate; expiresAt: number }
>();

/**
 * Decode receipt line items using OpenAI with structured output
 * Uses gpt-4o-mini by default, falls back to gpt-4o-mini for low-confidence items
 */
export async function decodeReceiptItems(
  lineItems: Array<{ description: string; qty?: number; price?: number }>,
  storeName?: string
): Promise<DecodedItem[]> {
  const prompt = `You are decoding grocery store receipt abbreviations. For each item, provide the decoded full name and a confidence score 0-1. Be conservative — if unsure, confidence < 0.7.

${storeName ? `Store: ${storeName}\n` : ""}
Items to decode:
${lineItems.map((item, i) => `${i + 1}. ${item.description}`).join("\n")}`;

  try {
    // First pass with gpt-4o-mini
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a grocery receipt decoder. Decode abbreviated product names into full, human-readable names.",
        },
        { role: "user", content: prompt },
      ],
      response_format: zodResponseFormat(DecodeResultSchema, "decode_result"),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const result = DecodeResultSchema.parse(JSON.parse(content));
    const decoded = result.items;

    // Check for low-confidence items (< 0.7)
    const lowConfidenceIndices = decoded
      .map((item, i) => (item.confidence < 0.7 ? i : -1))
      .filter((i) => i !== -1);

    // If we have low-confidence items, retry those with gpt-4o-mini (same model, but different prompt)
    if (lowConfidenceIndices.length > 0) {
      const lowConfidenceItems = lowConfidenceIndices.map((i) => lineItems[i]!);
      const retryPrompt = `You are decoding grocery store receipt abbreviations. These items had low confidence in the first pass. Please try again with more context.

${storeName ? `Store: ${storeName}\n` : ""}
Items to decode:
${lowConfidenceItems.map((item, i) => `${i + 1}. ${item.description}`).join("\n")}

Provide the most likely full product name, even if you're not 100% certain.`;

      const retryResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a grocery receipt decoder. Decode abbreviated product names into full, human-readable names. Make your best guess even with limited information.",
          },
          { role: "user", content: retryPrompt },
        ],
        response_format: zodResponseFormat(
          DecodeResultSchema,
          "decode_result_retry"
        ),
      });

      const retryContent = retryResponse.choices[0]?.message?.content;
      if (retryContent) {
        const retryResult = DecodeResultSchema.parse(JSON.parse(retryContent));

        // Merge retry results back into original array
        lowConfidenceIndices.forEach((originalIndex, retryIndex) => {
          const retryItem = retryResult.items[retryIndex];
          if (retryItem) {
            decoded[originalIndex] = retryItem;
          }
        });
      }
    }

    return decoded;
  } catch (error) {
    console.error("Error decoding receipt items:", error);
    // Fallback: return raw descriptions with low confidence
    return lineItems.map((item) => ({
      raw: item.description,
      decoded: item.description,
      confidence: 0.3,
    }));
  }
}

/**
 * Estimate expiration date for a product
 * Results are cached in memory for 24h
 */
export async function estimateExpiration(
  productName: string,
  category?: string
): Promise<ExpirationEstimate> {
  // Check cache first
  const cacheKey = `${productName}|${category || ""}`;
  const cached = expirationCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.estimate;
  }

  const prompt = `Estimate the typical shelf life for this grocery product from purchase date:
Product: ${productName}
${category ? `Category: ${category}` : ""}

Provide:
- days: Number of days until expiration (from purchase date)
- label: Human-readable label (e.g., "~1 week", "~2 months", "~1 year")
- confidence: "high", "medium", or "low" based on how standard this product's shelf life is

Examples:
- Fresh milk: 7 days, "~1 week", "high"
- Canned beans: 730 days, "~2 years", "high"
- Fresh berries: 3 days, "~3 days", "high"
- Bread: 5 days, "~5 days", "medium"`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a food safety expert. Estimate typical shelf life for grocery products.",
        },
        { role: "user", content: prompt },
      ],
      response_format: zodResponseFormat(
        ExpirationEstimateSchema,
        "expiration_estimate"
      ),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const estimate = ExpirationEstimateSchema.parse(JSON.parse(content));

    // Cache for 24 hours
    expirationCache.set(cacheKey, {
      estimate,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    return estimate;
  } catch (error) {
    console.error("Error estimating expiration:", error);
    // Conservative fallback
    return {
      days: 7,
      label: "~1 week",
      confidence: "low",
    };
  }
}

/**
 * Clear expiration cache (for testing)
 */
export function clearExpirationCache(): void {
  expirationCache.clear();
}

/**
 * Extract brand name from a product name when not provided by Open Food Facts.
 * e.g. "Doritos Chips" → "Doritos", "Pringles Cheddar" → "Pringles"
 * Returns null if the name doesn't contain a recognizable brand.
 * Results cached in memory for 24h.
 */
const brandCache = new Map<string, { brand: string | null; expiresAt: number }>();

const BrandExtractionSchema = z.object({
  brand: z.string().nullable(),
});

export async function extractBrandFromName(productName: string): Promise<string | null> {
  const cached = brandCache.get(productName);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.brand;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a grocery product expert. Extract the brand name from a product name if one is present. Return null if the product name contains no distinct brand (e.g. generic items like 'Salt' or 'White Rice').",
        },
        {
          role: "user",
          content: `Product name: "${productName}"\n\nWhat is the brand name, if any?`,
        },
      ],
      response_format: zodResponseFormat(BrandExtractionSchema, "brand_extraction"),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const result = BrandExtractionSchema.parse(JSON.parse(content));
    const brand = result.brand ?? null;

    brandCache.set(productName, {
      brand,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    return brand;
  } catch (error) {
    console.error("Error extracting brand from product name:", error);
    return null;
  }
}
