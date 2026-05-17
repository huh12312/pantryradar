import { z } from "zod";
import { _deps, getModel, getVisionModel } from "./llm";

export interface ExpirationEstimate {
  days: number;
  label: string;
  confidence: "high" | "medium" | "low";
}

const ReceiptLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().nullable(),
  confidence: z.number().min(0).max(1),
});

const ReceiptParseResultSchema = z.object({
  storeName: z.string().nullable(),
  lineItems: z.array(ReceiptLineItemSchema),
  total: z.number().nullable(),
});

export type ReceiptParseResult = z.infer<typeof ReceiptParseResultSchema>;

const ExpirationEstimateSchema = z.object({
  days: z.number().int().positive(),
  label: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

const BrandExtractionSchema = z.object({
  brand: z.string().nullable(),
});

const NormalizationSchema = z.object({
  normalized: z.string(),
});

// In-memory caches with 24h TTL
const expirationCache = new Map<string, { estimate: ExpirationEstimate; expiresAt: number }>();
const brandCache = new Map<string, { brand: string | null; expiresAt: number }>();
const normalizeCache = new Map<string, { normalized: string; expiresAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export async function parseReceiptImage(imageBase64: string): Promise<ReceiptParseResult> {
  const { object } = await _deps.generateObject({
    model: getVisionModel(),
    schema: ReceiptParseResultSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: Buffer.from(imageBase64, "base64") },
          {
            type: "text",
            text: `Parse this grocery receipt. Extract:
- storeName: store/vendor name (null if not visible)
- lineItems: purchased products only (exclude tax lines, subtotals, fees, discounts):
  - description: full human-readable name — decode all abbreviations (e.g. "GV MLK HLF GL" → "Great Value Milk Half Gallon")
  - quantity: number purchased (default 1)
  - price: unit price as number (null if not visible)
  - confidence: 0–1 score for how confident you are in the decoded name
- total: receipt grand total as number (null if not visible)`,
          },
        ],
      },
    ],
  });
  return object as ReceiptParseResult;
}

export async function estimateExpiration(
  productName: string,
  category?: string
): Promise<ExpirationEstimate> {
  const cacheKey = `${productName}|${category ?? ""}`;
  const cached = expirationCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.estimate;

  try {
    const { object } = await _deps.generateObject({
      model: getModel(),
      schema: ExpirationEstimateSchema,
      system: "You are a food safety expert. Estimate typical shelf life for grocery products.",
      messages: [
        {
          role: "user",
          content: `Estimate the typical shelf life for this grocery product from purchase date:
Product: ${productName}
${category ? `Category: ${category}` : ""}

Provide:
- days: Number of days until expiration (from purchase date)
- label: Human-readable label (e.g., "~1 week", "~2 months", "~1 year")
- confidence: "high", "medium", or "low"`,
        },
      ],
    });

    const estimate = object as ExpirationEstimate;
    expirationCache.set(cacheKey, { estimate, expiresAt: Date.now() + CACHE_TTL });
    return estimate;
  } catch (error) {
    console.error("Error estimating expiration:", error);
    return { days: 7, label: "~1 week", confidence: "low" };
  }
}

export function clearExpirationCache(): void {
  expirationCache.clear();
}

export async function extractBrandFromName(productName: string): Promise<string | null> {
  const cached = brandCache.get(productName);
  if (cached && Date.now() < cached.expiresAt) return cached.brand;

  try {
    const { object } = await _deps.generateObject({
      model: getModel(),
      schema: BrandExtractionSchema,
      system:
        "You are a grocery product expert. Extract the brand name from a product name if one is present. Return null if no distinct brand is present (e.g. generic items like 'Salt' or 'White Rice').",
      messages: [
        {
          role: "user",
          content: `Product name: "${productName}"\n\nWhat is the brand name, if any?`,
        },
      ],
    });

    const brand = (object as { brand: string | null }).brand ?? null;
    brandCache.set(productName, { brand, expiresAt: Date.now() + CACHE_TTL });
    return brand;
  } catch (error) {
    console.error("Error extracting brand from product name:", error);
    return null;
  }
}

/**
 * Normalizes a raw item name to its simplest form for image/category lookup.
 * Strips brand names, sizes, adjectives, and modifiers.
 * e.g. "Granny Smith Apples organic 3lb bag" → "apple"
 * Cached 24h; falls back to the original name on LLM error.
 */
export async function normalizeItemName(name: string): Promise<string> {
  const cached = normalizeCache.get(name);
  if (cached && Date.now() < cached.expiresAt) return cached.normalized;

  try {
    const { object } = await _deps.generateObject({
      model: getModel(),
      schema: NormalizationSchema,
      system:
        "You normalize grocery item names for image search. Return only the core food name in lowercase singular form — no brand, no size, no adjectives.",
      messages: [
        {
          role: "user",
          content: `Examples:
- "Granny Smith Apples organic 3lb bag" → "apple"
- "Heinz Original Ketchup 24oz" → "ketchup"
- "Wild Alaskan Salmon fillet frozen" → "salmon"
- "Kirkland Signature Extra Virgin Olive Oil" → "olive oil"
- "T-bone steak USDA choice" → "steak"
- "Blue Diamond Almond Breeze Unsweetened" → "almond milk"

Item: "${name}"`,
        },
      ],
    });

    const normalized = (object as { normalized: string }).normalized || name;
    normalizeCache.set(name, { normalized, expiresAt: Date.now() + CACHE_TTL });
    return normalized;
  } catch {
    return name;
  }
}

export interface ItemSuggestion {
  unit: string;
  category: string;
  estimatedShelfDays: number;
}

const SuggestionSchema = z.object({
  unit: z.string(),
  category: z.string(),
  estimatedShelfDays: z.number().int().positive(),
});

const suggestionCache = new Map<string, { suggestion: ItemSuggestion; expiresAt: number }>();

export async function suggestItemDefaults(name: string): Promise<ItemSuggestion> {
  const key = name.toLowerCase().trim();
  const cached = suggestionCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.suggestion;

  try {
    const { object } = await _deps.generateObject({
      model: getModel(),
      schema: SuggestionSchema,
      system:
        "You are a grocery expert. Given a food item name, suggest the most common unit of measure, food category, and typical shelf life in days from purchase.",
      messages: [
        {
          role: "user",
          content: `Item: "${name}"

Valid categories: Dairy, Meat & Poultry, Seafood, Produce, Bread & Bakery, Breakfast & Cereal, Grains & Pasta, Baking, Canned Goods, Condiments & Sauces, Oils & Vinegars, Snacks, Beverages, Frozen Foods, Spices & Seasonings, Other

Provide:
- unit: most common unit (e.g. "lb", "oz", "unit", "bunch")
- category: one of the valid categories above
- estimatedShelfDays: typical days until expiry from purchase`,
        },
      ],
    });

    const suggestion = object as ItemSuggestion;
    suggestionCache.set(key, { suggestion, expiresAt: Date.now() + CACHE_TTL });
    return suggestion;
  } catch (error) {
    console.error("Error suggesting item defaults:", error);
    return { unit: "unit", category: "Other", estimatedShelfDays: 7 };
  }
}
