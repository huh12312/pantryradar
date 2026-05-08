# Inventory Gaps & Re-order List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close six inventory-loading gaps (units, presets, opened flag, consume action, duplicate detection) and introduce a Re-order List feature backed by a new `shopping_list_items` table.

**Architecture:** Three phases — Foundation (shared constants/schemas + DB schema + server routes) must land first; Web UI and Mobile UI are independent of each other but both depend on Foundation. The Re-order List is a new first-class entity with its own lifecycle (`pending → purchased`), separate from the items table.

**Tech Stack:** Drizzle ORM + PostgreSQL (server), Hono + Bun (API), React + Vite + TanStack Query + shadcn/ui (web), Expo + expo-sqlite + NativeWind (mobile), Zod (shared validation), Vitest (unit/component tests), Playwright (E2E).

---

## Phase 1 — Foundation

### Task 1: Expand COMMON_UNITS and add ITEM_PRESETS

**Files:**
- Modify: `packages/shared/src/constants/index.ts`
- Modify: `packages/shared/src/test/schemas.test.ts` (add constants tests at bottom)

- [ ] **Step 1: Write failing tests for constants**

Add to `packages/shared/src/test/schemas.test.ts`:

```ts
import {
  COMMON_UNITS,
  ITEM_PRESETS,
} from "../constants";

describe("COMMON_UNITS", () => {
  it("includes US units", () => {
    expect(COMMON_UNITS).toContain("lb");
    expect(COMMON_UNITS).toContain("oz");
    expect(COMMON_UNITS).toContain("fl oz");
    expect(COMMON_UNITS).toContain("gal");
    expect(COMMON_UNITS).toContain("bunch");
  });
});

describe("ITEM_PRESETS", () => {
  it("has at least 100 entries", () => {
    expect(ITEM_PRESETS.length).toBeGreaterThanOrEqual(100);
  });
  it("has no duplicate names", () => {
    const names = ITEM_PRESETS.map((p) => p.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
  it("every preset has required fields", () => {
    for (const p of ITEM_PRESETS) {
      expect(typeof p.name).toBe("string");
      expect(typeof p.category).toBe("string");
      expect(typeof p.unit).toBe("string");
      expect(typeof p.estimatedShelfDays).toBe("number");
      expect(p.estimatedShelfDays).toBeGreaterThan(0);
    }
  });
  it("all categories are valid FOOD_CATEGORIES values", () => {
    const valid = new Set(FOOD_CATEGORIES as readonly string[]);
    for (const p of ITEM_PRESETS) {
      expect(valid.has(p.category), `${p.name} has unknown category: ${p.category}`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/shared && pnpm test
```
Expected: FAIL — `ITEM_PRESETS is not exported` and unit assertions fail.

- [ ] **Step 3: Update constants file**

Replace the entire `packages/shared/src/constants/index.ts` with:

```ts
import type { ItemLocation } from "../schemas";

export const ITEM_LOCATIONS: ItemLocation[] = ["pantry", "fridge", "freezer"];

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

export const COMMON_UNITS = [
  "unit",
  "lb",
  "oz",
  "fl oz",
  "kg",
  "g",
  "gal",
  "qt",
  "pt",
  "cup",
  "L",
  "mL",
  "dozen",
  "bunch",
  "can",
  "jar",
  "box",
  "bag",
  "package",
] as const;

export const API_ENDPOINTS = {
  HEALTH: "/health",
  ITEMS: "/items",
  HOUSEHOLDS: "/households",
  BARCODE: "/barcode",
  RECEIPT: "/receipt",
  SHOPPING_LIST: "/shopping-list",
} as const;

export interface ItemPreset {
  name: string;
  category: string;
  unit: string;
  estimatedShelfDays: number;
}

export const ITEM_PRESETS: ReadonlyArray<ItemPreset> = [
  // --- Produce (60 items) ---
  { name: "Apple", category: "Produce", unit: "lb", estimatedShelfDays: 30 },
  { name: "Asparagus", category: "Produce", unit: "lb", estimatedShelfDays: 4 },
  { name: "Artichoke", category: "Produce", unit: "unit", estimatedShelfDays: 7 },
  { name: "Avocado", category: "Produce", unit: "unit", estimatedShelfDays: 5 },
  { name: "Banana", category: "Produce", unit: "lb", estimatedShelfDays: 7 },
  { name: "Beet", category: "Produce", unit: "lb", estimatedShelfDays: 14 },
  { name: "Bell Pepper", category: "Produce", unit: "unit", estimatedShelfDays: 10 },
  { name: "Blueberries", category: "Produce", unit: "oz", estimatedShelfDays: 10 },
  { name: "Broccoli", category: "Produce", unit: "lb", estimatedShelfDays: 7 },
  { name: "Brussels Sprouts", category: "Produce", unit: "lb", estimatedShelfDays: 7 },
  { name: "Cabbage", category: "Produce", unit: "unit", estimatedShelfDays: 14 },
  { name: "Carrot", category: "Produce", unit: "lb", estimatedShelfDays: 21 },
  { name: "Cauliflower", category: "Produce", unit: "unit", estimatedShelfDays: 14 },
  { name: "Celery", category: "Produce", unit: "unit", estimatedShelfDays: 14 },
  { name: "Cherry", category: "Produce", unit: "lb", estimatedShelfDays: 7 },
  { name: "Corn", category: "Produce", unit: "unit", estimatedShelfDays: 3 },
  { name: "Cucumber", category: "Produce", unit: "unit", estimatedShelfDays: 7 },
  { name: "Eggplant", category: "Produce", unit: "unit", estimatedShelfDays: 7 },
  { name: "Fennel", category: "Produce", unit: "unit", estimatedShelfDays: 7 },
  { name: "Fresh Basil", category: "Produce", unit: "oz", estimatedShelfDays: 7 },
  { name: "Fresh Cilantro", category: "Produce", unit: "bunch", estimatedShelfDays: 7 },
  { name: "Fresh Dill", category: "Produce", unit: "bunch", estimatedShelfDays: 7 },
  { name: "Fresh Parsley", category: "Produce", unit: "bunch", estimatedShelfDays: 7 },
  { name: "Fresh Rosemary", category: "Produce", unit: "bunch", estimatedShelfDays: 14 },
  { name: "Fresh Thyme", category: "Produce", unit: "bunch", estimatedShelfDays: 7 },
  { name: "Garlic", category: "Produce", unit: "unit", estimatedShelfDays: 90 },
  { name: "Ginger Root", category: "Produce", unit: "oz", estimatedShelfDays: 21 },
  { name: "Grape", category: "Produce", unit: "lb", estimatedShelfDays: 10 },
  { name: "Grapefruit", category: "Produce", unit: "unit", estimatedShelfDays: 21 },
  { name: "Green Beans", category: "Produce", unit: "lb", estimatedShelfDays: 7 },
  { name: "Jalapeño", category: "Produce", unit: "unit", estimatedShelfDays: 14 },
  { name: "Kale", category: "Produce", unit: "bunch", estimatedShelfDays: 7 },
  { name: "Kiwi", category: "Produce", unit: "unit", estimatedShelfDays: 7 },
  { name: "Leek", category: "Produce", unit: "unit", estimatedShelfDays: 14 },
  { name: "Lemon", category: "Produce", unit: "unit", estimatedShelfDays: 21 },
  { name: "Lettuce", category: "Produce", unit: "unit", estimatedShelfDays: 7 },
  { name: "Lime", category: "Produce", unit: "unit", estimatedShelfDays: 21 },
  { name: "Mango", category: "Produce", unit: "unit", estimatedShelfDays: 5 },
  { name: "Mushroom", category: "Produce", unit: "oz", estimatedShelfDays: 7 },
  { name: "Onion", category: "Produce", unit: "lb", estimatedShelfDays: 30 },
  { name: "Orange", category: "Produce", unit: "lb", estimatedShelfDays: 21 },
  { name: "Peach", category: "Produce", unit: "unit", estimatedShelfDays: 5 },
  { name: "Pear", category: "Produce", unit: "unit", estimatedShelfDays: 7 },
  { name: "Pineapple", category: "Produce", unit: "unit", estimatedShelfDays: 5 },
  { name: "Plum", category: "Produce", unit: "lb", estimatedShelfDays: 5 },
  { name: "Potato", category: "Produce", unit: "lb", estimatedShelfDays: 30 },
  { name: "Radish", category: "Produce", unit: "bunch", estimatedShelfDays: 7 },
  { name: "Raspberry", category: "Produce", unit: "oz", estimatedShelfDays: 5 },
  { name: "Romaine Lettuce", category: "Produce", unit: "unit", estimatedShelfDays: 7 },
  { name: "Scallion", category: "Produce", unit: "bunch", estimatedShelfDays: 7 },
  { name: "Shallot", category: "Produce", unit: "unit", estimatedShelfDays: 30 },
  { name: "Snap Peas", category: "Produce", unit: "lb", estimatedShelfDays: 5 },
  { name: "Spinach", category: "Produce", unit: "oz", estimatedShelfDays: 7 },
  { name: "Strawberry", category: "Produce", unit: "lb", estimatedShelfDays: 5 },
  { name: "Sweet Potato", category: "Produce", unit: "lb", estimatedShelfDays: 21 },
  { name: "Swiss Chard", category: "Produce", unit: "bunch", estimatedShelfDays: 5 },
  { name: "Tomato", category: "Produce", unit: "lb", estimatedShelfDays: 7 },
  { name: "Turnip", category: "Produce", unit: "lb", estimatedShelfDays: 14 },
  { name: "Watermelon", category: "Produce", unit: "unit", estimatedShelfDays: 7 },
  { name: "Zucchini", category: "Produce", unit: "unit", estimatedShelfDays: 7 },

  // --- Meat & Poultry (18 items) ---
  { name: "Bacon", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 7 },
  { name: "Beef Brisket", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 3 },
  { name: "Beef Steak", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 3 },
  { name: "Chicken Breast", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 3 },
  { name: "Chicken Thighs", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 3 },
  { name: "Chicken Wings", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 3 },
  { name: "Ground Beef", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 2 },
  { name: "Ground Turkey", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 2 },
  { name: "Hot Dogs", category: "Meat & Poultry", unit: "unit", estimatedShelfDays: 7 },
  { name: "Lamb Chop", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 3 },
  { name: "Pepperoni", category: "Meat & Poultry", unit: "oz", estimatedShelfDays: 14 },
  { name: "Pork Chop", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 3 },
  { name: "Pork Tenderloin", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 3 },
  { name: "Salami", category: "Meat & Poultry", unit: "oz", estimatedShelfDays: 14 },
  { name: "Sausage Links", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 5 },
  { name: "Sliced Ham", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 5 },
  { name: "Sliced Turkey", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 5 },
  { name: "Whole Chicken", category: "Meat & Poultry", unit: "lb", estimatedShelfDays: 3 },

  // --- Seafood (10 items) ---
  { name: "Cod Fillet", category: "Seafood", unit: "lb", estimatedShelfDays: 2 },
  { name: "Crab Legs", category: "Seafood", unit: "lb", estimatedShelfDays: 2 },
  { name: "Halibut", category: "Seafood", unit: "lb", estimatedShelfDays: 2 },
  { name: "Mussels", category: "Seafood", unit: "lb", estimatedShelfDays: 2 },
  { name: "Salmon Fillet", category: "Seafood", unit: "lb", estimatedShelfDays: 2 },
  { name: "Scallops", category: "Seafood", unit: "lb", estimatedShelfDays: 2 },
  { name: "Sea Bass", category: "Seafood", unit: "lb", estimatedShelfDays: 2 },
  { name: "Shrimp", category: "Seafood", unit: "lb", estimatedShelfDays: 2 },
  { name: "Tilapia", category: "Seafood", unit: "lb", estimatedShelfDays: 2 },
  { name: "Tuna Steak", category: "Seafood", unit: "lb", estimatedShelfDays: 2 },

  // --- Bread & Bakery (10 items) ---
  { name: "Bagels", category: "Bread & Bakery", unit: "unit", estimatedShelfDays: 5 },
  { name: "Baguette", category: "Bread & Bakery", unit: "unit", estimatedShelfDays: 2 },
  { name: "Croissants", category: "Bread & Bakery", unit: "unit", estimatedShelfDays: 3 },
  { name: "Dinner Rolls", category: "Bread & Bakery", unit: "unit", estimatedShelfDays: 5 },
  { name: "Muffins", category: "Bread & Bakery", unit: "unit", estimatedShelfDays: 5 },
  { name: "Naan", category: "Bread & Bakery", unit: "unit", estimatedShelfDays: 7 },
  { name: "Pita Bread", category: "Bread & Bakery", unit: "unit", estimatedShelfDays: 7 },
  { name: "Sourdough Loaf", category: "Bread & Bakery", unit: "unit", estimatedShelfDays: 5 },
  { name: "Tortillas", category: "Bread & Bakery", unit: "unit", estimatedShelfDays: 14 },
  { name: "Whole Wheat Bread", category: "Bread & Bakery", unit: "unit", estimatedShelfDays: 7 },

  // --- Bulk & Dry (24 items) ---
  { name: "Brown Rice", category: "Grains & Pasta", unit: "lb", estimatedShelfDays: 365 },
  { name: "Bulk Almonds", category: "Snacks", unit: "lb", estimatedShelfDays: 365 },
  { name: "Bulk Cashews", category: "Snacks", unit: "lb", estimatedShelfDays: 180 },
  { name: "Bulk Pecans", category: "Snacks", unit: "lb", estimatedShelfDays: 180 },
  { name: "Bulk Peanuts", category: "Snacks", unit: "lb", estimatedShelfDays: 365 },
  { name: "Bulk Walnuts", category: "Snacks", unit: "lb", estimatedShelfDays: 180 },
  { name: "Chia Seeds", category: "Snacks", unit: "lb", estimatedShelfDays: 730 },
  { name: "Coffee Beans", category: "Beverages", unit: "lb", estimatedShelfDays: 30 },
  { name: "Dried Apricots", category: "Snacks", unit: "oz", estimatedShelfDays: 365 },
  { name: "Dried Black Beans", category: "Grains & Pasta", unit: "lb", estimatedShelfDays: 1825 },
  { name: "Dried Chickpeas", category: "Grains & Pasta", unit: "lb", estimatedShelfDays: 1825 },
  { name: "Dried Cranberries", category: "Snacks", unit: "oz", estimatedShelfDays: 365 },
  { name: "Dried Kidney Beans", category: "Grains & Pasta", unit: "lb", estimatedShelfDays: 1825 },
  { name: "Dried Lentils", category: "Grains & Pasta", unit: "lb", estimatedShelfDays: 1825 },
  { name: "Dried Mango", category: "Snacks", unit: "oz", estimatedShelfDays: 365 },
  { name: "Flaxseed", category: "Snacks", unit: "lb", estimatedShelfDays: 365 },
  { name: "Granola", category: "Snacks", unit: "lb", estimatedShelfDays: 90 },
  { name: "Loose Leaf Tea", category: "Beverages", unit: "oz", estimatedShelfDays: 365 },
  { name: "Pumpkin Seeds", category: "Snacks", unit: "lb", estimatedShelfDays: 365 },
  { name: "Quinoa", category: "Grains & Pasta", unit: "lb", estimatedShelfDays: 730 },
  { name: "Rolled Oats", category: "Grains & Pasta", unit: "lb", estimatedShelfDays: 730 },
  { name: "Steel Cut Oats", category: "Grains & Pasta", unit: "lb", estimatedShelfDays: 730 },
  { name: "Sunflower Seeds", category: "Snacks", unit: "lb", estimatedShelfDays: 365 },
  { name: "White Rice", category: "Grains & Pasta", unit: "lb", estimatedShelfDays: 1825 },

  // --- Deli Cheese (3 items) ---
  { name: "Deli Cheddar", category: "Dairy", unit: "lb", estimatedShelfDays: 14 },
  { name: "Deli Provolone", category: "Dairy", unit: "lb", estimatedShelfDays: 14 },
  { name: "Deli Swiss Cheese", category: "Dairy", unit: "lb", estimatedShelfDays: 14 },
] as const;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd packages/shared && pnpm test
```
Expected: PASS — 125 presets, no duplicates, all fields valid.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants/index.ts packages/shared/src/test/schemas.test.ts
git commit -m "feat(shared): expand COMMON_UNITS with US units and add 125-item ITEM_PRESETS"
```

---

### Task 2: Add shopping list Zod schemas and `opened` to item schemas

**Files:**
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/test/schemas.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/shared/src/test/schemas.test.ts`:

