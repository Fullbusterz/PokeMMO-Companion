import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { generateId } from '@/lib/id';

export type ShinyHunt = {
  id: string;
  pokemonId: number;
  count: number;
  startedAt: string;
  caughtAt: string | null;
};

type ShinyStore = {
  hunts: ShinyHunt[];
  activeHuntId: string | null;
  startHunt: (pokemonId: number) => void;
  increment: (huntId: string) => void;
  decrement: (huntId: string) => void;
  markCaught: (huntId: string) => void;
  deleteHunt: (huntId: string) => void;
  setActiveHunt: (huntId: string | null) => void;
};

// Manual counter, not an automatic encounter detector — there's no way for
// this app to see what's happening inside the PokeMMO client, so the user
// taps +1 themselves after each encounter. No push notifications or
// reminders (project rule) — this only ever shows what the user asked to
// see, on the home screen widget or the dedicated /shinies screen.
export const useShinyStore = create<ShinyStore>()(
  persist(
    (set) => ({
      hunts: [],
      activeHuntId: null,

      startHunt: (pokemonId) => {
        const hunt: ShinyHunt = {
          id: generateId(),
          pokemonId,
          count: 0,
          startedAt: new Date().toISOString(),
          caughtAt: null,
        };
        set((state) => ({ hunts: [hunt, ...state.hunts], activeHuntId: hunt.id }));
      },

      increment: (huntId) => {
        set((state) => ({
          hunts: state.hunts.map((h) => (h.id === huntId ? { ...h, count: h.count + 1 } : h)),
        }));
      },

      decrement: (huntId) => {
        set((state) => ({
          hunts: state.hunts.map((h) => (h.id === huntId ? { ...h, count: Math.max(0, h.count - 1) } : h)),
        }));
      },

      markCaught: (huntId) => {
        set((state) => ({
          hunts: state.hunts.map((h) => (h.id === huntId ? { ...h, caughtAt: new Date().toISOString() } : h)),
          activeHuntId: state.activeHuntId === huntId ? null : state.activeHuntId,
        }));
      },

      deleteHunt: (huntId) => {
        set((state) => ({
          hunts: state.hunts.filter((h) => h.id !== huntId),
          activeHuntId: state.activeHuntId === huntId ? null : state.activeHuntId,
        }));
      },

      setActiveHunt: (huntId) => set({ activeHuntId: huntId }),
    }),
    {
      name: 'pokemmo-shiny-hunts',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
