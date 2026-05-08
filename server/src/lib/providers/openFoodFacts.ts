import type { ProductCacheEntry } from "../openfoodfacts";
import { openFoodFactsClient } from "../openfoodfacts";
import type { LookupProvider, LookupOptions, ProductSearchResult } from "./types";

export class OpenFoodFactsProvider implements LookupProvider {
  readonly source = "open_food_facts" as const;

  async getProductByBarcode(upc: string, _opts?: LookupOptions): Promise<ProductCacheEntry | null> {
    return openFoodFactsClient.getProductByBarcode(upc);
  }

  async searchByName(query: string, opts?: LookupOptions): Promise<ProductSearchResult[]> {
    const limit = opts?.limit ?? 10;
    const matches = await openFoodFactsClient.fuzzySearch(query);
    return matches.slice(0, limit).map((match) => ({
      upc: match.product.code,
      name: match.product.product_name ?? null,
      brand: match.product.brands ?? null,
      category: match.product.categories ?? null,
      imageUrl: match.product.image_url ?? null,
      source: "open_food_facts" as const,
      fetchedAt: new Date(),
      confidence: match.confidence,
    }));
  }
}

export const openFoodFactsProvider = new OpenFoodFactsProvider();
