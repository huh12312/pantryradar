import { z } from "zod";

// Item schemas
export const itemLocationSchema = z.enum(["pantry", "fridge", "freezer"]);

export const itemSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  location: itemLocationSchema,
  quantity: z.number().positive().default(1),
  unit: z.string().nullable().optional(),
  barcodeUpc: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  expirationEstimated: z.boolean().default(false),
  opened: z.boolean().default(false),
  addedBy: z.string().uuid(),
  addedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  notes: z.string().nullable().optional(),
});

export const createItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  brand: z.string().optional(),
  category: z.string().optional(),
  location: itemLocationSchema,
  quantity: z.coerce.number().positive().default(1),
  unit: z.string().optional(),
  barcodeUpc: z.string().optional(),
  imageUrl: z.string().optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  expirationEstimated: z.boolean().default(false),
  opened: z.boolean().default(false),
  notes: z.string().optional(),
});

// Defined explicitly without defaults so a PUT with missing fields
// doesn't silently overwrite existing values with schema defaults (Zod 4 behaviour change).
export const updateItemSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  location: itemLocationSchema.optional(),
  quantity: z.coerce.number().positive().optional(),
  unit: z.string().optional(),
  barcodeUpc: z.string().optional(),
  imageUrl: z.string().optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  expirationEstimated: z.boolean().optional(),
  opened: z.boolean().optional(),
  notes: z.string().optional(),
});

// Household schemas
export const householdSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Household name is required"),
  inviteCode: z.string(),
  createdAt: z.coerce.date(),
});

export const createHouseholdSchema = z.object({
  name: z.string().min(1, "Household name is required"),
});

// User schemas
export const userSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  displayName: z.string().min(1, "Display name is required"),
  email: z.string().email(),
  createdAt: z.coerce.date(),
});

// Product cache schemas
export const productCacheSchema = z.object({
  upc: z.string(),
  name: z.string(),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  source: z.enum(["open_food_facts", "manual", "kroger", "trader_joes"]),
  fetchedAt: z.coerce.date(),
});

// Receipt processing schemas
export const receiptLineItemSchema = z.object({
  raw: z.string(),
  decoded: z.string(),
  confidence: z.number().min(0).max(1),
  quantity: z.number().optional(),
  price: z.number().optional(),
});

export const receiptProcessingResultSchema = z.object({
  storeName: z.string().optional(),
  lineItems: z.array(receiptLineItemSchema),
  total: z.number().optional(),
});

// Barcode product schemas
export const barcodeProductSchema = z.object({
  upc: z.string(),
  name: z.string(),
  brand: z.string().optional(),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
  source: z.enum(["open_food_facts", "manual", "kroger", "trader_joes"]).optional(),
  estimatedExpirationDays: z.number().optional(),
  estimatedExpirationLabel: z.string().optional(),
});

// Product search result schema (from /api/products/search)
export const productPriceSchema = z.object({
  regular: z.number(),
  promo: z.number().optional(),
  currency: z.string(),
});

export const productSearchResultSchema = z.object({
  upc: z.string().optional(),
  name: z.string().nullable(),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  source: z.enum(["open_food_facts", "manual", "kroger", "trader_joes"]),
  confidence: z.number().min(0).max(1),
  price: productPriceSchema.optional(),
  stock: z.enum(["high", "low", "out"]).optional(),
});

// Expiration estimation schemas
export const expirationEstimateSchema = z.object({
  days: z.number().int().positive(),
  label: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

// API response schemas
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
  });

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });

// Sync queue schemas
export const syncQueueEntrySchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["create", "update", "delete"]),
  tableName: z.string(),
  recordId: z.string(),
  data: z.unknown(),
  createdAt: z.coerce.date(),
  synced: z.boolean(),
});

// Shopping list schemas
export const shoppingListStatusSchema = z.enum(["pending", "purchased"]);

export const shoppingListItemSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  suggestedQty: z.number().positive().default(1),
  sourceItemId: z.string().uuid().nullable().optional(),
  status: shoppingListStatusSchema,
  addedBy: z.string(),
  addedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createShoppingListItemSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  suggestedQty: z.coerce.number().positive().default(1),
  sourceItemId: z.string().uuid().optional(),
});

export const updateShoppingListItemSchema = z.object({
  status: shoppingListStatusSchema.optional(),
});

export type ItemLocation = z.infer<typeof itemLocationSchema>;
export type Item = z.infer<typeof itemSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type Household = z.infer<typeof householdSchema>;
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type User = z.infer<typeof userSchema>;
export type ProductCache = z.infer<typeof productCacheSchema>;
export type ReceiptLineItem = z.infer<typeof receiptLineItemSchema>;
export type ReceiptProcessingResult = z.infer<typeof receiptProcessingResultSchema>;
export type BarcodeProduct = z.infer<typeof barcodeProductSchema>;
export type ProductSearchResult = z.infer<typeof productSearchResultSchema>;
export type ProductPrice = z.infer<typeof productPriceSchema>;
export type ExpirationEstimate = z.infer<typeof expirationEstimateSchema>;
export type SyncQueueEntry = z.infer<typeof syncQueueEntrySchema>;
export type ShoppingListStatus = z.infer<typeof shoppingListStatusSchema>;
export type ShoppingListItem = z.infer<typeof shoppingListItemSchema>;
export type CreateShoppingListItemInput = z.infer<typeof createShoppingListItemSchema>;
export type UpdateShoppingListItemInput = z.infer<typeof updateShoppingListItemSchema>;

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
