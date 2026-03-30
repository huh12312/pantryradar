import * as SQLite from "expo-sqlite";
import type { Item, ItemLocation, SyncQueueEntry } from "@pantrymaid/shared";

const DB_NAME = "pantrymaid.db";

export interface LocalItem {
  id: string;
  householdId: string;
  name: string;
  brand: string | null;
  category: string | null;
  location: ItemLocation;
  quantity: number;
  unit: string | null;
  barcodeUpc: string | null;
  expirationDate: string | null; // ISO date string
  expirationEstimated: number; // 0 or 1 for boolean
  addedBy: string;
  addedAt: string; // ISO date string
  updatedAt: string; // ISO date string
  notes: string | null;
}

export interface LocalSyncQueue {
  id: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  tableName: string;
  recordId: string;
  payload: string; // JSON stringified data
  createdAt: string; // ISO date string
}

let db: SQLite.SQLiteDatabase | null = null;

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  db = await SQLite.openDatabaseAsync(DB_NAME);

  // Create items table
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
      addedBy TEXT NOT NULL,
      addedAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      notes TEXT
    );
  `);

  // Create sync queue table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
      tableName TEXT NOT NULL,
      recordId TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  // Create index for location-based queries
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_items_location ON items(location);
  `);

  // Create index for household isolation
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_items_household ON items(householdId);
  `);

  return db;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    return initDatabase();
  }
  return db;
}

// Item operations
export async function getItemsByLocation(
  location: ItemLocation
): Promise<Item[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocalItem>(
    "SELECT * FROM items WHERE location = ? ORDER BY updatedAt DESC",
    [location]
  );
  return rows.map(localItemToItem);
}

export async function getItemById(id: string): Promise<Item | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<LocalItem>(
    "SELECT * FROM items WHERE id = ?",
    [id]
  );
  return row ? localItemToItem(row) : null;
}

export async function insertItem(item: Item): Promise<void> {
  const database = await getDatabase();
  const localItem = itemToLocalItem(item);

  await database.runAsync(
    `INSERT INTO items (
      id, householdId, name, brand, category, location, quantity, unit,
      barcodeUpc, expirationDate, expirationEstimated, addedBy, addedAt, updatedAt, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      localItem.id,
      localItem.householdId,
      localItem.name,
      localItem.brand,
      localItem.category,
      localItem.location,
      localItem.quantity,
      localItem.unit,
      localItem.barcodeUpc,
      localItem.expirationDate,
      localItem.expirationEstimated,
      localItem.addedBy,
      localItem.addedAt,
      localItem.updatedAt,
      localItem.notes,
    ]
  );
}

export async function updateItem(id: string, item: Partial<Item>): Promise<void> {
  const database = await getDatabase();
  const existing = await getItemById(id);
  if (!existing) {
    throw new Error(`Item ${id} not found`);
  }

  const updated = { ...existing, ...item, updatedAt: new Date() };
  const localItem = itemToLocalItem(updated);

  await database.runAsync(
    `UPDATE items SET
      name = ?, brand = ?, category = ?, location = ?, quantity = ?, unit = ?,
      barcodeUpc = ?, expirationDate = ?, expirationEstimated = ?, notes = ?, updatedAt = ?
    WHERE id = ?`,
    [
      localItem.name,
      localItem.brand,
      localItem.category,
      localItem.location,
      localItem.quantity,
      localItem.unit,
      localItem.barcodeUpc,
      localItem.expirationDate,
      localItem.expirationEstimated,
      localItem.notes,
      localItem.updatedAt,
      id,
    ]
  );
}

export async function deleteItem(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM items WHERE id = ?", [id]);
}

export async function clearAllItems(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM items");
}

// Sync queue operations
export async function addToSyncQueue(
  operation: "INSERT" | "UPDATE" | "DELETE",
  tableName: string,
  recordId: string,
  payload: unknown
): Promise<void> {
  const database = await getDatabase();
  const id = generateUUID();
  const createdAt = new Date().toISOString();

  await database.runAsync(
    "INSERT INTO sync_queue (id, operation, tableName, recordId, payload, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
    [id, operation, tableName, recordId, JSON.stringify(payload), createdAt]
  );
}

export async function getSyncQueue(): Promise<SyncQueueEntry[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<LocalSyncQueue>(
    "SELECT * FROM sync_queue ORDER BY createdAt ASC"
  );

  return rows.map((row) => ({
    id: row.id,
    action: row.operation.toLowerCase() as "create" | "update" | "delete",
    tableName: row.tableName,
    recordId: row.recordId,
    data: JSON.parse(row.payload),
    createdAt: new Date(row.createdAt),
    synced: false,
  }));
}

export async function removeSyncQueueEntry(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM sync_queue WHERE id = ?", [id]);
}

export async function clearSyncQueue(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM sync_queue");
}

// Helper functions
function localItemToItem(local: LocalItem): Item {
  return {
    id: local.id,
    householdId: local.householdId,
    name: local.name,
    brand: local.brand,
    category: local.category,
    location: local.location,
    quantity: local.quantity,
    unit: local.unit,
    barcodeUpc: local.barcodeUpc,
    expirationDate: local.expirationDate ? new Date(local.expirationDate) : null,
    expirationEstimated: local.expirationEstimated === 1,
    addedBy: local.addedBy,
    addedAt: new Date(local.addedAt),
    updatedAt: new Date(local.updatedAt),
    notes: local.notes,
  };
}

function itemToLocalItem(item: Item): LocalItem {
  return {
    id: item.id,
    householdId: item.householdId,
    name: item.name,
    brand: item.brand || null,
    category: item.category || null,
    location: item.location,
    quantity: item.quantity,
    unit: item.unit || null,
    barcodeUpc: item.barcodeUpc || null,
    expirationDate: item.expirationDate ? item.expirationDate.toISOString() : null,
    expirationEstimated: item.expirationEstimated ? 1 : 0,
    addedBy: item.addedBy,
    addedAt: item.addedAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    notes: item.notes || null,
  };
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export { generateUUID };
