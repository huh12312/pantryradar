/**
 * Open Food Facts API client
 * Free product database - no API key required
 * With product_cache layer and fuzzy search
 */

import { db } from "./db";
import { productCache } from "../db/schema";
import { eq } from "drizzle-orm";

export interface OpenFoodFactsProduct {
  code: string;
  product_name?: string;
  brands?: string;
  categories?: string;
  image_url?: string;
}

interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}

interface OpenFoodFactsSearchResponse {
  products?: OpenFoodFactsProduct[];
}

export interface ProductCacheEntry {
  upc: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  source: string;
  fetchedAt: Date;
}

export interface FuzzyMatch {
  product: OpenFoodFactsProduct;
  confidence: number;
}

// Cache TTL: 7 days
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class OpenFoodFactsClient {
  private baseUrl = "https://world.openfoodfacts.org/api/v2";

  /**
   * Look up a product by UPC/barcode
   * Checks cache first, then fetches from API if needed
   */
  async getProductByBarcode(upc: string): Promise<ProductCacheEntry | null> {
    // Check cache first
    const cached = await this.getCachedProduct(upc);
    if (cached && !this.isCacheStale(cached.fetchedAt)) {
      return cached;
    }

    // Cache miss or stale - fetch from API
    const product = await this.fetchProductByBarcode(upc);
    if (!product) {
      return null;
    }

    // Store in cache
    const cacheEntry = await this.cacheProduct(product);
    return cacheEntry;
  }

  /**
   * Fuzzy search by product name
   * Returns top 3 matches with confidence scores
   */
  async fuzzySearch(name: string): Promise<FuzzyMatch[]> {
    const products = await this.searchProducts(name, 10);

    // Calculate confidence based on string similarity
    const matches = products.map((product) => ({
      product,
      confidence: this.calculateSimilarity(
        name.toLowerCase(),
        (product.product_name || "").toLowerCase()
      ),
    }));

    // Sort by confidence and return top 3
    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .filter((match) => match.confidence > 0.3); // Filter out low-confidence matches
  }

  /**
   * Search for products by name (direct API call)
   */
  async searchProducts(
    query: string,
    limit = 10
  ): Promise<OpenFoodFactsProduct[]> {
    const url = `${this.baseUrl}/search?search_terms=${encodeURIComponent(query)}&page_size=${limit}&json=true`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "PantryMaid/1.0 (https://github.com/huh12312/pantrymaid)",
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as OpenFoodFactsSearchResponse;
      return data.products || [];
    } catch (error) {
      console.error("Open Food Facts search error:", error);
      return [];
    }
  }

  /**
   * Get cached product from database
   */
  private async getCachedProduct(
    upc: string
  ): Promise<ProductCacheEntry | null> {
    try {
      const [cached] = await db
        .select()
        .from(productCache)
        .where(eq(productCache.upc, upc));

      return cached || null;
    } catch (error) {
      console.error("Error reading from product cache:", error);
      return null;
    }
  }

  /**
   * Check if cache entry is stale (older than TTL)
   */
  private isCacheStale(fetchedAt: Date): boolean {
    return Date.now() - fetchedAt.getTime() > CACHE_TTL_MS;
  }

  /**
   * Fetch product from Open Food Facts API
   */
  private async fetchProductByBarcode(
    upc: string
  ): Promise<OpenFoodFactsProduct | null> {
    const url = `${this.baseUrl}/product/${upc}.json`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "PantryMaid/1.0 (https://github.com/huh12312/pantrymaid)",
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as OpenFoodFactsResponse;

      if (data.status === 1 && data.product) {
        return data.product;
      }

      return null;
    } catch (error) {
      console.error("Open Food Facts API error:", error);
      return null;
    }
  }

  /**
   * Cache a product in the database
   */
  private async cacheProduct(
    product: OpenFoodFactsProduct
  ): Promise<ProductCacheEntry> {
    const entry: ProductCacheEntry = {
      upc: product.code,
      name: product.product_name || null,
      brand: product.brands || null,
      category: product.categories || null,
      imageUrl: product.image_url || null,
      source: "open_food_facts",
      fetchedAt: new Date(),
    };

    try {
      await db
        .insert(productCache)
        .values(entry)
        .onConflictDoUpdate({
          target: productCache.upc,
          set: {
            name: entry.name,
            brand: entry.brand,
            category: entry.category,
            imageUrl: entry.imageUrl,
            fetchedAt: entry.fetchedAt,
          },
        });
    } catch (error) {
      console.error("Error caching product:", error);
    }

    return entry;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * Returns a value between 0 and 1 (1 = identical)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    // Check for substring match (higher confidence)
    if (longer.includes(shorter)) {
      return 0.8 + 0.2 * (shorter.length / longer.length);
    }

    const distance = this.levenshteinDistance(str1, str2);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2[i - 1] === str1[j - 1]) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1, // insertion
            matrix[i - 1]![j]! + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length]![str1.length]!;
  }
}

// Export singleton instance
export const openFoodFactsClient = new OpenFoodFactsClient();
