/**
 * Pure category-inference utilities — no DB dependency.
 * Shared by OpenFoodFacts, Kroger, and other providers.
 */

const CATEGORY_PATTERNS: Array<{ keywords: string[]; category: string }> = [
  { keywords: ["frozen"], category: "Frozen Foods" },
  {
    keywords: ["dairy", "milk", "cheese", "yogurt", "butter", "cream", "kefir"],
    category: "Dairy",
  },
  {
    keywords: [
      "meat",
      "beef",
      "pork",
      "chicken",
      "poultry",
      "lamb",
      "veal",
      "turkey",
      "sausage",
      "bacon",
      "deli",
      "steak",
      "ribs",
      "brisket",
      "sirloin",
      "tenderloin",
      "drumstick",
      "cutlet",
      "meatball",
      "mince",
      "roast",
    ],
    category: "Meat & Poultry",
  },
  {
    keywords: [
      "seafood",
      "fish",
      "shrimp",
      "salmon",
      "tuna",
      "shellfish",
      "crab",
      "lobster",
      "cod",
      "tilapia",
      "halibut",
      "scallop",
      "mussel",
      "oyster",
      "anchovy",
      "sardine",
    ],
    category: "Seafood",
  },
  {
    keywords: [
      "fruit",
      "vegetable",
      "produce",
      "salad",
      "herb",
      "mushroom",
      "potato",
      "tomato",
      "onion",
      "carrot",
      "pepper",
      "berry",
      "apple",
      "banana",
      "orange",
      "lemon",
      "lime",
      "grape",
      "mango",
      "peach",
      "pear",
      "plum",
      "kiwi",
      "avocado",
      "watermelon",
      "pineapple",
      "melon",
      "cherry",
      "cherries",
      "blueberry",
      "blueberries",
      "strawberry",
      "strawberries",
      "raspberry",
      "raspberries",
      "cranberry",
      "cranberries",
      "blackberry",
      "blackberries",
      "gooseberry",
      "broccoli",
      "spinach",
      "kale",
      "celery",
      "cucumber",
      "lettuce",
      "asparagus",
      "cauliflower",
      "zucchini",
      "squash",
      "beet",
      "radish",
      "leek",
      "arugula",
      "cabbage",
      "chard",
      "fennel",
      "artichoke",
      "eggplant",
      "aubergine",
      "parsnip",
    ],
    category: "Produce",
  },
  {
    keywords: [
      "bread",
      "bakery",
      "baked",
      "roll",
      "bun",
      "tortilla",
      "wrap",
      "bagel",
      "muffin",
      "pastry",
      "cake",
      "donut",
      "croissant",
      "sourdough",
      "loaf",
      "brioche",
      "focaccia",
      "pita",
    ],
    category: "Bread & Bakery",
  },
  {
    keywords: [
      "pasta",
      "rice",
      "grain",
      "cereal",
      "oat",
      "flour",
      "noodle",
      "quinoa",
      "barley",
      "lentil",
      "bean",
      "legume",
      "couscous",
      "bulgur",
      "farro",
      "polenta",
      "grits",
    ],
    category: "Grains & Pasta",
  },
  { keywords: ["canned", "tinned", "preserved", "jar"], category: "Canned Goods" },
  {
    keywords: [
      "condiment",
      "sauce",
      "dressing",
      "ketchup",
      "mustard",
      "mayonnaise",
      "vinegar",
      "oil",
      "syrup",
      "spread",
      "jam",
      "jelly",
      "sriracha",
      "tabasco",
      "salsa",
      "pesto",
      "hummus",
      "aioli",
      "relish",
      "tahini",
      "chutney",
      "glaze",
      "marinade",
      "gravy",
      "hoisin",
      "teriyaki",
    ],
    category: "Condiments & Sauces",
  },
  {
    keywords: [
      "snack",
      "chip",
      "crisp",
      "cracker",
      "cookie",
      "biscuit",
      "popcorn",
      "pretzel",
      "nut",
      "candy",
      "chocolate",
      "sweet",
      "dessert",
      "granola",
      "jerky",
      "pork rind",
      "rice cake",
      "trail mix",
    ],
    category: "Snacks",
  },
  {
    keywords: [
      "beverage",
      "drink",
      "juice",
      "water",
      "soda",
      "coffee",
      "tea",
      "beer",
      "wine",
      "alcohol",
      "energy-drink",
      "smoothie",
      "kombucha",
      "cider",
      "lemonade",
      "espresso",
    ],
    category: "Beverages",
  },
  {
    keywords: [
      "spice",
      "seasoning",
      "salt",
      "pepper",
      "cinnamon",
      "cumin",
      "paprika",
      "oregano",
      "basil",
      "garlic-powder",
      "turmeric",
      "ginger",
      "rosemary",
      "thyme",
      "chili",
      "cayenne",
      "clove",
      "nutmeg",
      "cardamom",
      "curry",
      "bay leaf",
      "anise",
    ],
    category: "Spices & Seasonings",
  },
];

/**
 * Infer a FOOD_CATEGORY from a plain item name (e.g. "t-bone steak" → "Meat & Poultry").
 * Uses word-boundary matching so "pepper" doesn't fire inside "peppercorn".
 * Returns null if no pattern matches.
 */
export function inferCategoryFromName(name: string): string | null {
  const lower = name.toLowerCase();
  for (const { keywords, category } of CATEGORY_PATTERNS) {
    if (
      keywords.some((kw) => {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(?:^|[\\s\\-,])${escaped}(?:[\\s\\-,]|$)`).test(lower);
      })
    ) {
      return category;
    }
  }
  return null;
}

/**
 * Normalize a raw Open Food Facts categories string to one of the app's FOOD_CATEGORIES.
 * OFF sends a comma-separated list of taxonomy tags, e.g. "en:dairy-products, en:cheeses".
 * Returns null on empty input; falls back to "Other" if no pattern matches.
 */
export function normalizeCategoryFromOff(offCategories: string | null): string | null {
  if (!offCategories) return null;

  const tags = offCategories.split(",").map((t) =>
    t
      .trim()
      .replace(/^[a-z]{2}:/, "")
      .toLowerCase()
  );

  // Container/preservation keywords must win over ingredient-specific tags:
  // e.g. "tomato-soups" would match "Produce" before the loop ever reaches "canned-soups",
  // and "vegetables" would match "Produce" before "frozen-foods" matched "Frozen Foods".
  if (tags.some((tag) => ["canned", "tinned", "preserved"].some((kw) => tag.includes(kw)))) {
    return "Canned Goods";
  }
  if (tags.some((tag) => tag.includes("frozen"))) {
    return "Frozen Foods";
  }

  // Check from most specific (last) to most general (first)
  for (const tag of [...tags].reverse()) {
    for (const { keywords, category } of CATEGORY_PATTERNS) {
      if (keywords.some((kw) => tag.includes(kw))) {
        return category;
      }
    }
  }

  return "Other";
}

export const FOOD_CATEGORIES = [
  "Dairy",
  "Meat & Poultry",
  "Seafood",
  "Produce",
  "Bread & Bakery",
  "Breakfast & Cereal",
  "Grains & Pasta",
  "Baking",
  "Canned Goods",
  "Condiments & Sauces",
  "Oils & Vinegars",
  "Snacks",
  "Beverages",
  "Frozen Foods",
  "Spices & Seasonings",
  "Other",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];
