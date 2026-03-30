import type { ItemLocation } from "../types";

// Item locations
export const ITEM_LOCATIONS: ItemLocation[] = ["pantry", "fridge", "freezer"];

// Expiration defaults by category (in days)
export const EXPIRATION_DEFAULTS: Record<string, number> = {
  // Dairy
  milk: 7,
  cheese: 21,
  yogurt: 14,
  butter: 90,
  cream: 7,

  // Meat & Poultry
  "raw chicken": 2,
  "raw beef": 3,
  "raw pork": 3,
  "raw fish": 2,
  "ground meat": 2,
  "deli meat": 5,
  bacon: 7,
  sausage: 7,

  // Produce
  lettuce: 7,
  spinach: 5,
  tomatoes: 7,
  potatoes: 30,
  onions: 30,
  carrots: 21,
  apples: 30,
  bananas: 7,
  berries: 5,
  citrus: 14,

  // Bread & Grains
  bread: 7,
  pasta: 730, // 2 years
  rice: 730,
  cereal: 180,
  flour: 365,

  // Canned & Packaged
  "canned goods": 730,
  "canned vegetables": 730,
  "canned fruit": 730,
  "canned soup": 730,
  "jarred sauce": 365,
  "peanut butter": 180,
  jam: 180,

  // Condiments
  ketchup: 180,
  mustard: 365,
  mayonnaise: 60,
  "salad dressing": 90,
  "hot sauce": 365,
  "soy sauce": 730,

  // Frozen foods
  "frozen vegetables": 365,
  "frozen fruit": 365,
  "frozen meals": 180,
  "ice cream": 60,

  // Beverages
  juice: 7,
  soda: 270,
  water: 365,

  // Default fallback
  default: 30,
};

// Common food categories
export const FOOD_CATEGORIES = [
  "Dairy",
  "Meat & Poultry",
  "Seafood",
  "Produce",
  "Bread & Bakery",
  "Grains & Pasta",
  "Canned Goods",
  "Condiments & Sauces",
  "Snacks",
  "Beverages",
  "Frozen Foods",
  "Spices & Seasonings",
  "Other",
] as const;

// Common units
export const COMMON_UNITS = [
  "unit",
  "lb",
  "oz",
  "kg",
  "g",
  "gal",
  "qt",
  "pt",
  "cup",
  "L",
  "mL",
  "can",
  "jar",
  "box",
  "bag",
  "package",
] as const;

// API endpoints
export const API_ENDPOINTS = {
  HEALTH: "/health",
  ITEMS: "/items",
  HOUSEHOLDS: "/households",
  BARCODE: "/barcode",
  RECEIPT: "/receipt",
} as const;

// Storage keys for local/async storage
export const STORAGE_KEYS = {
  AUTH_TOKEN: "pantrymaid_auth_token",
  HOUSEHOLD_ID: "pantrymaid_household_id",
  USER_ID: "pantrymaid_user_id",
  LAST_SYNC: "pantrymaid_last_sync",
} as const;

// Sync configuration
export const SYNC_CONFIG = {
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  BATCH_SIZE: 50,
} as const;
