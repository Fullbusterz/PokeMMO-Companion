// Thin AsyncStorage-touching layer around src/lib/backup.ts's pure codec.
// Kept separate from backup.ts so the codec itself stays importable (and
// testable) from plain Node without pulling in the native AsyncStorage
// module or the zustand stores.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BACKUP_STORE_KEYS, parseBackup, serializeBackup, type BackupStoreKey } from './backup';
import { useBoxStore } from '@/store/boxStore';
import { useCaughtStore } from '@/store/caughtStore';
import { useEvSessionStore } from '@/store/evSessionStore';
import { useGuideBookmarkStore } from '@/store/guideBookmarkStore';
import { useShinyStore } from '@/store/shinyStore';
import { useTournamentStore } from '@/store/tournamentStore';

/** Reads every registered store key straight out of AsyncStorage and packs them into one shareable code. */
export async function exportAllData(): Promise<string> {
  const entries = await Promise.all(BACKUP_STORE_KEYS.map(async (key) => [key, await AsyncStorage.getItem(key)] as const));
  const data: Record<string, string> = {};
  for (const [key, value] of entries) {
    // A key can be legitimately absent — zustand's persist middleware only
    // writes to storage after the first state change, so a store the user
    // never touched (e.g. no shiny hunt ever started) simply isn't in
    // AsyncStorage yet. Skipping it here is correct, not a bug.
    if (value !== null) data[key] = value;
  }
  return serializeBackup(data);
}

// zustand's persist middleware only reads AsyncStorage once, at store
// creation — writing a new raw value directly to storage (as importAllData
// does below) doesn't make an already-mounted store notice by itself. Each
// store exposes `.persist.rehydrate()` (zustand v4 and v5 both) to force a
// re-read + re-merge from storage into the live in-memory state, which is
// what actually makes already-open screens reflect the imported data without
// requiring a full app restart.
const REHYDRATE_BY_KEY: Record<BackupStoreKey, () => void | Promise<void>> = {
  'pokemmo-tournaments': () => useTournamentStore.persist.rehydrate(),
  'pokemmo-shiny-hunts': () => useShinyStore.persist.rehydrate(),
  'pokemmo-guide-bookmarks': () => useGuideBookmarkStore.persist.rehydrate(),
  'pokemmo-caught': () => useCaughtStore.persist.rehydrate(),
  'pokemmo-ev-sessions': () => useEvSessionStore.persist.rehydrate(),
  'pokemmo-box': () => useBoxStore.persist.rehydrate(),
};

/**
 * Validates the code, then REPLACES the current on-device data for every
 * store category present in it (existing data for those categories is
 * overwritten, not merged) and rehydrates the matching zustand stores so the
 * change is visible immediately, without an app restart. Throws
 * BackupParseError (from src/lib/backup.ts) if the code is invalid — nothing
 * is written to storage in that case.
 */
export async function importAllData(code: string): Promise<void> {
  const { stores } = parseBackup(code);
  const keys = Object.keys(stores) as BackupStoreKey[];

  await Promise.all(keys.map((key) => AsyncStorage.setItem(key, stores[key] as string)));
  await Promise.all(keys.map((key) => REHYDRATE_BY_KEY[key]()));
}
