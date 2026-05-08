# Inventory Gaps & Re-order List — Design Spec

**Date:** 2026-05-08
**Branch:** Byzantines
**Status:** Approved

## Overview

Addresses six gaps in the pantry inventory loading experience, plus adds a new Re-order List feature triggered by the consume action. Recipe/delivery integration and storage location expansion are explicitly out of scope.

## Decisions Summary

| Gap | Decision |
|---|---|
| Units (oz/lbs) | Wire `COMMON_UNITS` from shared constants into web (dropdown) and mobile (picker); expand constant with US units |
| Fresh produce / deli / bulk | 100+ item preset library in shared constants + AI inference fallback via new suggest endpoint |
| Duplicate detection | Warn with optional merge; user can keep separate entries (e.g. different expiry dates) |
| Partial consumption | `opened` boolean flag on item — toggle marks item as in-use without tracking volume |
| Consume action | Decrement by 1; at 0 → prompt to add to Re-order List |
| Re-order List | New `shopping_list_items` table; when purchased → opens add-item flow pre-filled |
| Expiration date type | Keep single date field, no type distinction |
| Recipe/delivery import | Out of scope |

---

## Section 1: Schema

### `items` table — add column
```sql
opened BOOLEAN NOT NULL DEFAULT false
```
Safe default, no backfill required.

### New `shopping_list_items` table
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
household_id   UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE
name           TEXT NOT NULL
brand          TEXT
category       TEXT
unit           TEXT
suggested_qty  NUMERIC NOT NULL DEFAULT 1
source_item_id UUID REFERENCES items(id) ON DELETE SET NULL
status         TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'purchased'))
added_by       TEXT NOT NULL REFERENCES users(id)
added_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
```

`source_item_id` is nullable — users can add to the list manually, not only via consume-to-zero. When the source item is deleted, the shopping list entry survives with `source_item_id` set to null.

Status lifecycle: `pending → purchased`. Deletion replaces "dismissed" — if a user doesn't need an item, they delete it.

---

## Section 2: Shared Package (`packages/shared`)

### `COMMON_UNITS` constant — expand
Add missing US-standard units to the existing constant:
```ts
export const COMMON_UNITS = [
  "unit", "lb", "oz", "fl oz", "kg", "g",
  "gal", "qt", "pt", "cup", "L", "mL",
  "dozen", "can", "jar", "box", "bag", "package",
] as const;
```

Both web (dropdown `<Select>`) and mobile (picker/action sheet) use this constant. Mobile currently uses a free-text `TextInput` — replace with a picker.

### New Zod schemas
Add to `packages/shared/src/schemas/index.ts`:

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
```

### Preset library in shared constants
Add `ITEM_PRESETS` to `packages/shared/src/constants/index.ts`:

```ts
export interface ItemPreset {
  name: string;
  category: string;
  unit: string;
  estimatedShelfDays: number;
}

export const ITEM_PRESETS: ItemPreset[] = [ /* 100+ entries */ ];
```

Coverage groups:
- **Produce** (~40 items): apple, banana, avocado, broccoli, carrot, etc.
- **Deli & Meat** (~25 items): sliced turkey, chicken breast, ground beef, salmon fillet, etc.
- **Bulk & Dry** (~20 items): bulk almonds, rolled oats, brown rice, dried lentils, etc.
- **Fresh Bakery** (~10 items): sourdough loaf, bagels, croissants, etc.
- **Fresh Seafood** (~10 items): shrimp, tilapia, cod fillet, etc.

Each preset: `{ name, category, unit, estimatedShelfDays }`.

Presets live in shared constants (no network round-trip, works offline on mobile). AI inference is the server-side fallback for names that match no preset.

---

## Section 3: Server API

### New `/api/shopping-list` routes
All routes: auth middleware + household isolation (same pattern as `/api/items`).

| Method | Route | Body / Query | Response |
|---|---|---|---|
| `GET /` | — | Array of `pending` items for household |
| `POST /` | `createShoppingListItemSchema` | Created item (201) |
| `PATCH /:id` | `updateShoppingListItemSchema` | Updated item |
| `DELETE /:id` | — | `{ success: true, data: null }` |

### New `POST /api/items/suggest`
AI inference fallback for names not in the preset library.

**Request:** `{ name: string }`
**Response:** `{ unit: string, category: string, estimatedShelfDays: number }`

Implementation: calls OpenAI (reusing existing client) with a structured prompt. Returns 503 if OpenAI is unavailable — never blocks the add flow. Rate-limited per session to prevent abuse.

### Updated `PATCH /api/items/:id`
Add `opened: z.boolean().optional()` to `updateItemSchema`. No other changes — the route already handles partial updates generically.

### Duplicate check
No new endpoint. Client calls `GET /api/items` (existing) and filters by name client-side before submitting the add form. Keeps the server simple.

---

## Section 4: Web UI

### 1. Units — `AddItemDialog`
Replace hardcoded `<SelectItem>` block with `COMMON_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)`.

