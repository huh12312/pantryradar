import * as Network from "expo-network";
import { apiClient } from "./api";
import {
  getSyncQueue,
  removeSyncQueueEntry,
  addToSyncQueue,
  insertItem,
  updateItem as updateItemLocal,
  deleteItem as deleteItemLocal,
  clearAllItems,
  getShoppingListItems,
  insertShoppingListItem,
  updateShoppingListItemStatus,
  deleteShoppingListItem,
  clearAllShoppingListItems,
  type LocalShoppingListItem,
} from "./db";
import type { Item, CreateItemInput, UpdateItemInput } from "@pantrymaid/shared";
import type { CreateShoppingListItemInput, UpdateShoppingListItemInput } from "@pantrymaid/shared/schemas";
import { generateUUID } from "./db";

let isSyncing = false;

export async function isOnline(): Promise<boolean> {
  try {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected === true && networkState.isInternetReachable === true;
  } catch (error) {
    console.error("Failed to check network state:", error);
    return false;
  }
}

export async function syncQueue(): Promise<void> {
  if (isSyncing) {
    return;
  }

  const online = await isOnline();
  if (!online) {
    console.log("Offline - skipping sync");
    return;
  }

  isSyncing = true;

  try {
    const queue = await getSyncQueue();
    console.log(`Syncing ${queue.length} items...`);

    for (const entry of queue) {
      try {
        if (entry.tableName === "items") {
          if (entry.action === "create") {
            const result = await apiClient.createItem(entry.data as CreateItemInput);
            if (result.success) {
              await removeSyncQueueEntry(entry.id);
            }
          } else if (entry.action === "update") {
            const result = await apiClient.updateItem(
              entry.recordId,
              entry.data as UpdateItemInput
            );
            if (result.success) {
              await removeSyncQueueEntry(entry.id);
            }
          } else if (entry.action === "delete") {
            const result = await apiClient.deleteItem(entry.recordId);
            if (result.success) {
              await removeSyncQueueEntry(entry.id);
            }
          }
        } else if (entry.tableName === "shopping_list_items") {
          if (entry.action === "create") {
            const result = await apiClient.createShoppingListItem(
              entry.data as CreateShoppingListItemInput
            );
            if (result.success) await removeSyncQueueEntry(entry.id);
          } else if (entry.action === "update") {
            const result = await apiClient.updateShoppingListItem(
              entry.recordId,
              entry.data as UpdateShoppingListItemInput
            );
            if (result.success) await removeSyncQueueEntry(entry.id);
          } else if (entry.action === "delete") {
            const result = await apiClient.deleteShoppingListItem(entry.recordId);
            if (result.success) await removeSyncQueueEntry(entry.id);
          }
        }
      } catch (error) {
        console.error(`Failed to sync entry ${entry.id}:`, error);
        // Keep the entry in the queue for next sync attempt
      }
    }
  } finally {
    isSyncing = false;
  }
}

export async function syncFromServer(): Promise<void> {
  const online = await isOnline();
  if (!online) {
    return;
  }

  try {
    // Fetch all items from server
    const locations: Array<"pantry" | "fridge" | "freezer"> = [
      "pantry",
      "fridge",
      "freezer",
    ];

    const allServerItems: Item[] = [];
    for (const location of locations) {
      const result = await apiClient.getItems(location);
      if (result.success && result.data) {
        allServerItems.push(...result.data.items);
      }
    }

    // Clear local items and replace with server data
    await clearAllItems();
    for (const item of allServerItems) {
      await insertItem(item);
    }

    console.log(`Synced ${allServerItems.length} items from server`);

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
          addedAt: typeof slItem.addedAt === 'string' ? slItem.addedAt : slItem.addedAt.toISOString?.() ?? String(slItem.addedAt),
          updatedAt: typeof slItem.updatedAt === 'string' ? slItem.updatedAt : slItem.updatedAt.toISOString?.() ?? String(slItem.updatedAt),
        });
      }
    }
  } catch (error) {
    console.error("Failed to sync from server:", error);
  }
}

// Offline-first item operations
export async function createItemOffline(data: CreateItemInput): Promise<Item> {
  const now = new Date();
  const item: Item = {
    id: generateUUID(),
    householdId: "local", // Will be set by server
    name: data.name,
    brand: data.brand || null,
    category: data.category || null,
    location: data.location,
    quantity: data.quantity || 1,
    unit: data.unit || null,
    barcodeUpc: data.barcodeUpc || null,
    expirationDate: data.expirationDate || null,
    expirationEstimated: data.expirationEstimated || false,
    opened: data.opened ?? false,
    addedBy: "local", // Will be set by server
    addedAt: now,
    updatedAt: now,
    notes: data.notes || null,
  };

  await insertItem(item);
  await addToSyncQueue("INSERT", "items", item.id, data);

  // Trigger background sync
  syncQueue();

  return item;
}

export async function updateItemOffline(
  id: string,
  data: UpdateItemInput
): Promise<void> {
  await updateItemLocal(id, data);
  await addToSyncQueue("UPDATE", "items", id, data);

  // Trigger background sync
  syncQueue();
}

export async function deleteItemOffline(id: string): Promise<void> {
  await deleteItemLocal(id);
  await addToSyncQueue("DELETE", "items", id, {});

  // Trigger background sync
  syncQueue();
}

export async function createShoppingListItemOffline(data: {
  name: string;
  brand?: string;
  category?: string;
  unit?: string;
  suggestedQty?: number;
  sourceItemId?: string;
}): Promise<LocalShoppingListItem> {
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
  await updateShoppingListItemStatus(id, "purchased");
  await addToSyncQueue("UPDATE", "shopping_list_items", id, { status: "purchased" });
  syncQueue();
}

export async function deleteShoppingListItemOffline(id: string): Promise<void> {
  await deleteShoppingListItem(id);
  await addToSyncQueue("DELETE", "shopping_list_items", id, {});
  syncQueue();
}