```ts
import {
  shoppingListStatusSchema,
  shoppingListItemSchema,
  createShoppingListItemSchema,
  updateShoppingListItemSchema,
} from "../schemas";

describe("shoppingListStatusSchema", () => {
  it("accepts pending and purchased", () => {
    expect(shoppingListStatusSchema.parse("pending")).toBe("pending");
    expect(shoppingListStatusSchema.parse("purchased")).toBe("purchased");
  });
  it("rejects dismissed and other strings", () => {
    expect(() => shoppingListStatusSchema.parse("dismissed")).toThrow();
    expect(() => shoppingListStatusSchema.parse("")).toThrow();
  });
});

describe("createShoppingListItemSchema", () => {
  it("accepts minimal payload", () => {
    const result = createShoppingListItemSchema.parse({ name: "Milk" });
    expect(result.name).toBe("Milk");
    expect(result.suggestedQty).toBe(1);
  });
  it("accepts full payload with sourceItemId", () => {
    const result = createShoppingListItemSchema.parse({
      name: "Eggs",
      brand: "Happy Farms",
      category: "Dairy",
      unit: "dozen",
      suggestedQty: 2,
      sourceItemId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.sourceItemId).toBe("123e4567-e89b-12d3-a456-426614174000");
  });
  it("rejects empty name", () => {
    expect(() => createShoppingListItemSchema.parse({ name: "" })).toThrow();
  });
});

describe("updateShoppingListItemSchema", () => {
  it("accepts status update", () => {
    const result = updateShoppingListItemSchema.parse({ status: "purchased" });
    expect(result.status).toBe("purchased");
  });
  it("accepts empty object", () => {
    expect(updateShoppingListItemSchema.parse({})).toEqual({});
  });
});

describe("createItemSchema with opened", () => {
  it("defaults opened to false", () => {
    const result = createItemSchema.parse({ name: "Test", location: "pantry" });
    expect(result.opened).toBe(false);
  });
  it("accepts opened: true", () => {
    const result = createItemSchema.parse({ name: "Test", location: "pantry", opened: true });
    expect(result.opened).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/shared && pnpm test
```
Expected: FAIL — schemas not exported.

- [ ] **Step 3: Update schemas/index.ts**

Add `opened` to `itemSchema`, `createItemSchema`, `updateItemSchema`, and append the shopping list schemas. Find each schema and add the field, then append at the bottom:

In `itemSchema`, add:
```ts
opened: z.boolean().default(false),
```

In `createItemSchema`, add:
```ts
opened: z.boolean().default(false),
```

In `updateItemSchema`, add:
```ts
opened: z.boolean().optional(),
```

After the existing exports, append:

```ts
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

export type ShoppingListStatus = z.infer<typeof shoppingListStatusSchema>;
export type ShoppingListItem = z.infer<typeof shoppingListItemSchema>;
export type CreateShoppingListItemInput = z.infer<typeof createShoppingListItemSchema>;
export type UpdateShoppingListItemInput = z.infer<typeof updateShoppingListItemSchema>;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd packages/shared && pnpm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/index.ts packages/shared/src/test/schemas.test.ts
git commit -m "feat(shared): add shopping list schemas and opened field to item schemas"
```

---

### Task 3: DB schema — add `opened` column and `shopping_list_items` table

**Files:**
- Modify: `server/src/db/schema.ts`

- [ ] **Step 1: Add `opened` to the `items` table and add `shoppingListItems` table**

In `server/src/db/schema.ts`, add `opened` to the items table definition:

```ts
// Inside the items pgTable definition, add after the notes field:
opened: boolean('opened').default(false).notNull(),
```