### 2. Opened flag
- **`AddItemDialog`**: "Mark as opened" checkbox, shown only in edit mode (not on initial add).
- **`ItemCard`**: Small "opened" badge when `opened: true`. Clicking it fires `PATCH /api/items/:id { opened: false }` to toggle off.

### 3. Consume action — `ItemCard`
Add "−1" button alongside existing edit/delete buttons. Visible when `quantity > 0`.

Behavior:
- `quantity > 1`: `PATCH { quantity: quantity - 1 }`, optimistic update
- `quantity === 1`: `PATCH { quantity: 0 }`, then inline prompt: "You're out — add to re-order list?" → Yes fires `POST /api/shopping-list` with item's name/brand/category/unit. No → item stays at 0.

### 4. Duplicate detection — `AddItemDialog`
On name field blur, call `GET /api/items` and filter by name client-side. If match found, show non-blocking banner below name field:

> "You already have [N] [item] in your [location]. Add anyway or merge quantity?"

Two actions: **Add Anyway** (continues normally) | **Merge** (patches existing item's quantity += new quantity, closes dialog).

### 5. Quick-add preset picker — `QuickAddPresets` component
Collapsible section at top of `AddItemDialog`: "Common items →". Typing filters `ITEM_PRESETS`. Selecting one pre-fills name, category, unit; sets `expirationEstimated: true` with shelf life as a date offset from today.

If no preset matches after 3+ characters typed, "AI suggest" button appears → calls `POST /api/items/suggest` → fills fields. Unavailable offline or on OpenAI error: button shows "Couldn't suggest — fill in manually."

### 6. Shopping list — `ShoppingListPanel`
New sidebar nav item "Re-order" with badge count of pending items. Opens a panel listing all `pending` shopping list items.

Each row:
- Item name, brand, suggested qty
- **Purchased** button → `PATCH status: purchased` → opens `AddItemDialog` pre-filled with item data
- **Delete** button → `DELETE /api/shopping-list/:id`

---

## Section 5: Mobile UI

Mirrors web changes, adapted to Expo/NativeWind patterns.

### 1. Units picker
Replace free-text `TextInput` for unit in `app/(tabs)/add.tsx` and `app/barcode.tsx` with a scrollable picker using `COMMON_UNITS`. Implemented as a `Modal` with `FlatList` (iOS/Android compatible, NativeWind styled).

### 2. Opened flag
"Mark as opened" toggle row in the item detail/edit form. Fires `updateItemOffline()` → syncs to server.

### 3. Consume action
"−1" button on item cards in `pantry.tsx`, `fridge.tsx`, `freezer.tsx`. Visible when `quantity > 0`. At quantity 0 after decrement: `Alert` with "Add to re-order list?" → Yes queues `createShoppingListItemOffline()` for sync.

### 4. Duplicate detection
On name field blur, query local SQLite cache (offline-first — no server call needed). Match found → `Alert` with "Already in pantry — add anyway or merge?" options.

### 5. Quick-add preset picker — `app/quick-add.tsx`
New screen reachable from Add tab. Searchable `FlatList` of `ITEM_PRESETS`. Selecting navigates back to add form pre-filled. "AI suggest" fires suggest endpoint when online; skips silently when offline.

### 6. Re-order tab — `app/(tabs)/reorder.tsx`
New tab in tab bar with badge count. Lists `pending` shopping list items from local SQLite (synced). "Purchased" → `Alert` → navigates to add form pre-filled. Offline-compatible via sync queue.

---

## Section 6: Error Handling

| Scenario | Behavior |
|---|---|
| Consume `PATCH` fails | Roll back optimistic update, show toast. Re-order prompt not shown. |
| `POST /api/shopping-list` fails after qty hits 0 | Item stays at 0. Toast: "Couldn't add to re-order list — try again from the Re-order tab." |
| `POST /api/items/suggest` unavailable | UI shows "Couldn't suggest defaults — fill in manually." Never blocks add flow. |
| Duplicate merge `PATCH` fails | Show error, leave add dialog open for retry. |
| Mobile offline | Suggest endpoint skipped silently. Duplicate check falls back to SQLite. Shopping list actions queue to sync. |

---

## Section 7: Testing

| Layer | What's tested |
|---|---|
| `packages/shared` unit tests | Preset list: 100+ entries, no duplicate names, all required fields present. New Zod schemas parse valid/invalid inputs. |
| `server/` tests | Shopping list CRUD with household isolation. `suggest` endpoint with mocked OpenAI. `opened` field in item PATCH. |
| `apps/web` component tests | Consume button state machine (qty > 1, qty = 1, at 0). Duplicate detection banner. Preset picker filter. Shopping list panel render and actions. |
| `e2e/` | Consume-to-zero → re-order prompt → shopping list entry appears → purchased → add dialog pre-filled. Full add flow via preset picker. |

---

## Out of Scope

- Additional storage locations (counter, wine rack, chest freezer)
- Expiration date type distinction (best by / use by / sell by)
- Recipe/delivery import (Instacart, Amazon Fresh, CSV)
- Nutritional info, dietary tags, allergen tracking
