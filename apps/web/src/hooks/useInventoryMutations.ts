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
  onPurchasedSuccess: (slItem: ShoppingListItem) => void;
  onPurchasedError: (msg: string) => void;
}

export function useInventoryMutations(callbacks: MutationCallbacks) {
  const queryClient = useQueryClient();
  const [consumingIds, setConsumingIds] = useState<Set<string>>(new Set());

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
    mutationFn: ({
      id,
      quantity,
      items: _items,
    }: {
      id: string;
      quantity: number;
      items: InventoryItem[];
    }) => api.updateItem(id, { quantity }),
    onSuccess: (updated, { id, items }) => {
      setConsumingIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
      if (updated) {
        callbacks.onConsumeSuccess(updated, items);
      }
    },
    onError: (error, { id }) => {
      setConsumingIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      callbacks.onConsumeError(
        id,
        error instanceof Error ? error.message : "Failed to update quantity."
      );
    },
  });

  const consume = (item: InventoryItem, allItems: InventoryItem[]) => {
    setConsumingIds((prev) => new Set(prev).add(item.id));
    consumeMutation.mutate({ id: item.id, quantity: item.quantity - 1, items: allItems });
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
    consume,
    consumingIds,
  };
}
