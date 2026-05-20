import { z } from "zod";
import { _deps, getModel, getVisionModel } from "./llm";
import { FOOD_CATEGORIES, FoodCategory } from "./categories";

export interface ExpirationEstimate {
  days: number;
  label: string;
  confidence: "high" | "medium" | "low";
}

export const ReceiptLineItemSchema = z.object({
  description: z.string().describe(
    "Full human-readable product name with all abbreviations decoded. Include size/weight if printed on the receipt line."
  ),
  quantity: z.number().int().positive().describe(
    "Number of units purchased. Use 1 for weighed items (e.g. produce sold by pound)."
  ),
  price: z.number().nullable().describe(
    "Extended line price as printed (null if not legible). For multi-unit rows this is quantity × unit price."
  ),
  confidence: z.number().min(0).max(1).describe(
    "Confidence in the decoded product name. 0.9+ = clear text fully decoded; 0.6–0.89 = partial abbreviation resolved by context; below 0.6 = significant uncertainty in decoding."
  ),
});

export const ReceiptParseResultSchema = z.object({
  storeName: z.string().nullable().describe("Store or vendor name as printed. Null if not visible."),
  lineItems: z.array(ReceiptLineItemSchema),
  total: z.number().nullable().describe("Receipt grand total as printed. Null if not visible."),
});

export type ReceiptParseResult = z.infer<typeof ReceiptParseResultSchema>;

export const ExpirationEstimateSchema = z.object({
  days: z.number().int().positive().describe(
    "Integer number of days from purchase date until typical expiration. Assume the item is unopened and stored correctly (refrigerate perishables, pantry for dry goods, freezer for frozen)."
  ),
  label: z.string().describe(
    "Human-readable shelf-life label. Use the format '~N unit' — e.g. '~1 week', '~3 months', '~1 year'."
  ),
  confidence: z.enum(["high", "medium", "low"]).describe(
    "high = well-established standard (e.g. fresh milk 7–10 days); medium = common convention with variability; low = rough estimate only."
  ),
});

export const BrandExtractionSchema = z.object({
  brand: z.string().nullable().describe(
    "Brand name in title case, or null if the product has no distinct brand (e.g. loose commodities like 'Salt', 'Bananas')."
  ),
});

export const NormalizationSchema = z.object({
  normalized: z.string().describe(
    "Core food name in lowercase singular form — no brand, size, or descriptors. Compound food names like 'almond milk' or 'olive oil' are preserved as-is."
  ),
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
    system: `You are a receipt OCR specialist. Extract structured product data from grocery receipt images.

Rules:
- Only extract purchased products. Exclude: taxes, subtotals, totals, fees (bag fees, bottle deposits), discounts, coupons, loyalty savings, EBT/SNAP summary lines.
- Decode ALL abbreviations into full human-readable names. Common patterns:
    GV / GRT VL → Great Value (Walmart house brand)
    KS / KRKL → Kirkland Signature (Costco house brand)
    MLK → Milk   HLF GL → Half Gallon   ORG → Organic
    CHKN → Chicken   BRS → Breast   LS → Boneless Skinless
    T-BN STK → T-Bone Steak   LN GRD BF → Lean Ground Beef
    BNNA / BAN → Banana   AVCD → Avocado
- For weighed items (e.g. "BANANAS 0.45 LB"), set quantity to 1 and include the weight description in the product name.
- Price is the per-line extended price as printed.`,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: Buffer.from(imageBase64, "base64") },
          {
            type: "text",
            text: "Extract all purchased products from this receipt.",
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
      system: `You are a food safety expert specializing in consumer grocery products.

Storage assumption: estimate shelf life as purchased from a grocery store, stored correctly — refrigerate perishables, keep dry goods in a cool pantry, frozen items in a freezer. Assume the package is unopened.`,
      messages: [
        {
          role: "user",
          content: `How long does this product typically last from the purchase date?

Product: ${productName}${category ? `\nCategory: ${category}` : ""}`,
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

export function clearBrandCache(): void {
  brandCache.clear();
}

export function clearNormalizeCache(): void {
  normalizeCache.clear();
}

export function clearSuggestionCache(): void {
  suggestionCache.clear();
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
  category: FoodCategory;
  estimatedShelfDays: number;
}

export const SuggestionSchema = z.object({
  unit: z.string().describe(
    "Standard unit of measure. Use exactly: 'unit', 'lb', 'oz', 'fl oz', or 'bunch'. No other values."
  ),
  category: z.enum(FOOD_CATEGORIES).describe(
    "Best-matching food category from the allowed list."
  ),
  estimatedShelfDays: z.number().int().positive().describe(
    "Days from purchase until typical expiration, assuming unopened and correctly stored."
  ),
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
