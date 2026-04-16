import type { ItemLocation } from "../schemas";

// Item locations
export const ITEM_LOCATIONS: ItemLocation[] = ["pantry", "fridge", "freezer"];

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
