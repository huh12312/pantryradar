export const queryKeys = {
  houses: {
    all: ["houses"] as const,
    lists: () => [...queryKeys.houses.all, "list"] as const,
  },
  inventory: {
    all: ["inventory"] as const,
    lists: () => [...queryKeys.inventory.all, "list"] as const,
    list: (houseId?: string | null, location?: string) =>
      [...queryKeys.inventory.lists(), { houseId, location }] as const,
    details: () => [...queryKeys.inventory.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.inventory.details(), id] as const,
  },
  household: {
    all: ["household"] as const,
    details: () => [...queryKeys.household.all, "detail"] as const,
  },
  user: {
    all: ["user"] as const,
    current: () => [...queryKeys.user.all, "current"] as const,
  },
  shoppingList: {
    all: ["shoppingList"] as const,
    lists: () => [...queryKeys.shoppingList.all, "list"] as const,
  },
};
