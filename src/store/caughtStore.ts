import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { ALL_POKEMON, POKEDEX_REGIONS, regionForId, type RegionFilter } from '@/lib/pokedex';

// Personal Pokedex "caught" log — purely a player's own manual record (there's
// no way for this app to see what's happening inside the PokeMMO client, same
// limitation already documented on useShinyStore), so this is just a toggle
// the user flips themselves per species. Kept as its own store rather than
// folded into useShinyStore since "caught at some point" and "currently
// hunting a shiny of" are unrelated concepts.
type CaughtStore = {
  // Persisted straight as an array of dex ids (JSON-friendly, no extra
  // encode/decode step needed for zustand's persist middleware) — components
  // that need fast membership checks should select it once and build a Set
  // locally rather than calling .includes() per row in a big list.
  caughtIds: number[];
  toggleCaught: (id: number) => void;
};

export const useCaughtStore = create<CaughtStore>()(
  persist(
    (set) => ({
      caughtIds: [],

      toggleCaught: (id) => {
        set((state) => ({
          caughtIds: state.caughtIds.includes(id)
            ? state.caughtIds.filter((existing) => existing !== id)
            : [...state.caughtIds, id],
        }));
      },
    }),
    {
      name: 'pokemmo-caught',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * Non-reactive helper for one-off checks outside a component's render (e.g.
 * building a summary in a loop). A component that needs to re-render when the
 * caught state changes should select `caughtIds` directly instead:
 * `useCaughtStore((s) => s.caughtIds.includes(id))`.
 */
export function isCaught(id: number): boolean {
  return useCaughtStore.getState().caughtIds.includes(id);
}

// Per-region dex size, derived from the real Pokemon list (never hardcoded)
// so it can't silently drift if a region's roster is ever revised.
const REGION_TOTALS: Record<RegionFilter, number> = Object.fromEntries(
  POKEDEX_REGIONS.map((r) => [r.id, ALL_POKEMON.filter((p) => regionForId(p.id) === r.id).length])
) as Record<RegionFilter, number>;

export function regionTotal(region: RegionFilter): number {
  return REGION_TOTALS[region];
}

export const TOTAL_POKEMON = ALL_POKEMON.length;

/**
 * Pure counting helper — how many of the given caught ids fall in each
 * region. Kept dependency-free (just plain arrays/numbers in and out) so it
 * can be exercised directly in a Node test without booting React Native.
 */
export function countCaughtByRegion(caughtIds: number[]): Record<RegionFilter, number> {
  const counts = Object.fromEntries(POKEDEX_REGIONS.map((r) => [r.id, 0])) as Record<RegionFilter, number>;
  for (const id of caughtIds) {
    counts[regionForId(id)] += 1;
  }
  return counts;
}
