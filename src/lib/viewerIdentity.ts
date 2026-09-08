import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ViewerIdentity } from './onlineTournament';

// Where a device remembers "I am this person in this tournament". Shared by the
// public join screen and the organizer's own screen on purpose: an organizer
// who already opened their own link on this phone should be recognised without
// being asked again, and there should never be two viewer rows for one device.

const identityKey = (code: string) => `pokemmo-join-identity-v2:${code}`;
// Set while waiting for the organizer to fold a sign-up into the roster; once
// the name appears there, the device upgrades itself to a full player viewer.
const pendingKey = (code: string) => `pokemmo-join-pending:${code}`;

export async function loadViewerIdentity(code: string): Promise<ViewerIdentity | null> {
  try {
    const stored = await AsyncStorage.getItem(identityKey(code));
    return stored ? (JSON.parse(stored) as ViewerIdentity) : null;
  } catch {
    // Corrupted or unreadable entry: treat it as "not identified yet" and let
    // the screen ask again, rather than blowing up the whole screen.
    return null;
  }
}

export async function saveViewerIdentity(code: string, identity: ViewerIdentity): Promise<void> {
  try {
    await AsyncStorage.setItem(identityKey(code), JSON.stringify(identity));
    await AsyncStorage.removeItem(pendingKey(code));
  } catch {
    // Losing the write only costs a re-identify next time.
  }
}

export async function clearViewerIdentity(code: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(identityKey(code));
  } catch {
    // Nothing to do — the caller has already cleared it in memory.
  }
}

export async function loadPendingSignupName(code: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(pendingKey(code));
  } catch {
    return null;
  }
}

export async function savePendingSignupName(code: string, name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(pendingKey(code), name);
  } catch {
    // Same as above: the worst case is being asked again.
  }
}
