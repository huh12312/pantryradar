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

// Households table
export const households = pgTable('households', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').unique().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
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
  barcodeUpc: text('barcode_upc'),
  imageUrl: text('image_url'),
  expirationDate: date('expiration_date'),
  expirationEstimated: boolean('expiration_estimated').default(false).notNull(),
  addedBy: text('added_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  notes: text('notes'),
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
  source: text('source').notNull(), // 'open_food_facts' | 'manual'
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const householdsRelations = relations(households, ({ many }) => ({
  users: many(users),
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
  addedByUser: one(users, {
    fields: [items.addedBy],
    references: [users.id],
  }),
}));