Append the new table after the `productCache` table:

```ts
export const shoppingListItems = pgTable('shopping_list_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  brand: text('brand'),
  category: text('category'),
  unit: text('unit'),
  suggestedQty: numeric('suggested_qty').default('1').notNull(),
  sourceItemId: uuid('source_item_id').references(() => items.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('pending'),
  addedBy: text('added_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  statusCheck: check('shopping_list_status_check', sql`${table.status} IN ('pending', 'purchased')`),
}));
```

Add relations at the bottom:

```ts
export const shoppingListItemsRelations = relations(shoppingListItems, ({ one }) => ({
  household: one(households, {
    fields: [shoppingListItems.householdId],
    references: [households.id],
  }),
  addedByUser: one(users, {
    fields: [shoppingListItems.addedBy],
    references: [users.id],
  }),
  sourceItem: one(items, {
    fields: [shoppingListItems.sourceItemId],
    references: [items.id],
  }),
}));
```

- [ ] **Step 2: Generate and apply migration**

```bash
cd server && bun run db:generate && bun run db:push
```
Expected: Migration files created in `server/drizzle/`, schema applied to local Postgres.

- [ ] **Step 3: Verify migration applied**

```bash
cd server && bun -e "import('./src/lib/db').then(({db}) => db.select().from((await import('./src/db/schema')).shoppingListItems).then(r => console.log('shopping_list_items OK, rows:', r.length)))"
```
Expected: `shopping_list_items OK, rows: 0`

- [ ] **Step 4: Commit**

```bash
git add server/src/db/schema.ts server/drizzle/
git commit -m "feat(db): add opened column to items and shopping_list_items table"
```

---

### Task 4: OpenAI — add `suggestItemDefaults` function

**Files:**
- Modify: `server/src/lib/openai.ts`

- [ ] **Step 1: Add the function**

Append to `server/src/lib/openai.ts` (after `normalizeItemName`):

```ts
export interface ItemSuggestion {
  unit: string;
  category: string;
  estimatedShelfDays: number;
}

const SuggestionSchema = z.object({
  unit: z.string(),
  category: z.string(),
  estimatedShelfDays: z.number().int().positive(),
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
      system: "You are a grocery expert. Given a food item name, suggest the most common unit of measure, food category, and typical shelf life in days from purchase.",
      messages: [{
        role: "user",
        content: `Item: "${name}"

Valid categories: Dairy, Meat & Poultry, Seafood, Produce, Bread & Bakery, Grains & Pasta, Canned Goods, Condiments & Sauces, Snacks, Beverages, Frozen Foods, Spices & Seasonings, Other

Provide:
- unit: most common unit (e.g. "lb", "oz", "unit", "bunch")
- category: one of the valid categories above
- estimatedShelfDays: typical days until expiry from purchase`,
      }],
    });

    const suggestion = object as ItemSuggestion;
    suggestionCache.set(key, { suggestion, expiresAt: Date.now() + CACHE_TTL });
    return suggestion;
  } catch (error) {
    console.error("Error suggesting item defaults:", error);
    return { unit: "unit", category: "Other", estimatedShelfDays: 7 };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/lib/openai.ts
git commit -m "feat(server): add suggestItemDefaults OpenAI function"
```

---

### Task 5: Server — shopping list routes

**Files:**
- Create: `server/src/routes/shopping-list.ts`

- [ ] **Step 1: Create the route file**

```ts
// server/src/routes/shopping-list.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createShoppingListItemSchema,
  updateShoppingListItemSchema,
} from "@pantrymaid/shared/schemas";
import type {
  CreateShoppingListItemInput,
  UpdateShoppingListItemInput,
} from "@pantrymaid/shared/schemas";
import { authMiddleware, getUser } from "../middleware/auth";
import { db } from "../lib/db";
import { shoppingListItems } from "../db/schema";
import { eq, and } from "drizzle-orm";

function serializeShoppingListItem(row: typeof shoppingListItems.$inferSelect) {
  return { ...row, suggestedQty: Number(row.suggestedQty) };
}

const shoppingList = new Hono();
shoppingList.use("*", authMiddleware);

// GET /shopping-list — list pending items for household
shoppingList.get("/", async (c) => {
  try {
    const user = getUser(c);
    if (!user.householdId) {
      return c.json({ success: true, data: [] });
    }
    const rows = await db
      .select()
      .from(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.householdId, user.householdId),
          eq(shoppingListItems.status, "pending")
        )
      );
    return c.json({ success: true, data: rows.map(serializeShoppingListItem) });
  } catch (error) {
    console.error("Error fetching shopping list:", error);
    return c.json({ success: false, error: "Failed to fetch shopping list" }, 500);
  }
});

// POST /shopping-list — create item
shoppingList.post(
  "/",
  zValidator("json", createShoppingListItemSchema),
  async (c) => {
    try {
      const user = getUser(c);
      if (!user.householdId) {
        return c.json({ success: false, error: "User must belong to a household" }, 403);
      }
      const data = c.req.valid("json") as CreateShoppingListItemInput;
      const [created] = await db
        .insert(shoppingListItems)
        .values({
          name: data.name,
          brand: data.brand,
          category: data.category,
          unit: data.unit,
          suggestedQty: String(data.suggestedQty ?? 1),
          sourceItemId: data.sourceItemId,
          status: "pending",
          householdId: user.householdId,
          addedBy: user.id,
        })
        .returning();
      if (!created) {
        return c.json({ success: false, error: "Failed to create shopping list item" }, 500);
      }
      return c.json({ success: true, data: serializeShoppingListItem(created) }, 201);
    } catch (error) {
      console.error("Error creating shopping list item:", error);
      return c.json({ success: false, error: "Failed to create shopping list item" }, 500);
    }
  }
);

// PATCH /shopping-list/:id — update status
shoppingList.patch(
  "/:id",
  zValidator("json", updateShoppingListItemSchema),
  async (c) => {
    try {
      const user = getUser(c);
      const itemId = c.req.param("id");
      if (!user.householdId) {
        return c.json({ success: false, error: "User must belong to a household" }, 403);
      }
      const updates = c.req.valid("json") as UpdateShoppingListItemInput;
      const [updated] = await db
        .update(shoppingListItems)
        .set({ ...updates, updatedAt: new Date() })
        .where(
          and(
            eq(shoppingListItems.id, itemId),
            eq(shoppingListItems.householdId, user.householdId)
          )
        )
        .returning();
      if (!updated) {
        return c.json({ success: false, error: "Shopping list item not found" }, 404);
      }
      return c.json({ success: true, data: serializeShoppingListItem(updated) });
    } catch (error) {
      console.error("Error updating shopping list item:", error);
      return c.json({ success: false, error: "Failed to update shopping list item" }, 500);
    }
  }
);

// DELETE /shopping-list/:id — remove item
shoppingList.delete("/:id", async (c) => {
  try {
    const user = getUser(c);
    const itemId = c.req.param("id");
    if (!user.householdId) {
      return c.json({ success: false, error: "User must belong to a household" }, 403);
    }
    const result = await db
      .delete(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.id, itemId),
          eq(shoppingListItems.householdId, user.householdId)
        )
      )
      .returning();
    if (result.length === 0) {
      return c.json({ success: false, error: "Shopping list item not found" }, 404);
    }
    return c.json({ success: true, data: null });
  } catch (error) {
    console.error("Error deleting shopping list item:", error);
    return c.json({ success: false, error: "Failed to delete shopping list item" }, 500);
  }
});

export default shoppingList;
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/shopping-list.ts
git commit -m "feat(server): add shopping list CRUD routes"
```

---

### Task 6: Server — `POST /api/items/suggest` endpoint and mount all new routes

**Files:**
- Modify: `server/src/routes/items.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Add suggest endpoint to items.ts**

Add this import at the top of `server/src/routes/items.ts`:

```ts
import { suggestItemDefaults } from "../lib/openai";
import { z } from "zod";
```

Add this route before `export default items;`:

```ts
// POST /items/suggest — AI-powered field suggestions for a named item
items.post(
  "/suggest",
  zValidator("json", z.object({ name: z.string().min(1) })),
  async (c) => {
    try {
      const { name } = c.req.valid("json");
      const suggestion = await suggestItemDefaults(name);
      return c.json({ success: true, data: suggestion });
    } catch (error) {
      console.error("Error suggesting item defaults:", error);
      return c.json({ success: false, error: "Suggestion unavailable" }, 503);
    }
  }
);
```

- [ ] **Step 2: Mount shopping-list route in server/src/index.ts**

Add import after the existing route imports:

```ts
import shoppingList from "./routes/shopping-list";
```

Add mount after the existing `app.route("/api/items", items);` line:

```ts
app.route("/api/shopping-list", shoppingList);
```

Also add `PATCH` to the CORS allowMethods array so it reads:
```ts
allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
```

- [ ] **Step 3: Verify server starts**

```bash
cd server && bun run dev &
sleep 2
curl -s http://localhost:3000/health | grep '"status":"ok"'
kill %1
```
Expected: `"status":"ok"` in response.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/items.ts server/src/index.ts
git commit -m "feat(server): add suggest endpoint and mount shopping-list routes"
```

---

## Phase 2 — Web UI

### Task 7: Web API client — add InventoryItem.opened, shopping list methods, suggest method

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/queryKeys.ts`

- [ ] **Step 1: Add `opened` to `InventoryItem` and `CreateItemDto` in api.ts**

In `InventoryItem`, add:
```ts
opened?: boolean | null;
```

In `CreateItemDto`, add:
```ts
opened?: boolean;
```

Add new type:
```ts
export interface ShoppingListItem {
  id: string;
  householdId: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  unit?: string | null;
  suggestedQty: number;
  sourceItemId?: string | null;
  status: "pending" | "purchased";
  addedBy: string;
  addedAt: string;
  updatedAt: string;
}

export interface CreateShoppingListItemDto {
  name: string;
  brand?: string;
  category?: string;
  unit?: string;
  suggestedQty?: number;
  sourceItemId?: string;
}

