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
} from "./db";
import type { Item, CreateItemInput, UpdateItemInput } from "@pantrymaid/shared";
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
