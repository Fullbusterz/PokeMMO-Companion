import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { applyEvIncrement, undoLastEvIncrement, zeroEvRecord } from '@/lib/evTraining';
import type { EvHistoryEntry, EvRecord, EvStatKey, EvZoneRef } from '@/lib/evTraining';
import { generateId } from '@/lib/id';

export type EvSession = {
  id: string;
  name: string;
  targets: EvRecord;
  current: EvRecord;
  zone: EvZoneRef | null;
  history: EvHistoryEntry[];
  createdAt: string;
};

type EvSessionStore = {
  sessions: EvSession[];
  createSession: (name: string) => EvSession;
  deleteSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  setTarget: (id: string, stat: EvStatKey, value: number) => void;
  setZone: (id: string, zone: EvZoneRef | null) => void;
  addEvs: (id: string, stat: EvStatKey, amount: number) => void;
  undoLast: (id: string) => void;
};

// Manual counter for a live PokeMMO session — same spirit as shinyStore's
// manual +1 (there's no way for this app to see what's happening inside the
// PokeMMO client). All the increment/undo/cap arithmetic itself lives in
// src/lib/evTraining.ts, pure and Node-testable; this file is only the thin
// AsyncStorage/zustand wiring around it, same split as backup.ts/backupStorage.ts.
export const useEvSessionStore = create<EvSessionStore>()(
  persist(
    (set) => ({
      sessions: [],

      createSession: (name) => {
        const session: EvSession = {
          id: generateId(),
          name: name.trim(),
          targets: zeroEvRecord(),
          current: zeroEvRecord(),
          zone: null,
          history: [],
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ sessions: [session, ...state.sessions] }));
        return session;
      },

      deleteSession: (id) => {
        set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
      },

      renameSession: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, name: trimmed } : s)),
        }));
      },

      setTarget: (id, stat, value) => {
        const clamped = Math.max(0, Math.min(252, Math.round(value)));
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, targets: { ...s.targets, [stat]: clamped } } : s)),
        }));
      },

      setZone: (id, zone) => {
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, zone } : s)),
        }));
      },

      addEvs: (id, stat, amount) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== id) return s;
            const next = applyEvIncrement({ current: s.current, history: s.history }, stat, amount);
            return { ...s, current: next.current, history: next.history };
          }),
        }));
      },

      undoLast: (id) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== id) return s;
            const next = undoLastEvIncrement({ current: s.current, history: s.history });
            return { ...s, current: next.current, history: next.history };
          }),
        }));
      },
    }),
    {
      name: 'pokemmo-ev-sessions',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