export interface ItemSuggestion {
  unit: string;
  category: string;
  estimatedShelfDays: number;
}
```

Append to the `api` object:

```ts
  // Shopping list
  getShoppingList: async (): Promise<ShoppingListItem[]> => {
    const response = await fetchApi<{ success: boolean; data: ShoppingListItem[] }>("/api/shopping-list");
    return response.data;
  },

  addToShoppingList: async (data: CreateShoppingListItemDto): Promise<ShoppingListItem> => {
    const response = await fetchApi<{ success: boolean; data: ShoppingListItem }>("/api/shopping-list", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.data;
  },

  markShoppingListPurchased: async (id: string): Promise<ShoppingListItem> => {
    const response = await fetchApi<{ success: boolean; data: ShoppingListItem }>(`/api/shopping-list/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "purchased" }),
    });
    return response.data;
  },

  deleteShoppingListItem: async (id: string): Promise<void> => {
    await fetchApi<{ success: boolean; data: null }>(`/api/shopping-list/${id}`, {
      method: "DELETE",
    });
  },

  // AI suggest
  suggestItemDefaults: async (name: string): Promise<ItemSuggestion> => {
    const response = await fetchApi<{ success: boolean; data: ItemSuggestion }>("/api/items/suggest", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return response.data;
  },
```

- [ ] **Step 2: Add shopping list query keys**

Add to `apps/web/src/lib/queryKeys.ts`:

```ts
  shoppingList: {
    all: ["shoppingList"] as const,
    lists: () => [...queryKeys.shoppingList.all, "list"] as const,
  },
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/queryKeys.ts
git commit -m "feat(web): add shopping list and suggest API client methods"
```

---

### Task 8: Web — `QuickAddPresets` component

**Files:**
- Create: `apps/web/src/components/inventory/QuickAddPresets.tsx`
- Create: `apps/web/src/test/components/QuickAddPresets.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// apps/web/src/test/components/QuickAddPresets.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickAddPresets } from "@/components/inventory/QuickAddPresets";

const onSelect = vi.fn();

describe("QuickAddPresets", () => {
  it("renders search input", () => {
    render(<QuickAddPresets onSelect={onSelect} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it("filters presets by name", () => {
    render(<QuickAddPresets onSelect={onSelect} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "apple" },
    });
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("Salmon Fillet")).not.toBeInTheDocument();
  });

  it("calls onSelect with preset data when item clicked", () => {
    render(<QuickAddPresets onSelect={onSelect} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "apple" },
    });
    fireEvent.click(screen.getByText("Apple"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Apple", unit: "lb", category: "Produce" })
    );
  });

  it("shows AI suggest button after 3 chars with no match", () => {
    render(<QuickAddPresets onSelect={onSelect} isSuggestLoading={false} onAISuggest={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "xyz" },
    });
    expect(screen.getByRole("button", { name: /ai suggest/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/web && pnpm test QuickAddPresets
```
Expected: FAIL — component not found.

- [ ] **Step 3: Implement component**

```tsx
// apps/web/src/components/inventory/QuickAddPresets.tsx
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { ITEM_PRESETS } from "@pantrymaid/shared/constants";
import type { ItemPreset } from "@pantrymaid/shared/constants";

interface QuickAddPresetsProps {
  onSelect: (preset: ItemPreset) => void;
  onAISuggest?: (query: string) => void;
  isSuggestLoading?: boolean;
}

export function QuickAddPresets({ onSelect, onAISuggest, isSuggestLoading }: QuickAddPresetsProps) {
  const [query, setQuery] = useState("");

  const filtered = query.trim().length === 0
    ? []
    : ITEM_PRESETS.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8);

  const showAISuggest = query.trim().length >= 3 && filtered.length === 0;

  return (
    <div className="space-y-2">
      <Input
        placeholder="Search common items..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-9"
      />
      {filtered.length > 0 && (
        <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
          {filtered.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors flex justify-between items-center"
              onClick={() => { onSelect(preset); setQuery(""); }}
            >
              <span className="font-medium">{preset.name}</span>
              <span className="text-xs text-muted-foreground">{preset.unit} · {preset.category}</span>
            </button>
          ))}
        </div>
      )}
      {showAISuggest && onAISuggest && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isSuggestLoading}
          onClick={() => onAISuggest(query.trim())}
        >
          <Sparkles className="h-3 w-3 mr-2" />
          {isSuggestLoading ? "Suggesting..." : "AI Suggest"}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm test QuickAddPresets
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/inventory/QuickAddPresets.tsx apps/web/src/test/components/QuickAddPresets.test.tsx
git commit -m "feat(web): add QuickAddPresets component with AI suggest fallback"
```

---

### Task 9: Web — update `AddItemDialog` (units, opened, duplicate detection, presets)

**Files:**
- Modify: `apps/web/src/components/inventory/AddItemDialog.tsx`

- [ ] **Step 1: Replace hardcoded units with COMMON_UNITS, add preset picker, opened toggle, duplicate detection**

Replace the entire file contents with:

```tsx
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Package } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type InventoryItem, type CreateItemDto } from "@/lib/api";
import type { ItemLocation } from "@pantrymaid/shared/schemas";
import { FOOD_CATEGORIES, COMMON_UNITS } from "@pantrymaid/shared/constants";
import type { ItemPreset } from "@pantrymaid/shared/constants";
import { QuickAddPresets } from "./QuickAddPresets";
import { queryKeys } from "@/lib/queryKeys";

interface ScannedProduct {
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  barcode: string;
}

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateItemDto) => void;
  editItem?: InventoryItem | null;
  defaultLocation?: ItemLocation;
  scannedProduct?: ScannedProduct | null;
  barcodeNotice?: string | null;
}

const emptyForm = (defaultLocation?: ItemLocation): CreateItemDto => ({
  name: "",
  quantity: 1,
  unit: "unit",
  location: defaultLocation ?? "pantry",
  opened: false,
});

export function AddItemDialog({
  open,
  onOpenChange,
  onSubmit,
  editItem,
  defaultLocation,
  scannedProduct,
  barcodeNotice,
}: AddItemDialogProps) {
  const [formData, setFormData] = useState<CreateItemDto>(emptyForm(defaultLocation));
  const [duplicateWarning, setDuplicateWarning] = useState<InventoryItem | null>(null);
  const nameBlurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: queryKeys.inventory.lists(),
    queryFn: () => api.getItems(),
    enabled: open,
  });

  const suggestMutation = useMutation({
    mutationFn: (name: string) => api.suggestItemDefaults(name),
    onSuccess: (suggestion) => {
      setFormData((prev) => ({
        ...prev,
        unit: suggestion.unit,
        category: suggestion.category,
        expirationDate: suggestion.estimatedShelfDays
          ? new Date(Date.now() + suggestion.estimatedShelfDays * 86400000)
              .toISOString()
              .split("T")[0]
          : prev.expirationDate,
      }));
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setFormData({
        name: editItem.name,
        brand: editItem.brand ?? undefined,
        quantity: editItem.quantity,
        unit: editItem.unit ?? "unit",
        location: editItem.location,
        category: editItem.category ?? undefined,
        expirationDate: editItem.expirationDate ?? undefined,
        barcodeUpc: editItem.barcodeUpc ?? undefined,
        imageUrl: editItem.imageUrl ?? undefined,
        notes: editItem.notes ?? undefined,
        opened: editItem.opened ?? false,
      });
    } else if (scannedProduct) {
      setFormData({
        name: scannedProduct.name,
        brand: scannedProduct.brand,
        quantity: 1,
        unit: "unit",
        location: defaultLocation ?? "pantry",
        category: scannedProduct.category,
        imageUrl: scannedProduct.imageUrl,
        barcodeUpc: scannedProduct.barcode,
        opened: false,
      });
    } else {
      setFormData(emptyForm(defaultLocation));
    }
    setDuplicateWarning(null);
  }, [editItem, scannedProduct, open, defaultLocation]);

  const handleNameBlur = () => {
    if (editItem || !formData.name.trim()) return;
    nameBlurTimeout.current = setTimeout(() => {
      const match = items.find(
        (i) => i.name.toLowerCase() === formData.name.trim().toLowerCase()
      );
      setDuplicateWarning(match ?? null);
    }, 200);
  };

  const handleMerge = () => {
    if (!duplicateWarning) return;
    api.updateItem(duplicateWarning.id, {
      quantity: duplicateWarning.quantity + (formData.quantity || 1),
    }).then(() => {
      setDuplicateWarning(null);
      onOpenChange(false);
    });
  };

  const handlePresetSelect = (preset: ItemPreset) => {
    const expirationDate = new Date(Date.now() + preset.estimatedShelfDays * 86400000)
      .toISOString()
      .split("T")[0];
    setFormData((prev) => ({
      ...prev,
      name: preset.name,
      category: preset.category,
      unit: preset.unit,
      expirationDate,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit Item" : "Add New Item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          {barcodeNotice && (
            <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              {barcodeNotice}
            </div>
          )}

          {!editItem && (
            <Collapsible className="mb-4">
              <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown className="h-3 w-3" />
                Common items
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <QuickAddPresets
                  onSelect={handlePresetSelect}
                  onAISuggest={(name) => suggestMutation.mutate(name)}
                  isSuggestLoading={suggestMutation.isPending}
                />
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setDuplicateWarning(null);
                }}
                onBlur={handleNameBlur}
                required
              />
              {duplicateWarning && (
                <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  You already have <strong>{duplicateWarning.name}</strong> in your{" "}
                  <strong>{duplicateWarning.location}</strong> (qty: {duplicateWarning.quantity}).
                  <div className="flex gap-2 mt-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs"
                      onClick={() => setDuplicateWarning(null)}
                    >
                      Add Anyway
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={handleMerge}
                    >
                      Merge Qty
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={formData.brand || ""}
                onChange={(e) =>
                  setFormData({ ...formData, brand: e.target.value || undefined })
                }
                placeholder="e.g. Pringles"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: parseFloat(e.target.value) })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={formData.unit ?? "unit"}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="location">Location *</Label>
              <Select
                value={formData.location}
                onValueChange={(value: ItemLocation) =>
                  setFormData({ ...formData, location: value })
                }
              >
                <SelectTrigger id="location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pantry">Pantry</SelectItem>
                  <SelectItem value="fridge">Fridge</SelectItem>
                  <SelectItem value="freezer">Freezer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category || ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value || undefined })
                }
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {FOOD_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="expirationDate">Expiry Date</Label>
              <Input
                id="expirationDate"
                type="date"
                value={formData.expirationDate || ""}
                onChange={(e) =>
                  setFormData({ ...formData, expirationDate: e.target.value })
                }
              />
            </div>

            {editItem && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="opened"
                  checked={formData.opened ?? false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, opened: checked === true })
                  }
                />
                <Label htmlFor="opened" className="font-normal cursor-pointer">
                  Mark as opened
                </Label>
              </div>
            )}

            <div>
              <Label htmlFor="imageUrl">Image URL</Label>
              {formData.imageUrl && (
                <div className="mt-1.5 mb-2 w-full h-40 rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
                  <img
                    src={formData.imageUrl}
                    alt={formData.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const sibling = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (sibling) sibling.style.removeProperty("display");
                    }}
                  />
                  <Package className="h-8 w-8 text-muted-foreground/30" style={{ display: "none" }} />
                </div>
              )}
              <Input
                id="imageUrl"
                type="url"
                value={formData.imageUrl || ""}
                onChange={(e) =>
                  setFormData({ ...formData, imageUrl: e.target.value || undefined })
                }
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editItem ? "Update" : "Add"} Item</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Install Collapsible from shadcn if not present**

```bash
cd apps/web && pnpm dlx shadcn@latest add collapsible checkbox 2>/dev/null || true
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && pnpm build 2>&1 | grep -E "error|Error" | head -20
```
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/inventory/AddItemDialog.tsx
git commit -m "feat(web): AddItemDialog — COMMON_UNITS, presets, opened flag, duplicate detection"
```

---

### Task 10: Web — `ItemCard` consume action and opened badge

**Files:**
- Modify: `apps/web/src/components/inventory/ItemCard.tsx`
- Create: `apps/web/src/test/components/ItemCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// apps/web/src/test/components/ItemCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ItemCard } from "@/components/inventory/ItemCard";
import type { InventoryItem } from "@/lib/api";

const baseItem: InventoryItem = {
  id: "1",
  name: "Milk",
  brand: "Organic Valley",
  quantity: 3,
  unit: "unit",
  location: "fridge",
  category: "Dairy",
  expirationDate: null,
  expirationEstimated: false,
  barcodeUpc: null,
  imageUrl: null,
  notes: null,
  opened: false,
  householdId: "hh1",
  addedBy: "u1",
  addedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("ItemCard consume button", () => {
  it("shows consume button when quantity > 0", () => {
    render(<ItemCard item={baseItem} onEdit={vi.fn()} onDelete={vi.fn()} onConsume={vi.fn()} />);
    expect(screen.getByRole("button", { name: /consume/i })).toBeInTheDocument();
  });

  it("hides consume button when quantity is 0", () => {
    render(<ItemCard item={{ ...baseItem, quantity: 0 }} onEdit={vi.fn()} onDelete={vi.fn()} onConsume={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /consume/i })).not.toBeInTheDocument();
  });

  it("calls onConsume with item when clicked", () => {
    const onConsume = vi.fn();
    render(<ItemCard item={baseItem} onEdit={vi.fn()} onDelete={vi.fn()} onConsume={onConsume} />);
    fireEvent.click(screen.getByRole("button", { name: /consume/i }));
    expect(onConsume).toHaveBeenCalledWith(baseItem);
  });
});

describe("ItemCard opened badge", () => {
  it("shows opened badge when opened is true", () => {
    render(<ItemCard item={{ ...baseItem, opened: true }} onEdit={vi.fn()} onDelete={vi.fn()} onConsume={vi.fn()} />);
    expect(screen.getByTitle(/opened/i)).toBeInTheDocument();
  });

  it("does not show opened badge when opened is false", () => {
    render(<ItemCard item={baseItem} onEdit={vi.fn()} onDelete={vi.fn()} onConsume={vi.fn()} />);
    expect(screen.queryByTitle(/opened/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd apps/web && pnpm test ItemCard
```
Expected: FAIL — `onConsume` prop missing.

- [ ] **Step 3: Update ItemCard**

Replace `apps/web/src/components/inventory/ItemCard.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Calendar, Package, Minus, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/lib/api";

interface ItemCardProps {
  item: InventoryItem;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onConsume: (item: InventoryItem) => void;
}

export function ItemCard({ item, onEdit, onDelete, onConsume }: ItemCardProps) {
  const isExpiringSoon = item.expirationDate
    ? new Date(item.expirationDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    : false;

  const isExpired = item.expirationDate
    ? new Date(item.expirationDate) < new Date()
    : false;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
        isExpired
          ? "border-rose-200 dark:border-rose-900/50"
          : isExpiringSoon
            ? "border-amber-200 dark:border-amber-900/50"
            : "border-border",
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
          isExpired ? "bg-rose-500" : isExpiringSoon ? "bg-amber-400" : "bg-emerald-400",
        )}
      />

      <div className="pl-4 pr-3 py-3 flex items-start gap-3">
        <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-secondary flex items-center justify-center">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const sibling = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (sibling) sibling.style.display = "flex";
              }}
            />
          ) : null}
          <Package
            className="h-5 w-5 text-muted-foreground"
            style={item.imageUrl ? { display: "none" } : undefined}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h3 className="font-semibold text-sm leading-snug truncate">{item.name}</h3>
                {item.opened && (
                  <PackageOpen
                    className="h-3 w-3 text-amber-500 shrink-0"
                    title="Opened"
                    aria-label="Opened"
                  />
                )}
              </div>
              {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
            </div>
            <div className="flex gap-0.5 shrink-0 -mt-0.5 opacity-60 hover:opacity-100 transition-opacity">
              {item.quantity > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-lg"
                  title="Consume one"
                  aria-label="Consume one"
                  onClick={() => onConsume(item)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-lg"
                onClick={() => onEdit(item)}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-lg"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium">
              {item.quantity} {item.unit}
            </span>
            {item.category && (
              <span className="text-xs text-muted-foreground">{item.category}</span>
            )}
          </div>

          {item.expirationDate && (
            <div className="flex items-center gap-1 mt-1.5">
              <Calendar className="h-3 w-3 shrink-0" />
              <span
                className={cn(
                  "text-xs",
                  isExpired
                    ? "text-rose-500 font-medium"
                    : isExpiringSoon
                      ? "text-amber-500 font-medium"
                      : "text-muted-foreground",
                )}
              >
                {isExpired ? "Expired " : isExpiringSoon ? "Expires " : ""}
                {new Date(item.expirationDate).toLocaleDateString()}
              </span>
            </div>
          )}

          {item.notes && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{item.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm test ItemCard
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/inventory/ItemCard.tsx apps/web/src/test/components/ItemCard.test.tsx
git commit -m "feat(web): ItemCard consume button and opened badge"
```

---

### Task 11: Web — `ShoppingListPanel` component

**Files:**
- Create: `apps/web/src/components/inventory/ShoppingListPanel.tsx`
- Create: `apps/web/src/test/components/ShoppingListPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// apps/web/src/test/components/ShoppingListPanel.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShoppingListPanel } from "@/components/inventory/ShoppingListPanel";
import type { ShoppingListItem } from "@/lib/api";

const items: ShoppingListItem[] = [
  {
    id: "sl1",
    householdId: "hh1",
    name: "Milk",
    brand: "Organic Valley",
    unit: "unit",
    suggestedQty: 1,
    status: "pending",
    addedBy: "u1",
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("ShoppingListPanel", () => {
  it("renders shopping list items", () => {
    render(
      <ShoppingListPanel
        items={items}
        onPurchased={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText("Milk")).toBeInTheDocument();
  });

  it("shows empty state when no items", () => {
    render(
      <ShoppingListPanel items={[]} onPurchased={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText(/nothing on the re-order list/i)).toBeInTheDocument();
  });

  it("calls onPurchased when Purchased button clicked", () => {
    const onPurchased = vi.fn();
    render(
      <ShoppingListPanel items={items} onPurchased={onPurchased} onDelete={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /purchased/i }));
    expect(onPurchased).toHaveBeenCalledWith(items[0]);
  });

  it("calls onDelete when delete button clicked", () => {
    const onDelete = vi.fn();
    render(
      <ShoppingListPanel items={items} onPurchased={vi.fn()} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onDelete).toHaveBeenCalledWith("sl1");
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd apps/web && pnpm test ShoppingListPanel
```

- [ ] **Step 3: Implement component**

```tsx
// apps/web/src/components/inventory/ShoppingListPanel.tsx
import { Button } from "@/components/ui/button";
import { ShoppingCart, Trash2, Check } from "lucide-react";
import type { ShoppingListItem } from "@/lib/api";

interface ShoppingListPanelProps {
  items: ShoppingListItem[];
  onPurchased: (item: ShoppingListItem) => void;
  onDelete: (id: string) => void;
}

export function ShoppingListPanel({ items, onPurchased, onDelete }: ShoppingListPanelProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <ShoppingCart className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">Nothing on the re-order list</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {[item.brand, item.suggestedQty && `qty ${item.suggestedQty}`, item.unit]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 h-7 text-xs"
            onClick={() => onPurchased(item)}
          >
            <Check className="h-3 w-3 mr-1" />
            Purchased
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-7 w-7 text-muted-foreground"
            aria-label="Remove"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm test ShoppingListPanel
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/inventory/ShoppingListPanel.tsx apps/web/src/test/components/ShoppingListPanel.test.tsx
git commit -m "feat(web): add ShoppingListPanel component"
```

---

### Task 12: Web — wire consume action, shopping list, and opened into `InventoryPage`

**Files:**
- Modify: `apps/web/src/pages/InventoryPage.tsx`
- Modify: `apps/web/src/components/inventory/ItemList.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update ItemList to pass onConsume through**

In `apps/web/src/components/inventory/ItemList.tsx`, update `ItemListProps` and every `ItemCard` render:

```tsx
interface ItemListProps {
  items: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onConsume: (item: InventoryItem) => void;   // ADD THIS
}

// In the ItemCard render inside the groups.map:
<ItemCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} onConsume={onConsume} />
```

Also update the `export function ItemList` signature to destructure `onConsume`:
```tsx
export function ItemList({ items, onEdit, onDelete, onConsume }: ItemListProps) {
```

- [ ] **Step 2: Update LocationSection in InventoryPage to accept onConsume**

In `InventoryPage.tsx`, update the `LocationSection` component definition:

```tsx
function LocationSection({
  title, icon: Icon, items, color, onAdd, onEdit, onDelete, onConsume,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: InventoryItem[];
  color: "violet" | "blue" | "cyan";
  onAdd: () => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onConsume: (item: InventoryItem) => void;   // ADD THIS
}) {
  return (
    <div data-testid={`section-${title.toLowerCase()}`}>
      {/* ... existing header ... */}
      <ItemList items={items} onEdit={onEdit} onDelete={onDelete} onConsume={onConsume} />
    </div>
  );
}
```

- [ ] **Step 3: Add shopping list query, consume mutation, and re-order modal state to InventoryPage**

Add these imports to `InventoryPage.tsx`:

```tsx
import { ShoppingListPanel } from "@/components/inventory/ShoppingListPanel";
import { ShoppingCart } from "lucide-react";
import type { ShoppingListItem } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
```

Add state and queries after existing state declarations:

```tsx
const [reorderOpen, setReorderOpen] = useState(false);
const [consumePromptItem, setConsumePromptItem] = useState<InventoryItem | null>(null);

const { data: shoppingListItems = [] } = useQuery({
  queryKey: queryKeys.shoppingList.lists(),
  queryFn: () => api.getShoppingList(),
});

const addToShoppingListMutation = useMutation({
  mutationFn: (item: InventoryItem) =>
    api.addToShoppingList({
      name: item.name,
      brand: item.brand ?? undefined,
      category: item.category ?? undefined,
      unit: item.unit ?? undefined,
      suggestedQty: 1,
      sourceItemId: item.id,
    }),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.lists() });
  },
});

