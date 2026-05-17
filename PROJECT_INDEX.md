# Project Index: PantryRadar

Generated: 2026-05-08

Multi-user household inventory app (pantry/fridge/freezer) with barcode scanning,
receipt OCR, expiration tracking, and household sharing via invite code.

## 📁 Project Structure

```
pantryradar/                       Turborepo + pnpm monorepo
├── apps/
│   ├── web/                       React 19 + Vite 8 + Tailwind 4 + shadcn/ui    (:5173)
│   └── mobile/                    Expo SDK 55 + Expo Router + NativeWind 4      (:8081)
├── server/                        Hono + Bun + Drizzle + Better Auth            (:3000)
│   ├── src/{db,lib,middleware,routes,test}
│   └── drizzle/                   SQL migrations + meta snapshots
├── packages/
│   ├── shared/                    Zod schemas, types, fetch API client, constants
│   └── ui/                        Placeholder for cross-platform UI primitives
├── e2e/                           Playwright specs (auth, barcode, inventory, offline, receipt)
├── docker-compose.yml             postgres:16 + caddy:2 + api (masterhuh/pantryradar:latest)
├── Caddyfile                      Reverse proxy → api:3000 with auto-TLS
└── .github/workflows/             ci · e2e · deploy · docker-publish
```

## 🚀 Entry Points

- API server: `server/src/index.ts` — Hono app, Better Auth handler, route mounting, port 3000
- Web SPA: `apps/web/src/main.tsx` → `App.tsx` (react-router: /login /join /inventory)
- Mobile: `apps/mobile/app/_layout.tsx` (Expo Router stack: auth/_ (tabs)/_ item barcode receipt)
- DB seed: `server/src/db/seed.ts` (Faker test data)
- E2E config: `playwright.config.ts` (auto-starts Vite; expects API on :3000)

## 🔌 API Surface (`/api` prefix unless noted)

Envelope: `{ success, data?, error? }` on every response.

| Method   | Path                   | Auth | File                                                                              |
| -------- | ---------------------- | ---- | --------------------------------------------------------------------------------- |
| GET      | `/health`              | —    | `server/src/index.ts:52`                                                          |
| POST/GET | `/api/auth/**`         | —    | Better Auth handler @ `index.ts:64` (rate-limited, post-signup creates household) |
| POST     | `/api/items`           | ✓    | `routes/items.ts:25`                                                              |
| GET      | `/api/items?location=` | ✓    | `routes/items.ts:94`                                                              |
| GET      | `/api/items/:id`       | ✓    | `routes/items.ts:160`                                                             |
| PUT      | `/api/items/:id`       | ✓    | `routes/items.ts:205`                                                             |
| DELETE   | `/api/items/:id`       | ✓    | `routes/items.ts:264`                                                             |
| POST     | `/api/households`      | ✓    | `routes/households.ts:20`                                                         |
| GET      | `/api/households/me`   | ✓    | `routes/households.ts:76`                                                         |
| POST     | `/api/households/join` | ✓    | `routes/households.ts:126`                                                        |
| GET      | `/api/barcode/:upc`    | ✓    | `routes/barcode.ts:15`                                                            |
| POST     | `/api/receipt`         | ✓    | `routes/receipt.ts:35`                                                            |

## 📦 Server Modules (`server/src/`)

- `lib/auth.ts` — Better Auth init (Drizzle adapter, email/password), `generateInviteCode`, `createUserHousehold`
- `lib/db.ts` — postgres-js + Drizzle client
- `lib/llm.ts` — Provider switch: openai / anthropic / groq / ollama (uses `ai` SDK v6)
- `lib/openai.ts` — `decodeReceiptItems`, `estimateExpiration`, `extractBrandFromName`
- `lib/openfoodfacts.ts` — UPC → product, with `product_cache` 7-day TTL layer
- `lib/veryfi.ts` — Receipt OCR client + `VeryfiError`
- `lib/imageresolver.ts` — Wikipedia PageImages → Pexels fallback chain for item images
- `lib/retry.ts` — Generic retry/backoff helper
- `middleware/auth.ts` — `authMiddleware`, `getUser(c)`
- `middleware/ratelimit.ts` — In-memory limiter (5/min prod, 100/min dev on `/api/auth/*`)
- `db/schema.ts` — Tables: `user`, `session`, `account`, `verification` (Better Auth) · `households`, `users` (app), `items`, `productCache` · `location` CHECK ∈ {pantry,fridge,freezer}

## 🎨 Web App (`apps/web/src/`)

