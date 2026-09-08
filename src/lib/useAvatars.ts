import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

import { fetchAvatars, type ViewerRow } from './onlineTournament';

// Keeps the table's profile pictures available to the screen without paying for
// them on every poll.
//
// The rule is simply: a picture is fetched when its version number changes and
// never otherwise. With nine or ten people that means about ten small requests
// at the start of the event and then nothing, instead of a hundred kilobytes
// every six seconds for three hours. The cache is written to storage too, so
// reopening the link (or the browser reloading the PWA) shows the faces
// immediately rather than blank discs that fill in a second later.

// `image: null` records a KNOWN ABSENCE at that version, and it is load-bearing.
// Removing a picture leaves the viewer's version moving forward (it has to, or a
// device holding version 1 would reuse the old photo when a new one arrived and
// reset the counter) — so a viewer can legitimately say "version 3" with no row
// to fetch. Without caching the absence, every device re-requested that missing
// picture on every load, forever. Measured, not theorised: the bug showed up as
// one avatar request per reload for a viewer who had cleared their photo.
type CachedAvatar = { version: number; image: string | null };
type AvatarCache = Record<string, CachedAvatar>;

const cacheKey = (code: string) => `pokemmo-avatars:${code}`;

function toImageMap(cache: AvatarCache): Map<string, string> {
  const map = new Map<string, string>();
  for (const [id, entry] of Object.entries(cache)) {
    if (entry.image) map.set(id, entry.image);
  }
  return map;
}

export function useAvatars(code: string | null, viewers: ViewerRow[]): Map<string, string> {
  const [images, setImages] = useState<Map<string, string>>(new Map());
  const cacheRef = useRef<AvatarCache>({});
  // State, not a ref, on purpose: the stored cache arrives asynchronously, and
  // the viewer list usually arrives first. With a ref, the fetch effect would
  // run once against an empty cache, bail out because the cache had not loaded
  // yet, and then never re-run — the signature only moves when somebody
  // changes their picture. The result was a re-download of images the device
  // already had (measured: one avatar request per reload). As state, loading
  // the cache is itself what re-runs the effect, with the cache in hand.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  // Rehydrate whatever this device already downloaded for this tournament.
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    AsyncStorage.getItem(cacheKey(code))
      .then((stored) => {
        if (cancelled || !stored) return;
        const parsed = JSON.parse(stored) as AvatarCache;
        cacheRef.current = parsed;
        setImages(toImageMap(parsed));
      })
      .catch(() => {
        // A corrupt or unreadable cache just means re-downloading.
      })
      .finally(() => {
        if (!cancelled) setHydratedFor(code);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  // The signature is what decides whether anything needs fetching: it changes
  // only when someone's version moves, so the effect stays quiet through the
  // poll ticks that merely re-create the viewer array.
  const signature = viewers.map((v) => `${v.id}:${v.avatar_version ?? 0}`).join(',');

  useEffect(() => {
    if (!code || hydratedFor !== code || inFlightRef.current) return;

    const wanted = viewers.filter((v) => (v.avatar_version ?? 0) > 0);
    const stale = wanted.filter((v) => cacheRef.current[v.id]?.version !== v.avatar_version);

    // Someone left the tournament: drop what we are holding for them. Guarded on
    // a non-empty viewer list, because an empty one means "the first poll has
    // not answered yet", NOT "everybody is gone" — without the guard this ran
    // once on mount and wiped the whole stored cache, so every reload
    // re-downloaded every picture (measured: the cache was emptied at 1198ms
    // and the viewers arrived at 1461ms).
    const liveIds = new Set(wanted.map((v) => v.id));
    const orphans =
      viewers.length === 0 ? [] : Object.keys(cacheRef.current).filter((id) => !liveIds.has(id));

    if (stale.length === 0 && orphans.length === 0) return;

    let cancelled = false;
    inFlightRef.current = true;

    (async () => {
      try {
        const rows = stale.length > 0 ? await fetchAvatars(code, stale.map((v) => v.id)) : [];
        if (cancelled) return;

        const next: AvatarCache = { ...cacheRef.current };
        for (const id of orphans) delete next[id];
        // Anything asked for and not returned is recorded as "no picture at
        // this version" rather than left blank, so it is not asked for again
        // until the version moves.
        const byId = new Map(rows.map((row) => [row.viewer_id, row]));
        for (const v of stale) {
          const row = byId.get(v.id);
          next[v.id] = row
            ? { version: row.version, image: row.image }
            : { version: v.avatar_version ?? 0, image: null };
        }

        cacheRef.current = next;
        setImages(toImageMap(next));
        AsyncStorage.setItem(cacheKey(code), JSON.stringify(next)).catch(() => {
          // Storage full or unavailable: the pictures still work this session.
        });
      } catch {
        // Offline or a failed request: keep showing what we have and retry on
        // the next change.
      } finally {
        inFlightRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
    // `viewers` itself is not a dependency: it is a fresh array on every poll,
    // while the signature only moves when a picture actually changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, signature, hydratedFor]);

  return images;
}
