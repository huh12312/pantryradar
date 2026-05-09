import type { ProductCacheEntry } from "../openfoodfacts";
import { inferCategoryFromName } from "../categories";
import type { LookupProvider, LookupOptions, ProductSearchResult } from "./types";

const KROGER_AUTH_URL = "https://api.kroger.com/v1/connect/oauth2/token";
const KROGER_PRODUCTS_URL = "https://api.kroger.com/v1/products";
const KROGER_LOCATIONS_URL = "https://api.kroger.com/v1/locations";

interface KrogerTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface KrogerImageSize {
  size: string;
  url: string;
}

interface KrogerImage {
  perspective: string;
  sizes: KrogerImageSize[];
}

interface KrogerItemPrice {
  regular?: number;
  promo?: number;
}

interface KrogerInventory {
  stockLevel: string;
}

interface KrogerItem {
  price?: KrogerItemPrice;
  inventory?: KrogerInventory;
}

interface KrogerProduct {
  productId: string;
  upc: string;
  description: string;
  brand?: string;
  categories?: string[];
  images?: KrogerImage[];
  items?: KrogerItem[];
}

interface KrogerProductsResponse {
  data?: KrogerProduct[];
}

interface KrogerLocationAddress {
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface KrogerLocation {
  locationId: string;
  name: string;
  chain: string;
  address?: KrogerLocationAddress;
}

interface KrogerLocationsResponse {
  data?: KrogerLocation[];
}

export interface StoreResult {
  locationId: string;
  name: string;
  chain: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

const IMAGE_SIZE_PREF = ["xlarge", "large", "medium", "small", "thumbnail"];

export class KrogerClient implements LookupProvider {
  readonly source = "kroger" as const;

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {}

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const response = await fetch(KROGER_AUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=product.compact",
    });

    if (!response.ok) {
      throw new Error(`Kroger auth failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as KrogerTokenResponse;
    this.accessToken = data.access_token;
    // Expire 60s early to avoid clock skew
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  private pickImage(images?: KrogerImage[]): string | null {
    if (!images?.length) return null;
    const front = images.find((i) => i.perspective === "front") ?? images[0];
    if (!front) return null;
    for (const sz of IMAGE_SIZE_PREF) {
      const hit = front.sizes.find((s) => s.size === sz);
      if (hit?.url) return hit.url;
    }
    return front.sizes[0]?.url ?? null;
  }

  private scoreConfidence(name: string, query: string): number {
    const n = name.toLowerCase();
    const q = query.toLowerCase();
    if (n === q) return 1.0;
    if (n.includes(q) || q.includes(n)) return 0.85;
    const words = q.split(/\s+/).filter(Boolean);
    if (!words.length) return 0;
    const matched = words.filter((w) => n.includes(w));
    return (matched.length / words.length) * 0.8;
  }

  private mapStockLevel(level?: string): "high" | "low" | "out" | undefined {
    if (!level) return undefined;
    const l = level.toLowerCase();
    if (l.includes("out") || l === "0") return "out";
    if (l.includes("low")) return "low";
    return "high";
  }

  private mapProduct(p: KrogerProduct): ProductCacheEntry {
    return {
      upc: p.upc,
      name: p.description || null,
      brand: p.brand || null,
      category: inferCategoryFromName(p.description ?? "") ?? null,
      imageUrl: this.pickImage(p.images),
      source: "kroger",
      fetchedAt: new Date(),
    };
  }

  private mapSearchResult(p: KrogerProduct, query: string, hasLocation: boolean): ProductSearchResult {
    const base = this.mapProduct(p);
    const item = p.items?.[0];
    const price =
      item?.price?.regular != null
        ? { regular: item.price.regular, promo: item.price.promo, currency: "USD" }
        : undefined;

    return {
      ...base,
      confidence: this.scoreConfidence(p.description ?? "", query),
      price,
      // Stock is only meaningful when scoped to a specific store location
      stock: hasLocation ? this.mapStockLevel(item?.inventory?.stockLevel) : undefined,
    };
  }

  async getProductByBarcode(upc: string, opts?: LookupOptions): Promise<ProductCacheEntry | null> {
    try {
      const token = await this.getAccessToken();
      // Kroger UPCs are 13-digit zero-padded
      const padded = upc.padStart(13, "0");
      const locationParam = opts?.locationId ? `&filter.locationId=${opts.locationId}` : "";
      const url = `${KROGER_PRODUCTS_URL}?filter.term=${padded}&filter.limit=1${locationParam}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        // Token was rejected — clear and retry once
        this.accessToken = null;
        const fresh = await this.getAccessToken();
        const retry = await fetch(url, { headers: { Authorization: `Bearer ${fresh}` } });
        if (!retry.ok) return null;
        const retryData = (await retry.json()) as KrogerProductsResponse;
        const p = retryData.data?.[0];
        return p ? this.mapProduct(p) : null;
      }

      if (!response.ok) return null;
      const data = (await response.json()) as KrogerProductsResponse;
      const product = data.data?.[0];
      return product ? this.mapProduct(product) : null;
    } catch (error) {
      console.error("Kroger barcode lookup error:", error);
      return null;
    }
  }

  async searchByName(query: string, opts?: LookupOptions): Promise<ProductSearchResult[]> {
    const limit = Math.min(opts?.limit ?? 10, 10);
    const hasLocation = !!opts?.locationId;
    try {
      const token = await this.getAccessToken();
      const locationParam = opts?.locationId ? `&filter.locationId=${opts.locationId}` : "";
      const url = `${KROGER_PRODUCTS_URL}?filter.term=${encodeURIComponent(query)}&filter.limit=${limit}${locationParam}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 429) console.warn("Kroger rate limit hit");
        return [];
      }

      const data = (await response.json()) as KrogerProductsResponse;
      return (data.data ?? []).map((p) => this.mapSearchResult(p, query, hasLocation));
    } catch (error) {
      console.error("Kroger search error:", error);
      return [];
    }
  }

  async searchLocations(zip: string, radiusInMiles = 15): Promise<StoreResult[]> {
    try {
      const token = await this.getAccessToken();
      const url = `${KROGER_LOCATIONS_URL}?filter.zipCode.near=${encodeURIComponent(zip)}&filter.radiusInMiles=${radiusInMiles}&filter.limit=10`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        console.error(`Kroger locations error: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as KrogerLocationsResponse;
      return (data.data ?? []).map((s) => ({
        locationId: s.locationId,
        name: s.name,
        chain: s.chain,
        address: s.address?.addressLine1 ?? "",
        city: s.address?.city ?? "",
        state: s.address?.state ?? "",
        zipCode: s.address?.zipCode ?? "",
      }));
    } catch (error) {
      console.error("Kroger locations search error:", error);
      return [];
    }
  }
}

export function createKrogerClient(): KrogerClient | null {
  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new KrogerClient(clientId, clientSecret);
}

export const krogerClient = createKrogerClient();