- Pages: `LoginPage`, `JoinHouseholdPage`, `InventoryPage` (440 lines — main feature surface)
- Inventory components: `AddItemDialog`, `BarcodeScanner` (zxing/browser), `ItemCard`, `ItemList`, `ReceiptUpload`
- Layout: `Sidebar`, `RadarLogo`, `ThemeProvider`, `ThemeToggle`
- shadcn primitives in `components/ui/`: button, card, dialog, input, label, select
- `lib/api.ts` (fetch wrapper) · `lib/auth.ts` (Better Auth client + `useAuth`) · `lib/queryKeys.ts` · `lib/utils.ts` (cn)
- State: TanStack Query (5-min staleTime, retry=1) · Zustand · MSW for tests

## 📱 Mobile App (`apps/mobile/`)

- Routes: `app/(tabs)/{pantry,fridge,freezer,add}.tsx` · `auth/{login,register,join}.tsx` · `item/[id].tsx` · `barcode.tsx` · `receipt.tsx`
- `src/lib/db.ts` — expo-sqlite local cache
- `src/lib/sync.ts` — `syncQueue()` / `syncFromServer()` triggered on AppState `active`
- `src/lib/auth.ts` — token in expo-secure-store

## 📚 Shared Package (`@pantrymaid/shared`)

Subpath exports (all source TS — no build step):

- `.` — barrel re-exports schemas + api + constants
- `./schemas` — Zod schemas + inferred types: `Item`, `Household`, `User`, `BarcodeProduct`, `ReceiptProcessingResult`, `ExpirationEstimate`, `SyncQueueEntry`, etc.
- `./api` — `ApiClient` class + `createApiClient(config)`
- `./constants` — `ITEM_LOCATIONS`, `FOOD_CATEGORIES`, `COMMON_UNITS`, `API_ENDPOINTS`
- `./types` — re-exports all TS types from `./schemas` (type-only imports, no runtime Zod schemas)

## 🧪 Tests

- Server: `server/src/test/` — `routes/{items,households,barcode,receipt}.test.ts`, `integrations/{openai,openfoodfacts,veryfi}.test.ts`, factories.ts, setup.ts (Bun test runner; uses `@testcontainers/postgresql`). Note: root `package.json` test script currently stubs to pass.
- Web: Vitest + jsdom + Testing Library + MSW — `BarcodeScanner.test.tsx`, `ItemList.test.tsx`, `ReceiptUpload.test.tsx`
- Shared: Vitest (node) — `schemas.test.ts` (90% threshold)
- Mobile: configured for Phase 2 (currently stubbed)
- E2E: 5 Playwright specs at `e2e/` + `fixtures.ts` + `helpers.ts`

## 🔧 Configuration

- `turbo.json` — tasks: build (deps `^build`), test (deps `^build`), lint, dev (persistent), clean
- `pnpm-workspace.yaml` — `apps/*`, `server`, `packages/*`
- `tsconfig.base.json` — shared TS config (strict mode)
- `eslint.config.mjs` — flat config, TS + Prettier integration
- `.prettierrc` — semi, double quotes, 2-space, printWidth 100
- `playwright.config.ts` — auto-launches Vite on :5173
- `docker-compose.yml` — postgres + api + caddy services
- `.env.example` — DATABASE*URL · BETTER_AUTH_SECRET · LLM_PROVIDER · OPENAI/ANTHROPIC/GROQ/OLLAMA · PEXELS · VERYFI*\* · DOMAIN · SSL_MODE

## 🔗 Key Dependencies

- Backend: `hono@4`, `better-auth@1.6`, `drizzle-orm@0.45`, `postgres@3.4`, `ai@6`, `@ai-sdk/{openai,anthropic,groq}`, `zod@4`
- Web: `react@19`, `vite@8`, `@tanstack/react-query@5`, `react-router-dom@7`, `tailwindcss@4`, `@radix-ui/*`, `@zxing/browser`, `msw@2`, `vitest@4`
- Mobile: `expo@55`, `expo-router@55`, `expo-{camera,sqlite,secure-store,image-picker}`, `nativewind@4`, `react-native@0.83`
- Tooling: `turbo@2.9`, `pnpm@8.15`, `typescript@5.3`, `eslint@9`

## 🚀 Quick Start

```bash
cp .env.example .env                 # Fill DATABASE_URL, BETTER_AUTH_SECRET, OPENAI_API_KEY, VERYFI_*
docker compose up -d                 # Postgres + Caddy
pnpm install                         # Install workspaces
cd server && bun run db:push && cd ..  # Apply migrations
pnpm dev                             # Start web + api
pnpm test:e2e                        # Run Playwright (needs api running)
```

## 🧭 Architecture Notes

- Request flow (dev): browser → Vite :5173 (proxies /api) → Hono :3000 → Postgres
- Request flow (prod): browser → Caddy :443 → api:3000 → postgres:5432
- Middleware stack: `logger → secureHeaders → cors → rateLimit (auth only) → zValidator (per-route)`
- IDOR protection: every data query filters on `householdId` from `getUser(c)`
- Sign-up flow: Better Auth creates user → server intercepts response → `createUserHousehold` inserts default household + join row before returning
