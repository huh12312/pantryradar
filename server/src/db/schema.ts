import { pgTable, text, uuid, timestamp, boolean, numeric, date, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Better Auth tables - required by better-auth library
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  name: text('name').notNull(),
  image: text('image'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
});

// Houses table — named locations within a household (e.g. "Main House", "Beach House")
export const houses = pgTable('houses', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Households table
export const households = pgTable('households', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').unique().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  krogerLocationId: text('kroger_location_id'),
  krogerStoreName: text('kroger_store_name'),
  krogerChain: text('kroger_chain'),
  krogerZipCode: text('kroger_zip_code'),
});

// Users table - extends Better Auth users via household relationship
export const users = pgTable('users', {
  id: text('id').primaryKey().references(() => user.id, { onDelete: 'cascade' }), // References Better Auth user.id
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true}).defaultNow().notNull(),
});

// Items table
export const items = pgTable('items', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  brand: text('brand'),
  category: text('category'),
  location: text('location').notNull(),
  quantity: numeric('quantity').default('1').notNull(),
  unit: text('unit'),
  houseId: uuid('house_id').references(() => houses.id, { onDelete: 'set null' }),
  barcodeUpc: text('barcode_upc'),
  imageUrl: text('image_url'),
  expirationDate: date('expiration_date'),
  expirationEstimated: boolean('expiration_estimated').default(false).notNull(),
  addedBy: text('added_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  notes: text('notes'),
  opened: boolean('opened').default(false).notNull(),
}, (table) => ({
  locationCheck: check('location_check', sql`${table.location} IN ('pantry', 'fridge', 'freezer')`),
}));

// Product cache table
export const productCache = pgTable('product_cache', {
  upc: text('upc').primaryKey(),
  name: text('name'),
  brand: text('brand'),
  category: text('category'),
  imageUrl: text('image_url'),
  source: text('source').notNull(), // 'open_food_facts' | 'manual' | 'kroger' | 'trader_joes'
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
});

// Shopping list items table
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

// Relations
export const householdsRelations = relations(households, ({ many }) => ({
  users: many(users),
  items: many(items),
  houses: many(houses),
}));

export const housesRelations = relations(houses, ({ one, many }) => ({
  household: one(households, {
    fields: [houses.householdId],
    references: [households.id],
  }),
  items: many(items),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  household: one(households, {
    fields: [users.householdId],
    references: [households.id],
  }),
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  household: one(households, {
    fields: [items.householdId],
    references: [households.id],
  }),
  house: one(houses, {
    fields: [items.houseId],
    references: [houses.id],
  }),
  addedByUser: one(users, {
    fields: [items.addedBy],
    references: [users.id],
  }),
}));

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
