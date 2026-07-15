import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { RegionId } from '@/lib/guides';

type GuideBookmarkStore = {
  // One bookmark per region — a player works through one region's route at a
  // time, so "where did I leave off" only ever needs a single tramo order
  // per region, not a list.
  bookmarks: Partial<Record<RegionId, number>>;
  setBookmark: (region: RegionId, order: number) => void;
  clearBookmark: (region: RegionId) => void;
};

export const useGuideBookmarkStore = create<GuideBookmarkStore>()(
  persist(
    (set) => ({
      bookmarks: {},
      setBookmark: (region, order) => set((s) => ({ bookmarks: { ...s.bookmarks, [region]: order } })),
      clearBookmark: (region) =>
        set((s) => {
          const next = { ...s.bookmarks };
          delete next[region];
          return { bookmarks: next };
        }),
    }),
    {
      name: 'pokemmo-guide-bookmarks',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
