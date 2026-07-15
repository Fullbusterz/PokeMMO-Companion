// Pure global-backup codec: no AsyncStorage here, no React, nothing that
// can't run in plain Node — this whole file is meant to be testable with a
// bare `node -e` script, same spirit as src/lib/exportCode.ts. The thin
// AsyncStorage-touching layer (reading/writing the actual persisted stores,
// rehydrating zustand) lives in src/lib/backupStorage.ts, which imports from
// here.
import { decodeFromCode, encodeToCode } from './exportCode';
import { parseImportedTournament } from './tournamentValidation';

export const BACKUP_VERSION = 1;

// Single source of truth for which persisted stores travel in a backup.
// `pokemmo-locale` is deliberately excluded — it's a device preference, not
// user data, and restoring it on another device would be a surprise, not a
// convenience. Add a new key here (and to REHYDRATE_BY_KEY in
// backupStorage.ts) to fold a future store into the backup.
export const BACKUP_STORE_KEYS = [
  'pokemmo-tournaments',
  'pokemmo-shiny-hunts',
  'pokemmo-guide-bookmarks',
  'pokemmo-caught',
  'pokemmo-ev-sessions',
  'pokemmo-box',
] as const;

export type BackupStoreKey = (typeof BACKUP_STORE_KEYS)[number];

function isBackupStoreKey(key: string): key is BackupStoreKey {
  return (BACKUP_STORE_KEYS as readonly string[]).includes(key);
}

export type BackupPayload = {
  version: number;
  exportedAt: string;
  stores: Partial<Record<BackupStoreKey, string>>;
};

export type ParsedBackup = {
  exportedAt: string;
  stores: Partial<Record<BackupStoreKey, string>>;
};

// Machine-readable so the UI layer can map each failure to its own i18n
// string instead of ever showing a raw/technical message to the user.
export type BackupParseErrorReason =
  | 'invalid-code'
  | 'invalid-shape'
  | 'unsupported-version'
  | 'unknown-store-key'
  | 'invalid-store-value'
  | 'corrupt-tournament';

export class BackupParseError extends Error {
  reason: BackupParseErrorReason;
  constructor(reason: BackupParseErrorReason, message: string) {
    super(message);
    this.name = 'BackupParseError';
    this.reason = reason;
  }
}

/** Wraps the raw persisted-store strings (as read straight from AsyncStorage) into one shareable code. */
export function serializeBackup(data: Record<string, string>): string {
  const stores: Partial<Record<BackupStoreKey, string>> = {};
  for (const key of BACKUP_STORE_KEYS) {
    if (typeof data[key] === 'string') stores[key] = data[key];
  }
  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores,
  };
  return encodeToCode(payload);
}

/**
 * Validates a backup code end to end before any of it is trusted enough to
 * be written back to AsyncStorage: decodable, right shape, known version,
 * only known store keys, each value a JSON-parseable zustand-persist envelope
 * (`{state, version}`), and — for the tournaments store specifically — every
 * individual tournament re-checked with the same referential-integrity
 * validator used by the single-tournament import (parseImportedTournament),
 * so a corrupt backup can't leave the tournament list in a state that
 * crashes downstream screens. Throws BackupParseError, never returns a
 * partially-valid result.
 */
export function parseBackup(code: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = decodeFromCode<unknown>(code);
  } catch {
    throw new BackupParseError('invalid-code', 'The backup code is not valid base64/JSON.');
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new BackupParseError('invalid-shape', 'The backup does not have the expected structure.');
  }
  const payload = raw as Record<string, unknown>;

  if (payload.version !== BACKUP_VERSION) {
    throw new BackupParseError('unsupported-version', `Unsupported backup version: ${String(payload.version)}.`);
  }
  if (typeof payload.exportedAt !== 'string') {
    throw new BackupParseError('invalid-shape', 'Missing or invalid "exportedAt" field.');
  }
  if (typeof payload.stores !== 'object' || payload.stores === null || Array.isArray(payload.stores)) {
    throw new BackupParseError('invalid-shape', 'Missing or invalid "stores" field.');
  }

  const stores: Partial<Record<BackupStoreKey, string>> = {};
  for (const [key, value] of Object.entries(payload.stores as Record<string, unknown>)) {
    if (!isBackupStoreKey(key)) {
      throw new BackupParseError('unknown-store-key', `Unknown store key in backup: "${key}".`);
    }
    if (typeof value !== 'string') {
      throw new BackupParseError('invalid-store-value', `Store "${key}" is not a string.`);
    }

    let envelope: unknown;
    try {
      envelope = JSON.parse(value);
    } catch {
      throw new BackupParseError('invalid-store-value', `Store "${key}" contains corrupt JSON.`);
    }
    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      !('state' in envelope) ||
      typeof (envelope as { version?: unknown }).version !== 'number'
    ) {
      throw new BackupParseError('invalid-store-value', `Store "${key}" is missing the zustand-persist "state"/"version" shape.`);
    }

    if (key === 'pokemmo-tournaments') {
      const state = (envelope as { state?: unknown }).state;
      const tournaments = (state as { tournaments?: unknown } | undefined)?.tournaments;
      if (Array.isArray(tournaments)) {
        for (const tournament of tournaments) {
          if (!parseImportedTournament(tournament)) {
            throw new BackupParseError(
              'corrupt-tournament',
              'A tournament in the backup has broken references (unknown participant/winner ids).'
            );
          }
        }
      }
    }

    stores[key] = value;
  }

  return { exportedAt: payload.exportedAt, stores };
}