const deleteShoppingListMutation = useMutation({
  mutationFn: (id: string) => api.deleteShoppingListItem(id),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.lists() });
  },
});

const consumeMutation = useMutation({
  mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
    api.updateItem(id, { quantity }),
  onSuccess: (updated, { id }) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
    if (updated && updated.quantity === 0) {
      const sourceItem = items.find((i) => i.id === id);
      if (sourceItem) setConsumePromptItem(sourceItem);
    }
  },
});
```

Add the consume handler:

```tsx
const handleConsume = (item: InventoryItem) => {
  consumeMutation.mutate({ id: item.id, quantity: item.quantity - 1 });
};

const handleReorderConfirm = (item: InventoryItem) => {
  void addToShoppingListMutation.mutateAsync({
    name: item.name,
    brand: item.brand ?? undefined,
    category: item.category ?? undefined,
    unit: item.unit ?? undefined,
    suggestedQty: 1,
    sourceItemId: item.id,
  });
  setConsumePromptItem(null);
};

const handleShoppingListPurchased = (slItem: ShoppingListItem) => {
  void api.markShoppingListPurchased(slItem.id).then(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.lists() });
    setDefaultLocation("pantry");
    setEditItem(null);
    setScannedProduct({
      name: slItem.name,
      brand: slItem.brand ?? undefined,
      category: slItem.category ?? undefined,
      barcode: "",
    });
    setAddDialogOpen(true);
  });
};
```

Add the consume-to-zero prompt dialog and shopping list panel to the JSX (before the closing `</div>` of the page):

```tsx
{/* Consume-to-zero re-order prompt */}
{consumePromptItem && (
  <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
    <div className="bg-card border rounded-2xl p-6 max-w-sm w-full shadow-xl">
      <p className="text-sm font-medium mb-1">You&apos;re out of {consumePromptItem.name}</p>
      <p className="text-xs text-muted-foreground mb-4">Add it to your re-order list?</p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setConsumePromptItem(null)}
        >
          No thanks
        </Button>
        <Button
          className="flex-1"
          onClick={() => handleReorderConfirm(consumePromptItem)}
        >
          Add to Re-order
        </Button>
      </div>
    </div>
  </div>
)}

