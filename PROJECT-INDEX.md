# PantryRadar — Project Index

> Comprehensive codebase reference. See also: `CLAUDE.md` (dev commands), `PANTRYMAID-BRIEF.md` (product brief), `SECURITY-AUDIT.md` (security findings).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Directory Map](#2-directory-map)
3. [Database Schema](#3-database-schema)
4. [API Reference](#4-api-reference)
5. [Authentication Flow](#5-authentication-flow)
6. [Shared Package](#6-shared-package)
7. [Web App](#7-web-app)
8. [Mobile App](#8-mobile-app)
9. [External Integrations](#9-external-integrations)
10. [Image Resolution System](#10-image-resolution-system)
11. [LLM System](#11-llm-system)
12. [Testing](#12-testing)
13. [Infrastructure](#13-infrastructure)
14. [Known Issues & TODOs](#14-known-issues--todos)

---

## 1. Architecture Overview

```
Browser/Mobile
    │
    ▼
Vite dev server :5173  (proxies /api/* → :3000 in dev)
    │               ╲
    │                Caddy (prod, SSL, reverse proxy)
    ▼                       │
Hono API :3000  ◄───────────┘
    │  └── Better Auth  (session/JWT)
    │  └── Drizzle ORM
    │  └── Image Resolver (async, fire-and-forget)
    │  └── LLM layer (multi-provider via Vercel AI SDK)
    ▼
PostgreSQL 16 (Docker)
```

**Tech Stack:**

| Layer | Technology |
|---|---|
| Web | React 19 + Vite 8 + shadcn/ui + TanStack Query v5 + React Router v7 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin) + tailwind-merge v3 |
| Mobile | Expo SDK 55 + React Native 0.83 + NativeWind v4 + Expo SQLite |
| API | Hono v4 + Bun |
| Database | PostgreSQL 16 (Docker) |
| ORM | Drizzle ORM v0.45 + drizzle-kit |
| Auth | Better Auth v1.6 (session-based, cookie) |
| OCR | Veryfi API |
| Product DB | Open Food Facts (no API key) |
| LLM | Vercel AI SDK v6 — pluggable provider (OpenAI / Anthropic / Groq / Ollama) |
| Image search | Wikipedia PageImages API + Pexels API |
| Proxy | Caddy (env-driven domain + SSL) |
| Monorepo | Turborepo v2 + pnpm workspaces |
| Linting | ESLint v9 flat config (`eslint.config.mjs`) |
| Validation | Zod v4 |

**Middleware order (server):** Logger → SecureHeaders → CORS → RateLimit (auth only) → Zod validation per route → authMiddleware per protected route.

**Response envelope (all routes):**
```json
{ "success": true, "data": {}, "error": null }
```

---

## 2. Directory Map

```
pantryradar/
├── apps/
│   ├── web/                          # React + Vite web app
│   │   ├── src/
│   │   │   ├── App.tsx               # Router + ProtectedRoute wrapper
│   │   │   ├── main.tsx              # React entry, QueryClient setup
│   │   │   ├── index.css             # Tailwind v4: @import "tailwindcss",
│   │   │   │                         #   @theme inline {}, @custom-variant dark
│   │   │   ├── components/
│   │   │   │   ├── inventory/
│   │   │   │   │   ├── AddItemDialog.tsx   # Create/edit item form; shows image
│   │   │   │   │   │                       #   preview when editing
│   │   │   │   │   ├── BarcodeScanner.tsx  # Webcam barcode scan (@zxing)
│   │   │   │   │   ├── ItemCard.tsx        # Single item: thumbnail + actions
│   │   │   │   │   ├── ItemList.tsx        # Category-sorted, collapsible groups
│   │   │   │   │   └── ReceiptUpload.tsx   # File upload for receipt OCR
│   │   │   │   ├── layout/
│   │   │   │   │   ├── RadarLogo.tsx       # SVG brand mark
│   │   │   │   │   ├── Sidebar.tsx         # Left nav (locations + stats)
│   │   │   │   │   ├── ThemeProvider.tsx   # System/light/dark theme context
│   │   │   │   │   └── ThemeToggle.tsx     # Toggle button
│   │   │   │   └── ui/               # shadcn/ui primitives
│   │   │   │       ├── button.tsx
│   │   │   │       ├── card.tsx
│   │   │   │       ├── dialog.tsx
│   │   │   │       ├── input.tsx
│   │   │   │       ├── label.tsx
│   │   │   │       └── select.tsx
│   │   │   ├── lib/
│   │   │   │   ├── api.ts            # fetch wrapper + all API call functions
│   │   │   │   ├── auth.ts           # Zustand auth store (persisted)
│   │   │   │   ├── queryKeys.ts      # TanStack Query key factory
│   │   │   │   └── utils.ts          # cn() helper (clsx + tailwind-merge)
│   │   │   ├── pages/
│   │   │   │   ├── InventoryPage.tsx # Main: 3-column grid, search, barcode,
│   │   │   │   │                     #   receipt upload; 3s delayed re-fetch
│   │   │   │   │                     #   after create for async image resolution
│   │   │   │   ├── LoginPage.tsx     # Sign in + sign up toggle
│   │   │   │   └── JoinHouseholdPage.tsx  # Invite code entry
│   │   │   └── test/
│   │   │       ├── components/       # Vitest + RTL (all .todo stubs)
│   │   │       ├── mocks/            # MSW v2 handlers + server
│   │   │       └── setup.ts
│   │   ├── postcss.config.js         # Empty — Tailwind v4 uses Vite plugin
│   │   ├── vite.config.ts            # @tailwindcss/vite + proxy /api/* → :3000
│   │   └── vitest.config.ts          # jsdom env, 80% coverage threshold
│   │
│   └── mobile/                       # Expo SDK 55 managed app
│       ├── app/                      # Expo Router file-based routing
│       │   ├── _layout.tsx           # Root layout (auth guard + sync trigger)
│       │   ├── index.tsx             # Redirect to tabs
│       │   ├── barcode.tsx           # Barcode scanner (useCameraPermissions hook)
│       │   ├── receipt.tsx           # Receipt capture (useCameraPermissions hook)
│       │   ├── item/[id].tsx         # Item detail + edit screen
│       │   ├── (tabs)/               # Bottom tab navigator
│       │   │   ├── _layout.tsx       # Tab bar config
│       │   │   ├── pantry.tsx
│       │   │   ├── fridge.tsx
│       │   │   ├── freezer.tsx
│       │   │   └── add.tsx
│       │   └── auth/
│       │       ├── login.tsx         # Magic-link login (stubbed)
│       │       ├── register.tsx      # Household registration
│       │       └── join.tsx          # Invite code join
│       └── src/
│           ├── components/
│           │   └── ItemList.tsx
│           └── lib/
│               ├── api.ts            # Mobile API client (Bearer token)
│               ├── auth.ts           # AsyncStorage token management
│               ├── db.ts             # Expo SQLite schema + queries (offline)
│               └── sync.ts           # Sync queue flush logic
│
├── server/                           # Hono + Bun API
│   ├── src/
│   │   ├── index.ts                  # App entry: middleware, route mount,
│   │   │                             #   error handler, Bun native HTTP export
│   │   ├── db/
│   │   │   ├── schema.ts             # Drizzle table definitions + relations
│   │   │   └── seed.ts               # Faker-based dev seed
│   │   ├── lib/
│   │   │   ├── auth.ts               # Better Auth instance + createUserHousehold()
│   │   │   │                         #   + generateInviteCode()
│   │   │   ├── db.ts                 # Drizzle client (postgres-js driver)
│   │   │   ├── llm.ts                # LLM provider factory: getModel() selects
│   │   │   │                         #   OpenAI/Anthropic/Groq/Ollama via env
│   │   │   ├── openai.ts             # LLM functions (provider-agnostic):
│   │   │   │                         #   estimateExpiration(), decodeReceiptItems(),
│   │   │   │                         #   extractBrandFromName(), normalizeItemName()
│   │   │   ├── imageresolver.ts      # Async image resolution pipeline:
│   │   │   │                         #   seed map → Wikipedia → Pexels
│   │   │   │                         #   + category inference via CATEGORY_PATTERNS
│   │   │   ├── openfoodfacts.ts      # OpenFoodFactsClient: getProductByBarcode(),
│   │   │   │                         #   fuzzySearch(); inferCategoryFromName()
│   │   │   ├── veryfi.ts             # VeryfiClient: processReceipt()
│   │   │   └── retry.ts              # withRetry() utility
│   │   ├── middleware/
│   │   │   ├── auth.ts               # authMiddleware + getUser() helper
│   │   │   └── ratelimit.ts          # In-memory rate limiter (auth routes)
│   │   └── routes/
│   │       ├── items.ts              # CRUD + fire-and-forget image resolution
│   │       ├── households.ts         # POST /, GET /:id, POST /join
│   │       ├── barcode.ts            # GET /:upc (OFF + expiration estimate)
│   │       └── receipt.ts            # POST / (Veryfi → LLM → OFF)
│   └── drizzle/                      # Generated migration SQL files
│
├── packages/
│   ├── shared/                       # @pantrymaid/shared
│   │   └── src/
│   │       ├── index.ts              # Barrel export
│   │       ├── schemas/index.ts      # Zod v4 schemas + inferred types
│   │       ├── api/client.ts         # ApiClient class (fetch-based, token-aware)
│   │       └── constants/index.ts    # ITEM_LOCATIONS, FOOD_CATEGORIES, COMMON_UNITS…
│   └── ui/                           # @pantrymaid/ui (placeholder)
│
├── e2e/                              # Playwright tests
│   ├── auth.spec.ts
│   ├── inventory.spec.ts
│   ├── barcode.spec.ts
│   ├── receipt.spec.ts
│   ├── offline.spec.ts
│   ├── helpers.ts                    # loginAs(), registerAs()
│   └── fixtures.ts                   # TEST_USER, ITEMS test data
│
├── .github/workflows/
│   ├── ci.yml                        # Lint + build + unit tests on PRs
│   ├── e2e.yml                       # PostgreSQL + migrations + Playwright
│   └── deploy.yml                    # Docker build + SSH deploy stub
│
├── eslint.config.mjs                 # ESLint v9 flat config (all workspaces)
├── turbo.json                        # Turborepo v2 (tasks: build/test/lint/dev)
├── CLAUDE.md                         # Dev commands + architecture reference
├── docker-compose.yml                # postgres + api + caddy
├── Caddyfile                         # Reverse proxy config
└── playwright.config.ts              # E2E: baseURL :5173, webServer auto-start
```

---

## 3. Database Schema

**File:** `server/src/db/schema.ts`

### Better Auth tables (managed by library)
| Table | Key Columns |
|---|---|
| `user` | `id` (text PK), `email`, `name`, `image`, `emailVerified` |
| `session` | `id`, `token`, `userId` → `user.id`, `expiresAt` |
| `account` | `id`, `accountId`, `providerId`, `userId` → `user.id`, `password` |
| `verification` | `id`, `identifier`, `value`, `expiresAt` |

### Application tables
| Table | Key Columns | Notes |
|---|---|---|
| `households` | `id` (uuid PK), `name`, `invite_code` (unique), `created_at` | 8-char random alphanumeric code |
| `users` | `id` (text PK → `user.id`), `household_id` → `households.id`, `display_name` | App profile row created on sign-up |
| `items` | `id` (uuid PK), `household_id`, `name`, `brand`, `category`, `location` CHECK(pantry/fridge/freezer), `quantity`, `unit`, `barcode_upc`, `image_url`, `expiration_date`, `expiration_estimated`, `added_by` → `users.id`, `added_at`, `updated_at`, `notes` | `image_url` and `category` filled async by image resolver |
| `product_cache` | `upc` (text PK), `name`, `brand`, `category`, `image_url`, `source` (open_food_facts/manual), `fetched_at` | 7-day TTL cache for Open Food Facts results |

**Household isolation (IDOR prevention):** Every query on `items` always includes `AND household_id = user.householdId`.

---

## 4. API Reference

Base URL: `http://localhost:3000` (dev) or your Caddy domain (prod).  
All protected routes require a valid Better Auth session cookie.

### Public

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status, timestamp, environment }` |
| `POST` | `/api/auth/sign-up/email` | Register; auto-creates default household + users row |
| `POST` | `/api/auth/sign-in/email` | Login |
| `POST` | `/api/auth/sign-out` | Logout |
| `GET` | `/api/auth/**` | All Better Auth handlers (rate-limited: 5 req/min prod, 100 dev) |

### Items (auth required)

| Method | Path | Body / Query | Response | Notes |
|---|---|---|---|---|
| `GET` | `/api/items` | `?location`, `?page`, `?pageSize` (max 100) | `PaginatedResponse<Item>` | |
| `GET` | `/api/items/:id` | — | `Item` | |
| `POST` | `/api/items` | `CreateItemInput` | `Item` (201) | Fires async image+category resolver |
| `PUT` | `/api/items/:id` | `UpdateItemInput` (partial, no defaults) | `Item` | |
| `DELETE` | `/api/items/:id` | — | `{ data: null }` | |

**`CreateItemInput`** key fields: `name` (required), `location` (required), `quantity` (default 1), `unit`, `brand`, `category`, `barcodeUpc`, `imageUrl`, `expirationDate`, `expirationEstimated`, `notes`.

### Households (auth required)

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/households` | `{ name }` | `Household` (201) |
| `GET` | `/api/households/:id` | — | `Household & { members[] }` |
| `POST` | `/api/households/join` | `{ inviteCode: string (8 chars) }` | `Household` |

### Barcode (auth required)

| Method | Path | Response |
|---|---|---|
| `GET` | `/api/barcode/:upc` | `{ upc, name, brand, category, imageUrl?, expiration? }` |

Pipeline: validate numeric → check `product_cache` (7-day TTL) → Open Food Facts → parallel: `estimateExpiration()` + `extractBrandFromName()` if no brand.

### Receipt (auth required)

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/receipt` | `{ imageBase64: string }` | `{ storeName?, lineItems[], total?, requiresConfirmation: true }` |

Pipeline: Veryfi OCR → LLM decode → Open Food Facts fuzzy match → return for user confirmation (never auto-inserts).

---

## 5. Authentication Flow

**Library:** Better Auth (`server/src/lib/auth.ts`)

**Session model:** Cookie-based. Web app uses `credentials: "include"`. Vite dev server proxies `/api/*` to avoid cross-origin cookie issues.

**Trusted origins:** `localhost:5173`, `localhost:5174` (fallback Vite port), `localhost:3000`, `localhost:8081`.

**Sign-up side effect** (`server/src/index.ts`): After `POST /api/auth/sign-up/email` returns 200, the server reads the response body, extracts `user.id`, and calls `createUserHousehold()` to create a default household and `users` profile row.

**`authMiddleware`** (`server/src/middleware/auth.ts`):
1. `auth.api.getSession({ headers })` via Better Auth
2. Query `users` table for `householdId`
3. Set `c.set("user", { id, householdId, email })` for downstream handlers
4. Return 401 if session invalid

**Web auth state** (`apps/web/src/lib/auth.ts`): Zustand store persisted to `localStorage` under `auth-storage`. Contains `{ user, isAuthenticated }`.

**Rate limiting:** In-memory map in `server/src/middleware/ratelimit.ts`. 5 req/min on `/api/auth/*` in production, 100 in development.

---

## 6. Shared Package

**Package:** `@pantrymaid/shared`

### Import paths
```ts
import { ... } from "@pantrymaid/shared";              // main barrel
import { createItemSchema } from "@pantrymaid/shared/schemas";
import { ApiClient } from "@pantrymaid/shared/api";
import { FOOD_CATEGORIES } from "@pantrymaid/shared/constants";
```

### Key schemas (`schemas/index.ts`) — Zod v4
- `createItemSchema` — required: `name`, `location`; optional with defaults: `quantity` (1), `expirationEstimated` (false)
- `updateItemSchema` — all fields optional, **no defaults** (Zod v4 `.partial()` applies defaults; this is explicitly defined without them to prevent silent overwrites on PUT)
- `itemLocationSchema` — `z.enum(["pantry", "fridge", "freezer"])`
- `householdSchema` / `createHouseholdSchema`
- `barcodeProductSchema` / `expirationEstimateSchema`
- `apiResponseSchema<T>` / `paginatedResponseSchema<T>` — generic factory functions

**Key inferred types:** `ItemLocation`, `Item`, `CreateItemInput`, `UpdateItemInput`, `Household`, `CreateHouseholdInput`, `BarcodeProduct`, `ExpirationEstimate`.

### Constants (`constants/index.ts`)
- `ITEM_LOCATIONS` — `["pantry", "fridge", "freezer"]`
- `FOOD_CATEGORIES` — 13 categories used for inventory grouping and sort order
- `COMMON_UNITS` — unit strings (lb, oz, kg, can, box…)
- `API_ENDPOINTS` — path constants

---

## 7. Web App

**Entry:** `apps/web/src/main.tsx` → `App.tsx`

**Routing** (React Router v7, library mode):
| Path | Component | Protected |
|---|---|---|
| `/login` | `LoginPage` | No |
| `/join` | `JoinHouseholdPage` | No |
| `/inventory` | `InventoryPage` | Yes (ProtectedRoute) |
| `/` | Redirect → `/inventory` | — |

**Main view** (`InventoryPage.tsx`):
- Fetches all items via TanStack Query (`queryKeys.inventory.list()`)
- Three-column grid: Pantry / Fridge / Freezer
- After `createMutation` success: immediate `invalidateQueries` + 3-second delayed re-invalidation to pick up async image/category resolution
- Opens `AddItemDialog` (create/edit), `BarcodeScanner`, `ReceiptUpload` as dialogs

**Inventory display** (`ItemList.tsx`):
- Items sorted by `FOOD_CATEGORIES` order then A–Z within each group
- Collapsible category sections (click header to toggle)
- Shows item count per category

**Item card** (`ItemCard.tsx`):
- 48×48px image thumbnail; falls back to Package icon if no `imageUrl`
- Left color stripe: red (expired), amber (≤7 days), green (ok)

**Edit dialog** (`AddItemDialog.tsx`):
- Populated with `editItem.imageUrl` on open
- Shows 160px image preview above URL field; updates live as URL changes

**State management:**
- Server state: TanStack Query
- Auth state: Zustand (persisted) — `useAuth()` hook
- UI state: local `useState`

**Styling:**
- Tailwind CSS v4 via `@tailwindcss/vite` plugin (no `tailwind.config.js`)
- CSS config in `src/index.css`: `@theme inline {}` maps shadcn color tokens to CSS variables
- Dark mode via `@custom-variant dark (&:is(.dark *))`
- Animations: `tw-animate-css` (imported as CSS, not JS plugin)

**Query key factory** (`lib/queryKeys.ts`):
```ts
queryKeys.inventory.list(location?)   // ["inventory", "list", { location }]
queryKeys.inventory.lists()           // ["inventory", "list"]
queryKeys.inventory.detail(id)        // ["inventory", "detail", id]
```

---

## 8. Mobile App

**Framework:** Expo SDK 55, React Native 0.83, file-based routing via Expo Router.

**Screens** (`apps/mobile/app/`):
| Screen | File | Notes |
|---|---|---|
| Auth guard + sync | `_layout.tsx` | Redirects on auth state; triggers sync on foreground |
| Tab: Pantry/Fridge/Freezer | `(tabs)/pantry\|fridge\|freezer.tsx` | Reads from local SQLite |
| Tab: Add | `(tabs)/add.tsx` | Quick-add form |
| Barcode scanner | `barcode.tsx` | `useCameraPermissions()` hook + `CameraView` |
| Receipt capture | `receipt.tsx` | `useCameraPermissions()` hook + image picker |
| Item detail | `item/[id].tsx` | Edit + delete |
| Auth: login/register/join | `auth/*.tsx` | |

**Camera permissions** (SDK 51+ API):
```ts
const [permission, requestPermission] = useCameraPermissions();
if (!permission?.granted) { ... requestPermission() ... }
```

**Offline layer** (`src/lib/db.ts`): Expo SQLite v15. Tables: `items` (mirrors server schema), `sync_queue`. API: `openDatabaseAsync`, `getAllAsync<T>`, `getFirstAsync<T>`, `runAsync`, `execAsync`.

**Sync** (`src/lib/sync.ts`):
- `sync_queue` flushed on app foreground + network reconnect
- Conflict resolution: last-write-wins
- Retry: 3 attempts, 1s delay, batch size 50

**Auth** (`src/lib/auth.ts`): `AsyncStorage` for token + user JSON. Keys: `@pantrymaid/auth_token`, `@pantrymaid/user`.

**Styling:** NativeWind v4.2 (Tailwind v3 — separate from web's Tailwind v4). CSS classes in JSX via `className`.

---

## 9. External Integrations

### Open Food Facts (`server/src/lib/openfoodfacts.ts`)
- Free, no API key required
- `getProductByBarcode(upc)` — exact lookup with `product_cache` layer (7-day TTL, upsert on stale)
- `fuzzySearch(name)` — Levenshtein-distance scoring, returns top 3 `FuzzyMatch[]`
- `normalizeCategoryFromOff(offCategories)` — maps OFF taxonomy tags to `FOOD_CATEGORIES`
- `inferCategoryFromName(name)` — word-boundary keyword matching against `CATEGORY_PATTERNS`; used by image resolver for manually-entered items

### Veryfi (`server/src/lib/veryfi.ts`)
- Receipt OCR via API call
- `VeryfiClient.processReceipt(imageBase64)` → `VeryfiResponse` (vendor, line_items, total)
- `VeryfiError` class with `statusCode` for 429 rate-limit and 400 bad-image handling
- Env: `VERYFI_CLIENT_ID`, `VERYFI_CLIENT_SECRET`, `VERYFI_USERNAME`, `VERYFI_API_KEY`

### Pexels (`server/src/lib/imageresolver.ts`)
- Stock photo fallback in image resolution pipeline
- Requires `PEXELS_API_KEY` — free at pexels.com/api, 200 req/hour, 20k req/month
- Gracefully skipped if key not configured

### Retry utility (`server/src/lib/retry.ts`)
- `withRetry(fn, attempts, delayMs)` — generic async retry wrapper

---

## 10. Image Resolution System

**File:** `server/src/lib/imageresolver.ts`

Fires **fire-and-forget** after `POST /api/items` returns 201. Patches `items.image_url` and `items.category` in a single DB write. The frontend fires a second `invalidateQueries` 3 seconds after create to pick up the resolved values without a manual refresh.

### Resolution pipeline

```
1. existingImageUrl set?  → skip (barcode scan with OFF image already populated)
2. Seed map lookup (name → Wikipedia article title)
   → fetchWikipediaImage() via PageImages API (pilicense=free, 400px thumb)
   → 24h in-memory cache per article title
3. [seed map miss] LLM normalizeItemName(name)
   → "Granny Smith Apples organic 3lb" → "apple"
   → retry seed map with normalized name
4. [still miss] pexelsQuery(normalized) → fetchPexelsImage()
   → 24h in-memory cache per query string
5. [all miss] → leave null; frontend shows Package icon fallback
```

### Seed map
~75 common food names → Wikipedia article titles. Examples:
- `"apple"` → `Apple`, `"chicken breast"` → `Chicken_as_food`, `"olive oil"` → `Olive_oil`

**Normalization:** strips stop words (organic, frozen, whole, raw…), handles plurals, word-boundary substring matching (prevents `"tea"` firing inside `"steak"`), longest-key-first priority (so `"chicken breast"` beats `"chicken"`).

### Category inference
If `items.category` is null, `inferCategoryFromName(name)` runs the same word-boundary keyword matching against `CATEGORY_PATTERNS` from `openfoodfacts.ts`. Examples:
- `"t-bone steak"` → `"Meat & Poultry"` (keyword: `steak`)
- `"blueberries"` → `"Produce"` (keyword: `blueberries`, exact match)
- `"sourdough bread"` → `"Bread & Bakery"` (keyword: `bread`)

---

## 11. LLM System

**File:** `server/src/lib/llm.ts`

Provider-agnostic LLM layer via **Vercel AI SDK v6**. One provider is active per deployment, selected by `LLM_PROVIDER` env var.

### Provider selection

```
LLM_PROVIDER=openai      → @ai-sdk/openai    gpt-4o-mini (default)
LLM_PROVIDER=anthropic   → @ai-sdk/anthropic claude-haiku-4-5-20251001 (default)
LLM_PROVIDER=groq        → @ai-sdk/groq      llama-3.1-8b-instant (default)
LLM_PROVIDER=ollama      → createOpenAI()    llama3.2 + OLLAMA_BASE_URL
```

Override model with `LLM_MODEL=<model-id>`. Default: `LLM_PROVIDER=openai`.

### LLM functions (`server/src/lib/openai.ts`)
All use `_deps.generateObject()` (testable via `_deps` export):

| Function | Purpose | Cache |
|---|---|---|
| `estimateExpiration(name, category?)` | Shelf-life estimate → `ExpirationEstimate` | 24h in-memory |
| `decodeReceiptItems(lineItems, storeName?)` | Expand abbreviated receipt text; retries items with confidence < 0.7 | none |
| `extractBrandFromName(name)` | Extract brand from product name string | 24h in-memory |
| `normalizeItemName(name)` | Strip brand/size/adjectives → core food name for image lookup | 24h in-memory |

---

## 12. Testing

### Coverage targets
| Package | Threshold |
|---|---|
| `packages/shared/` | 90% |
| `apps/web/` | 80% (component tests currently all `.todo`) |

### Test locations
| Layer | Framework | Location |
|---|---|---|
| Server integrations | `bun test` | `server/src/test/integrations/` |
| Shared schemas | Vitest v4 | `packages/shared/src/test/schemas.test.ts` (41 tests) |
| Web components | Vitest v4 + RTL | `apps/web/src/test/components/` (88 `.todo` stubs) |
| Web API mocking | MSW v2 | `apps/web/src/test/mocks/` |
| Mobile | Jest + jest-expo | `apps/mobile/src/test/` |
| E2E | Playwright v1.59 | `e2e/*.spec.ts` |

**Active tests:** `server/src/test/integrations/openai.test.ts` — 11 tests covering `decodeReceiptItems`, `estimateExpiration`, `clearExpirationCache` via `_deps` mock injection.

### E2E specs
- `auth.spec.ts` — sign up, sign in (valid + invalid), sign out
- `inventory.spec.ts` — 3-column view, add to pantry, add with expiry, delete item
- `barcode.spec.ts` — barcode scan flow
- `receipt.spec.ts` — receipt upload + review flow
- `offline.spec.ts` — offline read behavior

**Playwright config:** `baseURL: "http://localhost:5173"` — in dev, web server often runs on `:5174` (port conflict), so tests need `BASE_URL=http://localhost:5174 pnpm exec playwright test ...`.

### CI
- `ci.yml` — runs on PR: lint → build → unit tests
- `e2e.yml` — spins up PostgreSQL, runs migrations, starts API + web, runs Playwright
- `deploy.yml` — Docker build + SSH deploy stub

---

## 13. Infrastructure

### Docker Compose (`docker-compose.yml`)
| Service | Image | Notes |
|---|---|---|
| `postgres` | postgres:16-alpine | Port 5432; healthcheck before api starts |
| `api` | `./server` (Dockerfile) | Expose 3000; blocked on postgres health |
| `caddy` | caddy:2-alpine | Ports 80, 443; blocked on api |

**Note:** The `api` service Dockerfile builds from monorepo root context. For local development, run only `postgres` via Docker and start the API natively with `bun run --cwd server dev`.

### Caddy (`Caddyfile`)
```
{$DOMAIN} {
    tls {$SSL_MODE}
    reverse_proxy api:3000
}
```
`DOMAIN=localhost`, `SSL_MODE=internal` for local dev (self-signed cert).

### Environment variables

```bash
# Database
DATABASE_URL=postgresql://pantrymaid:<password>@localhost:5432/pantrymaid
POSTGRES_DB=pantrymaid
POSTGRES_USER=pantrymaid
POSTGRES_PASSWORD=<password>

# Auth
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000

# LLM (one provider active per deployment)
LLM_PROVIDER=openai               # openai | anthropic | groq | ollama
LLM_MODEL=gpt-4o-mini             # optional; overrides provider default
OPENAI_API_KEY=sk-...             # required if LLM_PROVIDER=openai
ANTHROPIC_API_KEY=sk-ant-...      # required if LLM_PROVIDER=anthropic
GROQ_API_KEY=gsk_...              # required if LLM_PROVIDER=groq
OLLAMA_BASE_URL=http://localhost:11434/v1  # required if LLM_PROVIDER=ollama

# Image search
PEXELS_API_KEY=...                # free at pexels.com/api; skipped if absent

# OCR
VERYFI_CLIENT_ID=...
VERYFI_CLIENT_SECRET=...
VERYFI_USERNAME=...
VERYFI_API_KEY=...

# Server
PORT=3000
NODE_ENV=development
DOMAIN=localhost
SSL_MODE=internal
```

---

## 14. Known Issues & TODOs

### Server-side
- `GET /api/households/me` — referenced in `ApiClient` but not implemented server-side
- Receipt `POST /api/receipt` never auto-inserts items — always returns `requiresConfirmation: true`; web UI doesn't show the results to the user (mutation success just invalidates queries)

### Web app
- Barcode scanner sets `scannedProduct` with empty `id`/`householdId` on lookup — these are stripped at create time by the route, but the dialog form shows them briefly
- Web E2E tests (`playwright.config.ts`) hardcode `baseURL: "http://localhost:5173"`; willitcocktail occupies that port locally, so tests must be run with `BASE_URL=http://localhost:5174 pnpm exec playwright test`

### Image resolution
- Wikipedia PageImages API with `pilicense=free` may return `null` for some seed-map articles where the lead image has a non-commercial license (uncommon but possible)
- `pexelsCache` and `wikiCache` are in-memory and reset on server restart; high-volume restarts will cause repeated API calls until caches warm

### Mobile
- Login screen (`app/auth/login.tsx`) is stubbed with a magic-link simulation (`setTimeout`); real Better Auth magic link or email/password flow not wired up
- SQLite sync conflict resolution is last-write-wins with no timestamp comparison guard
- `@react-native-async-storage/async-storage` downgraded to `^2.2.0` by Expo SDK 55 resolver (from `^3.0.2`); monitor if mobile auth breaks

### Security
- CORS `allowedOrigins` in `server/src/index.ts` lists specific origins but the fallback returns `null` (rejecting) — correct behaviour, but `localhost:5174` is **not** in the list and should be added for dev
- Rate limiter is in-memory and resets on server restart (no Redis persistence)
- `@types/react-native` removed (deprecated); RN 0.83 bundles its own types

### Deferred dependency upgrades
- **TypeScript 6** — hold until ecosystem (eslint, vite, vitest) fully supports it (~Q3 2026)
- **Tailwind v4 on mobile** — NativeWind 4.x currently requires Tailwind v3; monitor NativeWind releases for v4 support
