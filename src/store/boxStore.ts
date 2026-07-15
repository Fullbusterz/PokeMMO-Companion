import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { generateId } from '@/lib/id';
import { defaultBuild, type TeamMemberBuild } from '@/lib/showdown';

// A saved build for one of the user's real, in-game Pokemon ("Mi caja") —
// reusable across the app (damage calculator, team builder, Showdown export)
// instead of re-entering the same nature/EVs/IVs/moves every time. Shares
// its nature/ability/item/evs/ivs/moves shape 1:1 with TeamMemberBuild
// (src/lib/showdown.ts, already used by the team builder's per-member sets)
// so exportTeamToShowdown()/totalEvs() work unmodified on either one — a box
// build is just a TeamMemberBuild that also remembers which species it's
// for, its own id, and when it was saved.
export type BoxBuild = TeamMemberBuild & {
  id: string;
  pokemonId: number;
  createdAt: string;
};

type BoxStore = {
  builds: BoxBuild[];
  /** Creates a build with default stats (see defaultBuild()) for the given species and returns its id, so the caller can navigate straight to the editor. */
  createBuild: (pokemonId: number) => string;
  /** Functional updater, not a computed next value — same rule as the team
      builder's BuildEditorModal (see CLAUDE.md, "bug real encontrado" note):
      routing every field change through the latest state instead of a
      value closed over from a possibly-stale render avoids one edit
      silently clobbering another. */
  updateBuild: (id: string, updater: (prev: BoxBuild) => BoxBuild) => void;
  deleteBuild: (id: string) => void;
  /** Returns the new build's id, or null if the source no longer exists. */
  duplicateBuild: (id: string) => string | null;
};

export const useBoxStore = create<BoxStore>()(
  persist(
    (set, get) => ({
      builds: [],

      createBuild: (pokemonId) => {
        const build: BoxBuild = {
          id: generateId(),
          pokemonId,
          createdAt: new Date().toISOString(),
          ...defaultBuild(),
        };
        set((state) => ({ builds: [build, ...state.builds] }));
        return build.id;
      },

      updateBuild: (id, updater) => {
        set((state) => ({
          builds: state.builds.map((b) => (b.id === id ? updater(b) : b)),
        }));
      },

      deleteBuild: (id) => {
        set((state) => ({ builds: state.builds.filter((b) => b.id !== id) }));
      },

      duplicateBuild: (id) => {
        const source = get().builds.find((b) => b.id === id);
        if (!source) return null;
        const copy: BoxBuild = { ...source, id: generateId(), createdAt: new Date().toISOString() };
        set((state) => ({ builds: [copy, ...state.builds] }));
        return copy.id;
      },
    }),
    {
      name: 'pokemmo-box',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