{/* Shopping list panel (slide-in or inline) */}
{reorderOpen && (
  <div className="fixed inset-y-0 right-0 z-40 w-80 bg-background border-l shadow-xl flex flex-col">
    <div className="flex items-center justify-between px-4 py-4 border-b">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-4 w-4" />
        <h3 className="font-semibold text-sm">Re-order List</h3>
        {shoppingListItems.length > 0 && (
          <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
            {shoppingListItems.length}
          </span>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReorderOpen(false)}>
        ×
      </Button>
    </div>
    <div className="flex-1 overflow-y-auto p-4">
      <ShoppingListPanel
        items={shoppingListItems}
        onPurchased={handleShoppingListPurchased}
        onDelete={(id) => deleteShoppingListMutation.mutate(id)}
      />
    </div>
  </div>
)}
```

Pass `onConsume={handleConsume}` to all three `LocationSection` components, and `onConsume` through `LocationSection` → `ItemList` → `ItemCard`.

- [ ] **Step 4: Add re-order nav item to Sidebar**

In `apps/web/src/components/layout/Sidebar.tsx`, accept `reorderCount` and `onReorderClick` props and add a nav button showing the count badge.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/web && pnpm build 2>&1 | grep -i error | head -20
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/InventoryPage.tsx apps/web/src/components/inventory/ItemList.tsx apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat(web): wire consume, re-order prompt, and shopping list panel"
```

---

## Phase 3 — Mobile

### Task 13: Mobile — update SQLite schema for `opened` and `shopping_list_items`

**Files:**
- Modify: `apps/mobile/src/lib/db.ts`

- [ ] **Step 1: Add `opened` column to items table and create `shopping_list_items` SQLite table**

In `initDatabase()`, update the items table creation and add the new table. The key changes:

1. Add `opened INTEGER DEFAULT 0` to the items CREATE TABLE statement.
2. Add a migration guard for existing DBs (ALTER TABLE IF NOT EXISTS column add).
3. Add the shopping list table creation.
4. Add `LocalShoppingListItem` interface.

Update the `initDatabase` function:

```ts
await db.execAsync(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    householdId TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    location TEXT NOT NULL CHECK (location IN ('pantry', 'fridge', 'freezer')),
    quantity REAL DEFAULT 1,
    unit TEXT,
    barcodeUpc TEXT,
    expirationDate TEXT,
    expirationEstimated INTEGER DEFAULT 0,
    opened INTEGER DEFAULT 0,
    addedBy TEXT NOT NULL,
    addedAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    notes TEXT
  );
`);

// Migration: add opened column if it doesn't exist (for existing installs)
await db.execAsync(`
  ALTER TABLE items ADD COLUMN opened INTEGER DEFAULT 0;
`).catch(() => { /* column already exists */ });

await db.execAsync(`
  CREATE TABLE IF NOT EXISTS shopping_list_items (
    id TEXT PRIMARY KEY,
    householdId TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    unit TEXT,
    suggestedQty REAL DEFAULT 1,
    sourceItemId TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'purchased')),
    addedBy TEXT NOT NULL,
    addedAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`);

await db.execAsync(`
  CREATE INDEX IF NOT EXISTS idx_shopping_list_household ON shopping_list_items(householdId);
`);
```

Add `LocalShoppingListItem` interface and CRUD functions after the existing item functions:

```ts
export interface LocalShoppingListItem {
  id: string;
  householdId: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string | null;
  suggestedQty: number;
  sourceItemId: string | null;
  status: "pending" | "purchased";
  addedBy: string;
  addedAt: string;
  updatedAt: string;
}

export async function getShoppingListItems(): Promise<LocalShoppingListItem[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalShoppingListItem>(
    "SELECT * FROM shopping_list_items WHERE status = 'pending' ORDER BY addedAt DESC"
  );
}

export async function insertShoppingListItem(item: LocalShoppingListItem): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO shopping_list_items
      (id, householdId, name, brand, category, unit, suggestedQty, sourceItemId, status, addedBy, addedAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [item.id, item.householdId, item.name, item.brand, item.category, item.unit,
     item.suggestedQty, item.sourceItemId, item.status, item.addedBy, item.addedAt, item.updatedAt]
  );
}

export async function updateShoppingListItem(id: string, status: "pending" | "purchased"): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    "UPDATE shopping_list_items SET status = ?, updatedAt = ? WHERE id = ?",
    [status, new Date().toISOString(), id]
  );
}

export async function deleteShoppingListItem(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM shopping_list_items WHERE id = ?", [id]);
}

