// Core data types

export type ItemLocation = "pantry" | "fridge" | "freezer";

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: Date;
}

export interface User {
  id: string;
  householdId: string;
  displayName: string;
  email: string;
  createdAt: Date;
}

export interface Item {
  id: string;
  householdId: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  location: ItemLocation;
  quantity: number;
  unit?: string | null;
  barcodeUpc?: string | null;
  expirationDate?: Date | null;
  expirationEstimated: boolean;
  addedBy: string;
  addedAt: Date;
  updatedAt: Date;
  notes?: string | null;
}

export interface ProductCache {
  upc: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  source: "open_food_facts" | "manual";
  fetchedAt: Date;
}

export interface SyncQueueEntry {
  id: string;
  action: "create" | "update" | "delete";
  tableName: string;
  recordId: string;
  data: unknown;
  createdAt: Date;
  synced: boolean;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Receipt processing types
export interface ReceiptLineItem {
  raw: string;
  decoded: string;
  confidence: number;
  quantity?: number;
  price?: number;
}

export interface ReceiptProcessingResult {
  storeName?: string;
  lineItems: ReceiptLineItem[];
  total?: number;
}

// Barcode lookup types
export interface BarcodeProduct {
  upc: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  estimatedExpirationDays?: number;
  estimatedExpirationLabel?: string;
}

// Expiration estimation types
export interface ExpirationEstimate {
  days: number;
  label: string;
  confidence: "high" | "medium" | "low";
}

// Integration types

// Veryfi types
export interface VeryfiLineItem {
  description: string;
  quantity?: number;
  price?: number;
  total?: number;
  upc?: string;
}

export interface VeryfiResponse {
  vendor?: {
    name?: string;
  };
  line_items?: VeryfiLineItem[];
  total?: number;
}

// Decoded item from OpenAI
export interface DecodedItem {
  raw: string;
  decoded: string;
  confidence: number;
}

// Open Food Facts types
export interface OpenFoodFactsProduct {
  code: string;
  product_name?: string;
  brands?: string;
  categories?: string;
  image_url?: string;
}

export interface FuzzyMatch {
  product: OpenFoodFactsProduct;
  confidence: number;
}

// Barcode result with expiration
export interface BarcodeResult {
  upc: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  expiration?: ExpirationEstimate;
}

// Receipt item (enhanced with matched product)
export interface ReceiptItem {
  raw: string;
  decoded: string;
  confidence: number;
  quantity?: number;
  price?: number;
  matchedProduct?: {
    name?: string;
    brand?: string;
    category?: string;
    imageUrl?: string;
  };
}
