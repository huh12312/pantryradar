import { create } from "zustand";
import { persist } from "zustand/middleware";

interface HouseStore {
  selectedHouseId: string | null;
  setSelectedHouseId: (id: string) => void;
  clearSelectedHouse: () => void;
}

export const useHouseStore = create<HouseStore>()(
  persist(
    (set) => ({
      selectedHouseId: null,
      setSelectedHouseId: (id) => set({ selectedHouseId: id }),
      clearSelectedHouse: () => set({ selectedHouseId: null }),
    }),
    { name: "pantryradar-selected-house" }
  )
);