export async function clearAllShoppingListItems(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM shopping_list_items");
}
```

Also update `LocalItem` to include `opened: number`, `localItemToItem` to include `opened: local.opened === 1`, `itemToLocalItem` to include `opened: item.opened ? 1 : 0`, and the `insertItem` / `updateItem` SQL to include the `opened` column.

Update `insertItem` SQL:
```ts
await database.runAsync(
  `INSERT INTO items (
    id, householdId, name, brand, category, location, quantity, unit,
    barcodeUpc, expirationDate, expirationEstimated, opened, addedBy, addedAt, updatedAt, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [ localItem.id, localItem.householdId, localItem.name, localItem.brand,
    localItem.category, localItem.location, localItem.quantity, localItem.unit,
    localItem.barcodeUpc, localItem.expirationDate, localItem.expirationEstimated,
    localItem.opened, localItem.addedBy, localItem.addedAt, localItem.updatedAt, localItem.notes ]
);
```

Update `updateItem` SQL SET clause to include `opened = ?,`.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/lib/db.ts
git commit -m "feat(mobile): add opened column and shopping_list_items SQLite table"
```

---

### Task 14: Mobile — sync.ts shopping list offline operations

**Files:**
- Modify: `apps/mobile/src/lib/sync.ts`

- [ ] **Step 1: Add shopping list offline functions and sync support**

Add imports at the top of `sync.ts`:

```ts
import {
  getShoppingListItems,
  insertShoppingListItem,
  updateShoppingListItem,
  deleteShoppingListItem,
  clearAllShoppingListItems,
  type LocalShoppingListItem,
} from "./db";
import type { CreateShoppingListItemInput } from "@pantrymaid/shared";
```

Add shopping list sync to `syncQueue()` — add an `else if` branch inside the `for (const entry of queue)` loop:

```ts
} else if (entry.tableName === "shopping_list_items") {
  if (entry.action === "create") {
    const result = await apiClient.createShoppingListItem(entry.data as CreateShoppingListItemInput);
    if (result.success) await removeSyncQueueEntry(entry.id);
  } else if (entry.action === "update") {
    const result = await apiClient.updateShoppingListItem(entry.recordId, entry.data as { status: string });
    if (result.success) await removeSyncQueueEntry(entry.id);
  } else if (entry.action === "delete") {
    const result = await apiClient.deleteShoppingListItem(entry.recordId);
    if (result.success) await removeSyncQueueEntry(entry.id);
  }
}
```

Add shopping list server sync to `syncFromServer()`:

```ts
// After clearing and re-inserting items, also sync shopping list:
await clearAllShoppingListItems();
const slResult = await apiClient.getShoppingList();
if (slResult.success && slResult.data) {
  for (const slItem of slResult.data) {
    await insertShoppingListItem({
      id: slItem.id,
      householdId: slItem.householdId,
      name: slItem.name,
      brand: slItem.brand ?? null,
      category: slItem.category ?? null,
      unit: slItem.unit ?? null,
      suggestedQty: slItem.suggestedQty,
      sourceItemId: slItem.sourceItemId ?? null,
      status: slItem.status,
      addedBy: slItem.addedBy,
      addedAt: slItem.addedAt,
      updatedAt: slItem.updatedAt,
    });
  }
}
```

Add offline CRUD functions at the bottom of sync.ts:

```ts
export async function createShoppingListItemOffline(data: CreateShoppingListItemInput): Promise<LocalShoppingListItem> {
  const now = new Date().toISOString();
  const item: LocalShoppingListItem = {
    id: generateUUID(),
    householdId: "local",
    name: data.name,
    brand: data.brand ?? null,
    category: data.category ?? null,
    unit: data.unit ?? null,
    suggestedQty: data.suggestedQty ?? 1,
    sourceItemId: data.sourceItemId ?? null,
    status: "pending",
    addedBy: "local",
    addedAt: now,
    updatedAt: now,
  };
  await insertShoppingListItem(item);
  await addToSyncQueue("INSERT", "shopping_list_items", item.id, data);
  syncQueue();
  return item;
}

export async function markShoppingListPurchasedOffline(id: string): Promise<void> {
  await updateShoppingListItem(id, "purchased");
  await addToSyncQueue("UPDATE", "shopping_list_items", id, { status: "purchased" });
  syncQueue();
}

export async function deleteShoppingListItemOffline(id: string): Promise<void> {
  await deleteShoppingListItem(id);
  await addToSyncQueue("DELETE", "shopping_list_items", id, {});
  syncQueue();
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/lib/sync.ts
git commit -m "feat(mobile): add shopping list offline sync operations"
```

---

### Task 15: Mobile — `UnitPicker` component and wire into add/barcode screens

**Files:**
- Create: `apps/mobile/src/components/UnitPicker.tsx`
- Modify: `apps/mobile/app/(tabs)/add.tsx`
- Modify: `apps/mobile/app/barcode.tsx`

- [ ] **Step 1: Create UnitPicker**

```tsx
// apps/mobile/src/components/UnitPicker.tsx
import { useState } from "react";
import {
  View, Text, TouchableOpacity, Modal, FlatList, TextInput,
} from "react-native";
import { COMMON_UNITS } from "@pantrymaid/shared/constants";
import { ChevronDown, X } from "lucide-react-native";

interface UnitPickerProps {
  value: string;
  onChange: (unit: string) => void;
}

export function UnitPicker({ value, onChange }: UnitPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? COMMON_UNITS.filter((u) => u.toLowerCase().includes(query.toLowerCase()))
    : COMMON_UNITS;

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className="border border-gray-300 rounded-lg px-3 py-2 flex-row items-center justify-between bg-white"
      >
        <Text className="text-base text-gray-900">{value || "Select unit"}</Text>
        <ChevronDown color="#6b7280" size={16} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200 bg-white">
            <Text className="text-lg font-semibold text-gray-900">Select Unit</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <X color="#374151" size={24} />
            </TouchableOpacity>
          </View>
          <View className="px-4 py-3 bg-white border-b border-gray-100">
            <TextInput
              placeholder="Search units..."
              value={query}
              onChangeText={setQuery}
              className="border border-gray-300 rounded-lg px-3 py-2 text-base"
              autoFocus
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                className={`px-4 py-3 border-b border-gray-100 bg-white ${value === item ? "bg-blue-50" : ""}`}
                onPress={() => { onChange(item); setOpen(false); setQuery(""); }}
              >
                <Text className={`text-base ${value === item ? "text-blue-600 font-semibold" : "text-gray-900"}`}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Replace unit TextInput in add.tsx**

In `apps/mobile/app/(tabs)/add.tsx`:

Add import: `import { UnitPicker } from "../../src/components/UnitPicker";`

Replace the unit TextInput block:
```tsx
<View className="mb-4">
  <Text className="text-sm text-gray-700 mb-1">Unit</Text>
  <UnitPicker value={form.unit} onChange={(unit) => setForm({ ...form, unit })} />
</View>
```

- [ ] **Step 3: Replace unit TextInput in barcode.tsx**

Same replacement in `apps/mobile/app/barcode.tsx` — add import and replace the unit TextInput.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/UnitPicker.tsx apps/mobile/app/\(tabs\)/add.tsx apps/mobile/app/barcode.tsx
git commit -m "feat(mobile): add UnitPicker component and wire into add/barcode screens"
```

---

### Task 16: Mobile — quick-add preset screen

**Files:**
- Create: `apps/mobile/app/quick-add.tsx`
- Modify: `apps/mobile/app/(tabs)/add.tsx`

- [ ] **Step 1: Create quick-add screen**

```tsx
// apps/mobile/app/quick-add.tsx
import { useState } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { X, Sparkles } from "lucide-react-native";
import { ITEM_PRESETS } from "@pantrymaid/shared/constants";
import type { ItemPreset } from "@pantrymaid/shared/constants";
import { isOnline } from "../src/lib/sync";
import { apiClient } from "../src/lib/api";

export default function QuickAddScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggesting, setSuggesting] = useState(false);

  const filtered = query.trim().length === 0
    ? ITEM_PRESETS
    : ITEM_PRESETS.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = (preset: ItemPreset) => {
    const expirationDate = new Date(Date.now() + preset.estimatedShelfDays * 86400000)
      .toISOString()
      .split("T")[0];
    router.push({
      pathname: "/(tabs)/add",
      params: {
        prefillName: preset.name,
        prefillCategory: preset.category,
        prefillUnit: preset.unit,
        prefillExpiry: expirationDate,
      },
    });
  };

  const handleAISuggest = async () => {
    if (query.trim().length < 3) return;
    const online = await isOnline();
    if (!online) {
      Alert.alert("Offline", "AI suggest requires an internet connection.");
      return;
    }
    setSuggesting(true);
    try {
      const result = await apiClient.suggestItemDefaults(query.trim());
      if (result.success && result.data) {
        const { unit, category, estimatedShelfDays } = result.data;
        const expirationDate = new Date(Date.now() + estimatedShelfDays * 86400000)
          .toISOString()
          .split("T")[0];
        router.push({
          pathname: "/(tabs)/add",
          params: {
            prefillName: query.trim(),
            prefillCategory: category,
            prefillUnit: unit,
            prefillExpiry: expirationDate,
          },
        });
      }
    } catch {
      Alert.alert("Error", "Couldn't suggest defaults — fill in manually.");
    } finally {
      setSuggesting(false);
    }
  };

  const showAISuggest = query.trim().length >= 3 && filtered.length === 0;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
        <Text className="text-lg font-semibold text-gray-900">Common Items</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <X color="#374151" size={24} />
        </TouchableOpacity>
      </View>
      <View className="px-4 py-3 bg-white border-b border-gray-100">
        <TextInput
          placeholder="Search items..."
          value={query}
          onChangeText={setQuery}
          className="border border-gray-300 rounded-lg px-3 py-2 text-base"
          autoFocus
        />
      </View>
      {showAISuggest && (
        <TouchableOpacity
          onPress={handleAISuggest}
          disabled={suggesting}
          className="mx-4 mt-3 bg-violet-600 py-3 rounded-lg flex-row items-center justify-center"
        >
          <Sparkles color="#ffffff" size={16} />
          <Text className="text-white font-semibold ml-2">
            {suggesting ? "Suggesting..." : "AI Suggest"}
          </Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="px-4 py-3 border-b border-gray-100 bg-white flex-row justify-between items-center"
            onPress={() => handleSelect(item)}
          >
            <Text className="text-base text-gray-900 font-medium">{item.name}</Text>
            <Text className="text-xs text-gray-500">{item.unit} · {item.category}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 2: Add duplicate detection to add.tsx name field**

In `apps/mobile/app/(tabs)/add.tsx`, import `getItemsByLocation` and add a duplicate check on name change:

```tsx
import { getItemsByLocation } from "../../src/lib/db";
import type { Item } from "@pantrymaid/shared";

// Add state inside AddScreen:
const [duplicateItem, setDuplicateItem] = useState<Item | null>(null);

// Add check function:
const checkDuplicate = async (name: string) => {
  if (!name.trim()) { setDuplicateItem(null); return; }
  const allItems = [
    ...(await getItemsByLocation("pantry")),
    ...(await getItemsByLocation("fridge")),
    ...(await getItemsByLocation("freezer")),
  ];
  const match = allItems.find((i) => i.name.toLowerCase() === name.trim().toLowerCase());
  setDuplicateItem(match ?? null);
};

// On name TextInput, add onBlur:
onBlur={() => checkDuplicate(form.name)}

// After the name TextInput, add conditional duplicate alert:
{duplicateItem && (
  <View className="mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
    <Text className="text-xs text-amber-800">
      Already have {duplicateItem.name} in {duplicateItem.location} (qty: {duplicateItem.quantity}).
    </Text>
    <View className="flex-row gap-2 mt-1">
      <TouchableOpacity
        onPress={() => setDuplicateItem(null)}
        className="bg-white border border-amber-300 rounded px-2 py-1"
      >
        <Text className="text-xs text-amber-800">Add Anyway</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={async () => {
          await updateItemOffline(duplicateItem.id, {
            quantity: duplicateItem.quantity + (parseFloat(form.quantity) || 1),
          });
          Alert.alert("Merged", `Quantity updated to ${duplicateItem.quantity + (parseFloat(form.quantity) || 1)}`);
          setDuplicateItem(null);
          setForm({ name: "", brand: "", category: "", location: "pantry", quantity: "1", unit: "" });
        }}
        className="bg-amber-600 rounded px-2 py-1"
      >
        <Text className="text-xs text-white">Merge Qty</Text>
      </TouchableOpacity>
    </View>
  </View>
)}
```

Also add `import { updateItemOffline } from "../../src/lib/sync";` at the top.

- [ ] **Step 3: Add quick-add button to add.tsx and handle prefill params**

In `apps/mobile/app/(tabs)/add.tsx`, add:

```tsx
import { useLocalSearchParams } from "expo-router";

// Inside AddScreen, after router declaration:
const params = useLocalSearchParams<{
  prefillName?: string;
  prefillCategory?: string;
  prefillUnit?: string;
  prefillExpiry?: string;
}>();

// Update initial state and useEffect to apply prefills:
useEffect(() => {
  if (params.prefillName) {
    setForm((prev) => ({
      ...prev,
      name: params.prefillName ?? prev.name,
      category: params.prefillCategory ?? prev.category,
      unit: params.prefillUnit ?? prev.unit,
    }));
  }
}, [params.prefillName]);
```

Add a "Browse Common Items" button above the Manual Entry card:

```tsx
<TouchableOpacity
  onPress={() => router.push("/quick-add")}
  className="bg-violet-600 py-4 rounded-lg flex-row items-center justify-center mb-3"
>
  <Text className="text-white font-semibold text-base">Browse Common Items</Text>
</TouchableOpacity>
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/quick-add.tsx apps/mobile/app/\(tabs\)/add.tsx
git commit -m "feat(mobile): quick-add preset screen with AI suggest fallback"
```

---

### Task 17: Mobile — consume action in location tabs and re-order tab

**Files:**
- Modify: `apps/mobile/app/(tabs)/pantry.tsx`
- Modify: `apps/mobile/app/(tabs)/fridge.tsx`
- Modify: `apps/mobile/app/(tabs)/freezer.tsx`
- Create: `apps/mobile/app/(tabs)/reorder.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Read current pantry tab to understand item card pattern**

```bash
cat /workspace/pantryradar-worktrees/Byzantines/apps/mobile/app/\(tabs\)/pantry.tsx
```

- [ ] **Step 2: Add consume button to each location tab's item card render**

For each of `pantry.tsx`, `fridge.tsx`, `freezer.tsx`, add a `handleConsume` function and a consume button in the item row. Pattern (apply same to all three):

```tsx
// Import at top:
import { Minus } from "lucide-react-native";
import { updateItemOffline, createShoppingListItemOffline } from "../../src/lib/sync";

// Handler:
const handleConsume = async (item: Item) => {
  const newQty = item.quantity - 1;
  await updateItemOffline(item.id, { quantity: newQty });
  setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, quantity: newQty } : i));
  if (newQty === 0) {
    Alert.alert(
      "You're out",
      `Add ${item.name} to your re-order list?`,
      [
        { text: "No thanks", style: "cancel" },
        {
          text: "Add to Re-order",
          onPress: async () => {
            await createShoppingListItemOffline({
              name: item.name,
              brand: item.brand ?? undefined,
              category: item.category ?? undefined,
              unit: item.unit ?? undefined,
              suggestedQty: 1,
              sourceItemId: item.id,
            });
          },
        },
      ]
    );
  }
};

