import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InventoryItem, type CreateItemDto, type ShoppingListItem } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { ReceiptProcessingResult } from "@/lib/api";

export interface MutationCallbacks {
  onItemSaved: () => void;
  onItemSaveError: (msg: string) => void;
  onDeleteError: (msg: string) => void;
  onReceiptUploaded: (data: ReceiptProcessingResult) => void;
  onReceiptUploadError: (msg: string) => void;
  onBulkAddSuccess: () => void;
  onBulkAddError: (msg: string) => void;
  onShoppingListError: (msg: string) => void;
  onConsumeSuccess: (updatedItem: InventoryItem, sourceItems: InventoryItem[]) => void;
  onConsumeError: (id: string, msg: string) => void;
  onQuickUpdateError: (msg: string) => void;
  onPurchasedSuccess: (slItem: ShoppingListItem) => void;
  onPurchasedError: (msg: string) => void;
}

export function useInventoryMutations(callbacks: MutationCallbacks) {
  const queryClient = useQueryClient();
  // Kept for prop compatibility, but quantity changes are now optimistic so we
  // never disable the controls — this stays an empty set.
  const [consumingIds] = useState<Set<string>>(() => new Set());

  // Read the freshest quantity for an item from any cached inventory list.
  // Used so chained +/- taps compose off the optimistic value, not a stale render.
  const readCachedQuantity = (id: string, fallback: number) => {
    const caches = queryClient.getQueriesData<InventoryItem[]>({
      queryKey: queryKeys.inventory.lists(),
    });
    for (const [, data] of caches) {
      if (Array.isArray(data)) {
        const found = data.find((i) => i.id === id);
        if (found) return found.quantity;
      }
    }
    return fallback;
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateItemDto) => api.createItem(data),
    onSuccess: () => {
      callbacks.onItemSaved();
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to save item. Please try again.";
      callbacks.onItemSaveError(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateItemDto }) => api.updateItem(id, data),
    onSuccess: () => {
      callbacks.onItemSaved();
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
    },
    onError: (error) => {
      const msg =
        error instanceof Error ? error.message : "Failed to update item. Please try again.";
      callbacks.onItemSaveError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
    },
    onError: (error) => {
      callbacks.onDeleteError(error instanceof Error ? error.message : "Failed to delete item.");
    },
  });

  const uploadReceiptMutation = useMutation({
    mutationFn: (file: File) => api.uploadReceipt(file),
    onSuccess: (data) => {
      if (data) {
        callbacks.onReceiptUploaded(data);
      }
    },
    onError: (error) => {
      callbacks.onReceiptUploadError(
        error instanceof Error ? error.message : "Failed to process receipt."
      );
    },
  });

  const bulkAddReceiptItemsMutation = useMutation({
    mutationFn: (items: CreateItemDto[]) => Promise.all(items.map((item) => api.createItem(item))),
    onSuccess: () => {
      callbacks.onBulkAddSuccess();
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
    },
    onError: (error) => {
      callbacks.onBulkAddError(
        error instanceof Error ? error.message : "Some items could not be added."
      );
    },
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
    onError: (error) => {
      callbacks.onShoppingListError(
        error instanceof Error ? error.message : "Failed to add to re-order list."
      );
    },
  });

  const deleteShoppingListMutation = useMutation({
    mutationFn: (id: string) => api.deleteShoppingListItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.lists() });
    },
    onError: (error) => {
      callbacks.onShoppingListError(
        error instanceof Error ? error.message : "Failed to remove item from list."
      );
    },
  });

  const markPurchasedMutation = useMutation({
    mutationFn: (slItem: ShoppingListItem) => api.markShoppingListPurchased(slItem.id),
    onSuccess: (_, slItem) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList.lists() });
      callbacks.onPurchasedSuccess(slItem);
    },
    onError: (error) => {
      callbacks.onPurchasedError(
        error instanceof Error ? error.message : "Failed to mark item as purchased."
      );
    },
  });

  const consumeMutation = useMutation({
    // Resolve the target quantity from the (already optimistically-updated)
    // cache at request time so concurrent taps each send the composed value.
    // (We intentionally do NOT use a serial `scope` here: that would defer the
    // optimistic onMutate of later taps until earlier requests settle, killing
    // the instant feedback this change exists to provide. Same-tick taps all
    // read the final composed quantity, and onSettled reconciles with server.)
    mutationFn: ({
      id,
      fallbackQuantity,
    }: {
      id: string;
      delta: number;
      fallbackQuantity: number;
      items: InventoryItem[];
    }) => api.updateItem(id, { quantity: readCachedQuantity(id, fallbackQuantity) }),
    onMutate: async ({ id, delta }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.inventory.lists() });
      const snapshots = queryClient.getQueriesData<InventoryItem[]>({
        queryKey: queryKeys.inventory.lists(),
      });
      queryClient.setQueriesData<InventoryItem[]>(
        { queryKey: queryKeys.inventory.lists() },
        (old) =>
          Array.isArray(old)
            ? old.map((it) =>
                it.id === id ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it
              )
            : old
      );
      return { snapshots };
    },
    onSuccess: (updated, { items }) => {
      if (updated) {
        callbacks.onConsumeSuccess(updated, items);
      }
    },
    onError: (error, { id }, context) => {
      // Roll back every list cache we optimistically touched.
      context?.snapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      callbacks.onConsumeError(
        id,
        error instanceof Error ? error.message : "Failed to update quantity."
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
    },
  });

  const quickUpdateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { opened?: boolean } }) =>
      api.updateItem(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
    },
    onError: (error) => {
      callbacks.onQuickUpdateError(error instanceof Error ? error.message : "Failed to update.");
    },
  });

  const adjustQuantity = (item: InventoryItem, delta: number, allItems: InventoryItem[]) => {
    consumeMutation.mutate({
      id: item.id,
      delta,
      fallbackQuantity: Math.max(0, item.quantity + delta),
      items: allItems,
    });
  };

  const quickUpdate = (id: string, patch: { opened?: boolean }) => {
    quickUpdateMutation.mutate({ id, patch });
  };

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    uploadReceiptMutation,
    bulkAddReceiptItemsMutation,
    addToShoppingListMutation,
    deleteShoppingListMutation,
    markPurchasedMutation,
    consumingIds,
    adjustQuantity,
    quickUpdate,
  };
}
