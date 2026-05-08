import type { ProductCacheEntry } from "../openfoodfacts";

export interface ProductPrice {
  regular: number;
  promo?: number;
  currency: string;
}

export interface ProductSearchResult extends ProductCacheEntry {
  confidence: number;
  price?: ProductPrice;
  stock?: "high" | "low" | "out";
}

export interface LookupOptions {
  locationId?: string;
  limit?: number;
}

export interface LookupProvider {
  readonly source: "kroger" | "open_food_facts" | "trader_joes";
  getProductByBarcode(upc: string, opts?: LookupOptions): Promise<ProductCacheEntry | null>;
  searchByName(query: string, opts?: LookupOptions): Promise<ProductSearchResult[]>;
}