// In item row JSX, add consume button (only when quantity > 0):
{item.quantity > 0 && (
  <TouchableOpacity
    onPress={() => handleConsume(item)}
    className="p-1.5 rounded-full bg-gray-100 mr-1"
  >
    <Minus color="#374151" size={14} />
  </TouchableOpacity>
)}
```

- [ ] **Step 3: Create re-order tab**

```tsx
// apps/mobile/app/(tabs)/reorder.tsx
import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Alert, RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ShoppingCart, Check, Trash2 } from "lucide-react-native";
import {
  getShoppingListItems,
  type LocalShoppingListItem,
} from "../../src/lib/db";
import {
  markShoppingListPurchasedOffline,
  deleteShoppingListItemOffline,
} from "../../src/lib/sync";

export default function ReorderScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LocalShoppingListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const rows = await getShoppingListItems();
    setItems(rows);
  };

  useFocusEffect(useCallback(() => { void load(); }, []));

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handlePurchased = async (item: LocalShoppingListItem) => {
    await markShoppingListPurchasedOffline(item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    // Pre-fill add form
    router.push({
      pathname: "/(tabs)/add",
      params: {
        prefillName: item.name,
        prefillCategory: item.category ?? "",
        prefillUnit: item.unit ?? "",
      },
    });
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Remove", "Remove from re-order list?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deleteShoppingListItemOffline(id);
          setItems((prev) => prev.filter((i) => i.id !== id));
        },
      },
    ]);
  };

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-8">
        <ShoppingCart color="#9ca3af" size={40} />
        <Text className="text-gray-500 text-center mt-3">Nothing on the re-order list</Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-gray-50"
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      renderItem={({ item }) => (
        <View className="flex-row items-center bg-white px-4 py-3 border-b border-gray-100">
          <View className="flex-1 min-w-0 mr-3">
            <Text className="text-sm font-semibold text-gray-900 truncate">{item.name}</Text>
            <Text className="text-xs text-gray-500">
              {[item.brand, item.suggestedQty && `qty ${item.suggestedQty}`, item.unit]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handlePurchased(item)}
            className="bg-blue-600 py-1.5 px-3 rounded-lg flex-row items-center mr-2"
          >
            <Check color="#ffffff" size={12} />
            <Text className="text-white text-xs font-semibold ml-1">Purchased</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <Trash2 color="#9ca3af" size={16} />
          </TouchableOpacity>
        </View>
      )}
    />
  );
}
```

- [ ] **Step 4: Update tab layout to add re-order tab**

In `apps/mobile/app/(tabs)/_layout.tsx`:

```tsx
// Add import:
import { ShoppingCart } from "lucide-react-native";

// Add after the "add" Tabs.Screen:
<Tabs.Screen
  name="reorder"
  options={{
    title: "Re-order",
    tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />,
  }}
/>
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(tabs\)/pantry.tsx apps/mobile/app/\(tabs\)/fridge.tsx apps/mobile/app/\(tabs\)/freezer.tsx apps/mobile/app/\(tabs\)/reorder.tsx apps/mobile/app/\(tabs\)/_layout.tsx
git commit -m "feat(mobile): consume action, re-order tab, and shopping list"
```

---

### Task 18: Mobile — add `apiClient` shopping list and suggest methods

**Files:**
- Modify: `apps/mobile/src/lib/api.ts`

- [ ] **Step 1: Check current mobile API client structure**

```bash
cat /workspace/pantryradar-worktrees/Byzantines/apps/mobile/src/lib/api.ts
```

- [ ] **Step 2: Add shopping list and suggest methods**

Add the following types and methods matching the server API (use the same pattern as existing `apiClient` methods):

```ts
// Add types:
export interface ShoppingListItemResponse {
  id: string;
  householdId: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  unit?: string | null;
  suggestedQty: number;
  sourceItemId?: string | null;
  status: "pending" | "purchased";
  addedBy: string;
  addedAt: string;
  updatedAt: string;
}

// Add to apiClient object:
getShoppingList: () =>
  fetchApi<{ success: boolean; data: ShoppingListItemResponse[] }>("/api/shopping-list"),

createShoppingListItem: (data: {
  name: string; brand?: string; category?: string; unit?: string;
  suggestedQty?: number; sourceItemId?: string;
}) =>
  fetchApi<{ success: boolean; data: ShoppingListItemResponse }>("/api/shopping-list", {
    method: "POST",
    body: JSON.stringify(data),
  }),

updateShoppingListItem: (id: string, data: { status: string }) =>
  fetchApi<{ success: boolean; data: ShoppingListItemResponse }>(`/api/shopping-list/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),

deleteShoppingListItem: (id: string) =>
  fetchApi<{ success: boolean; data: null }>(`/api/shopping-list/${id}`, {
    method: "DELETE",
  }),

suggestItemDefaults: (name: string) =>
  fetchApi<{ success: boolean; data: { unit: string; category: string; estimatedShelfDays: number } }>(
    "/api/items/suggest",
    { method: "POST", body: JSON.stringify({ name }) }
  ),
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/api.ts
git commit -m "feat(mobile): add shopping list and suggest API client methods"
```

---

## Phase 4 — Validation

### Task 19: Run full test suite and verify build

- [ ] **Step 1: Run shared package tests**

```bash
cd packages/shared && pnpm test
```
Expected: all PASS — schemas, constants, presets.

- [ ] **Step 2: Run web tests**

```bash
cd apps/web && pnpm test
```
Expected: all PASS.

- [ ] **Step 3: Run web build**

```bash
cd apps/web && pnpm build
```
Expected: no TypeScript errors, bundle produced.

- [ ] **Step 4: Run server lint and build**

```bash
cd server && bun run build
```
Expected: no errors.

- [ ] **Step 5: Start dev server and smoke-test key endpoints**

```bash
cd server && bun run dev &
sleep 2
# Health
curl -s http://localhost:3000/health | grep '"status":"ok"'
kill %1
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final test and build verification for inventory gaps feature"
```
