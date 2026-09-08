import { useCallback, useEffect, useRef, useState } from 'react';

import {
  actionableReports,
  createOnlineTournament,
  documentFingerprint,
  fetchOnlineTournament,
  generateOrganizerSecret,
  mergeSignups,
  pushOnlineTournament,
  type BetRow,
  type ReportRow,
  type ViewerRow,
} from './onlineTournament';
import { isOnlineConfigured, ONLINE_POLL_MS } from './supabase';
import { useTournamentStore } from '@/store/tournamentStore';
import type { Tournament } from '@/types/tournament';

export type OnlineStatus = 'offline' | 'publishing' | 'syncing' | 'synced' | 'error';

// The organizer's side of the live tournament. Three jobs, on one timer:
//   1. pull the reports players have submitted, so they can be confirmed;
//   2. pull sign-ups and fold new names into the roster (before round 1);
//   3. push the local document whenever it changes.
// The local store stays the single source of truth for the document — the
// server is a mirror of it, never the other way round. That's what makes
// "two organizer devices" a non-problem: there's only ever one writer.
export function useOnlineOrganizer(tournament: Tournament | undefined) {
  const setOnlineLink = useTournamentStore((s) => s.setOnlineLink);
  const addSwissParticipant = useTournamentStore((s) => s.addSwissParticipant);
  const setMatchWinner = useTournamentStore((s) => s.setMatchWinner);

  const [status, setStatus] = useState<OnlineStatus>('offline');
  const [reports, setReports] = useState<ReportRow[]>([]);
  // The betting side of the event. Already part of every snapshot; the
  // organizer's screen just never surfaced it, so the only way to see the chip
  // standings was to open your own share link on another device.
  const [viewers, setViewers] = useState<ViewerRow[]>([]);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const online = tournament?.online;
  const code = online?.code ?? null;
  const secret = online?.secret ?? null;

  // What we last successfully pushed, so an unchanged document doesn't
  // generate a write every poll.
  const lastPushedRef = useRef<string | null>(null);
  // Timestamp of the in-flight push, not a plain boolean: a lock that can only
  // be cleared by the push that took it is one hung request away from freezing
  // sync for the rest of the session (which is exactly what happened in
  // testing, when Fast Refresh orphaned a push mid-flight). Requests are
  // bounded by a timeout now, so a lock older than that can only be a lost
  // one — take it back rather than stop syncing.
  const pushStartedAtRef = useRef<number | null>(null);
  const PUSH_LOCK_STALE_MS = 30000;

  const publish = useCallback(async (): Promise<{ ok: boolean; code?: string }> => {
    if (!tournament || !isOnlineConfigured()) return { ok: false };
    setStatus('publishing');
    try {
      const newSecret = generateOrganizerSecret();
      const { code: newCode } = await createOnlineTournament(tournament, newSecret);
      setOnlineLink(tournament.id, { code: newCode, secret: newSecret, syncedAt: new Date().toISOString() });
      lastPushedRef.current = documentFingerprint(tournament);
      setStatus('synced');
      return { ok: true, code: newCode };
    } catch {
      setStatus('error');
      return { ok: false };
    }
  }, [tournament, setOnlineLink]);

  // Confirming a report has to do two things atomically from the player's
  // point of view: apply it locally, and consume the server row so it stops
  // coming back on the next poll. The push carries both.
  //
  // The result is applied through the SAME setMatchWinner the organizer's own
  // taps use. That matters: pending reports live in their own table and only
  // ever exist in this hook's state, so anything that tried to resolve them
  // out of the tournament document would find nothing and quietly no-op —
  // consuming the player's report while discarding their result.
  const confirmReport = useCallback(
    async (report: ReportRow) => {
      if (!tournament) return;
      setMatchWinner(tournament.id, report.match_id, report.winner_id, report.score ?? undefined);
      setReports((current) => current.filter((r) => r.id !== report.id));
      if (!code || !secret) return;
      try {
        // Read the tournament back out of the store: `tournament` in this
        // closure is the pre-confirmation copy.
        const updated = useTournamentStore.getState().tournaments.find((t) => t.id === tournament.id);
        if (updated) await pushOnlineTournament(code, secret, updated, [report.id]);
      } catch {
        setStatus('error');
      }
    },
    [tournament, code, secret, setMatchWinner]
  );

  const rejectReport = useCallback(
    async (report: ReportRow) => {
      setReports((current) => current.filter((r) => r.id !== report.id));
      if (!tournament || !code || !secret) return;
      try {
        const current = useTournamentStore.getState().tournaments.find((t) => t.id === tournament.id);
        if (current) await pushOnlineTournament(code, secret, current, [report.id]);
      } catch {
        setStatus('error');
      }
    },
    [tournament, code, secret]
  );

  // Lets a screen pull immediately after an action of its own (placing a bet,
  // joining the betting) instead of waiting out the poll interval.
  const refreshNow = useCallback(async () => {
    if (!code) return;
    try {
      const snapshot = await fetchOnlineTournament(code);
      if (!snapshot) return;
      setViewers(snapshot.viewers);
      setBets(snapshot.bets);
      setLastSyncedAt(snapshot.updatedAt);
    } catch {
      setStatus('error');
    }
  }, [code]);

  // Push as soon as the document actually changes, instead of waiting for the
  // next poll. Pairing a round is the moment everyone is staring at their
  // phone, and until the push lands the players cannot see the new round and
  // nobody can bet on it — place_bet correctly refuses a match the server has
  // never heard of. Watching the fingerprint rather than calling a pushNow()
  // at each call site means every mutation path is covered automatically,
  // including ones added later.
  const fingerprint = tournament && code ? documentFingerprint(tournament) : null;
  useEffect(() => {
    if (!code || !secret || !fingerprint) return;
    if (fingerprint === lastPushedRef.current) return;
    let cancelled = false;

    // Small debounce so a burst of edits (confirming four reports in a row)
    // becomes one write rather than four.
    const timer = setTimeout(async () => {
      const lockHeldSince = pushStartedAtRef.current;
      if (lockHeldSince !== null && Date.now() - lockHeldSince < PUSH_LOCK_STALE_MS) return;
      pushStartedAtRef.current = Date.now();
      try {
        const toPush = useTournamentStore.getState().tournaments.find((t) => t.id === tournament?.id);
        if (toPush) {
          await pushOnlineTournament(code, secret, toPush);
          lastPushedRef.current = documentFingerprint(toPush);
          if (!cancelled) setStatus('synced');
        }
      } catch {
        if (!cancelled) setStatus('error');
      } finally {
        pushStartedAtRef.current = null;
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fingerprint, code, secret, tournament?.id]);

  // Poll + reconcile.
  useEffect(() => {
    if (!code || !secret || !tournament || !isOnlineConfigured()) return;
    let cancelled = false;

    async function tick() {
      if (cancelled || !code || !secret) return;
      try {
        const snapshot = await fetchOnlineTournament(code);
        if (cancelled || !snapshot) return;

        const local = useTournamentStore.getState().tournaments.find((t) => t.id === tournament?.id);
        if (!local) return;

        setReports(actionableReports(local, snapshot.reports));
        setViewers(snapshot.viewers);
        setBets(snapshot.bets);
        setLastSyncedAt(snapshot.updatedAt);

        // Fold in anyone who signed up since the last poll. Only possible
        // before round 1 — addSwissParticipant enforces that itself, so a
        // late sign-up is simply ignored rather than corrupting the draw.
        const newNames = mergeSignups(local, snapshot.signups);
        for (const name of newNames) addSwissParticipant(local.id, name);

        // Push if the document moved since the last successful write.
        const fingerprint = documentFingerprint(local);
        const lockHeldSince = pushStartedAtRef.current;
        const isLocked = lockHeldSince !== null && Date.now() - lockHeldSince < PUSH_LOCK_STALE_MS;
        if (fingerprint !== lastPushedRef.current && !isLocked) {
          pushStartedAtRef.current = Date.now();
          try {
            const toPush = useTournamentStore.getState().tournaments.find((t) => t.id === local.id);
            if (toPush) {
              await pushOnlineTournament(code, secret, toPush);
              lastPushedRef.current = documentFingerprint(toPush);
            }
          } finally {
            pushStartedAtRef.current = null;
          }
        }

        if (!cancelled) setStatus('synced');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    setStatus('syncing');
    void tick();
    const interval = setInterval(() => void tick(), ONLINE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // `tournament` itself is intentionally not a dependency: it changes on
    // every local edit, which would tear down and restart the timer each
    // time. The tick always reads the freshest copy from the store instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, secret, tournament?.id, addSwissParticipant]);

  return {
    isConfigured: isOnlineConfigured(),
    isPublished: Boolean(code),
    code,
    status,
    reports,
    viewers,
    bets,
    lastSyncedAt,
    refresh: refreshNow,
    publish,
    confirmReport,
    rejectReport,
  };
}
