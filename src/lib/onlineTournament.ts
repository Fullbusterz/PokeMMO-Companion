import { callRpc, insertRow, selectRows, SupabaseError } from './supabase';
import { parseImportedTournament } from './tournamentValidation';
import type { MatchScore, Tournament } from '@/types/tournament';

// The share link carries the code only. The organizer secret is generated
// here, stored on the organizer's device, and sent to the server exactly once
// per write — it is never rendered into a link, a QR, or an export code.

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I/L/O/0/1
const CODE_LENGTH = 8;
const SECRET_LENGTH = 32;

function randomFrom(alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function generateJoinCode(): string {
  return randomFrom(CODE_ALPHABET, CODE_LENGTH);
}

export function generateOrganizerSecret(): string {
  return randomFrom('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', SECRET_LENGTH);
}

// Where the share link points. On web we can just reuse the origin the app is
// already served from (so a local dev build hands out localhost links that
// actually work); on native there's no such thing, so it falls back to the
// published web build.
const PUBLIC_APP_URL = (process.env.EXPO_PUBLIC_APP_URL ?? 'https://fullbusterz.github.io/PokeMMO-Companion').replace(
  /\/+$/,
  ''
);

export function joinUrl(code: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    // The app may be served from a sub-path (GitHub Pages). Everything before
    // "/torneos" is the base the router is mounted on.
    const path = window.location.pathname;
    const base = path.includes('/torneos') ? path.slice(0, path.indexOf('/torneos')) : '';
    return `${window.location.origin}${base}/torneos/unirse/${code}`;
  }
  return `${PUBLIC_APP_URL}/torneos/unirse/${code}`;
}

export function normalizeJoinCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export type OnlineRow = {
  code: string;
  data: unknown;
  updated_at: string;
};

export type ReportRow = {
  id: string;
  code: string;
  match_id: string;
  reported_by: string;
  winner_id: string;
  score: MatchScore | null;
  created_at: string;
};

export type SignupRow = {
  id: string;
  code: string;
  name: string;
  created_at: string;
};

export type OnlineSnapshot = {
  tournament: Tournament;
  updatedAt: string;
  reports: ReportRow[];
  signups: SignupRow[];
  viewers: ViewerRow[];
  bets: BetRow[];
};

// Everything the server sends is re-validated through the same parser the
// paste-a-code import uses — the row is public-writable in principle (a
// compromised organizer device, a hand-crafted push), so it is treated as
// untrusted input rather than as our own data coming home.
function parseRow(row: OnlineRow): Tournament | null {
  return parseImportedTournament(row.data);
}

export async function createOnlineTournament(
  tournament: Tournament,
  secret: string
): Promise<{ code: string }> {
  // Retry on the (astronomically unlikely) code collision rather than failing
  // in the organizer's face: 31^8 codes, but a primary-key clash is a plain
  // 409 and costs one extra round trip to recover from.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateJoinCode();
    try {
      await callRpc<string>('create_tournament', {
        p_code: code,
        p_secret: secret,
        p_data: stripLocalOnlyFields(tournament),
      });
      return { code };
    } catch (error) {
      const isCollision = error instanceof SupabaseError && error.status === 409;
      if (!isCollision) throw error;
    }
  }
  throw new SupabaseError('could not allocate a free join code', 409);
}

// `online` holds the organizer secret and `history` is the local undo stack —
// neither belongs on a row every player can read.
function stripLocalOnlyFields(tournament: Tournament): Omit<Tournament, 'online' | 'history'> & { history: [] } {
  const { online: _online, ...rest } = tournament;
  return { ...rest, history: [] };
}

export async function fetchOnlineTournament(code: string): Promise<OnlineSnapshot | null> {
  const rows = await selectRows<OnlineRow>('tournaments', `code=eq.${code}&select=code,data,updated_at`);
  const row = rows[0];
  if (!row) return null;
  const tournament = parseRow(row);
  if (!tournament) return null;

  // One round trip's worth of everything the screens need. They are separate
  // tables rather than one document precisely because players can append to
  // them without being able to rewrite the tournament.
  const [reports, signups, viewers, bets] = await Promise.all([
    selectRows<ReportRow>('tournament_reports', `code=eq.${code}&select=*&order=created_at.asc`),
    selectRows<SignupRow>('tournament_signups', `code=eq.${code}&select=*&order=created_at.asc`),
    fetchViewers(code),
    fetchBets(code),
  ]);

  return { tournament, updatedAt: row.updated_at, reports, signups, viewers, bets };
}

// The fingerprint the organizer's poll compares against to decide whether
// anything needs pushing. It has to be taken over the WHOLE document that gets
// sent, not a couple of interesting fields: an earlier version hashed only
// matches + participants, which meant raising the round count (the "add a 6th
// round" button) or switching betting on changed nothing it could see, so the
// players' screens kept showing the old configuration and a finished event.
export function documentFingerprint(tournament: Tournament): string {
  return JSON.stringify(stripLocalOnlyFields(tournament));
}

export async function pushOnlineTournament(
  code: string,
  secret: string,
  tournament: Tournament,
  consumeReportIds: string[] = []
): Promise<string> {
  return callRpc<string>('push_tournament', {
    p_code: code,
    p_secret: secret,
    p_data: stripLocalOnlyFields(tournament),
    p_consume_reports: consumeReportIds,
  });
}

export async function submitOnlineSignup(code: string, name: string): Promise<'ok' | 'duplicate'> {
  try {
    await insertRow('tournament_signups', { code, name: name.trim() });
    return 'ok';
  } catch (error) {
    // The unique index on (code, lower(name)) is what enforces "one Ferran per
    // tournament"; a 409 here means someone already took that name.
    if (error instanceof SupabaseError && error.status === 409) return 'duplicate';
    throw error;
  }
}

export async function deleteOnlineSignup(code: string, secret: string, signupId: string): Promise<void> {
  await callRpc<boolean>('delete_signup', { p_code: code, p_secret: secret, p_signup_id: signupId });
}

// Signups are a separate table (players can't write the tournament document),
// so the organizer's device is what folds them into the roster. Names already
// on the roster are skipped, which makes this safe to run on every poll.
export function mergeSignups(tournament: Tournament, signups: SignupRow[]): string[] {
  const existing = new Set(tournament.participants.map((p) => p.name.trim().toLowerCase()));
  const newNames: string[] = [];
  for (const signup of signups) {
    const name = signup.name.trim();
    if (!name || existing.has(name.toLowerCase())) continue;
    existing.add(name.toLowerCase());
    newNames.push(name);
  }
  return newNames;
}

// A report is only actionable if its match is still open and both ids still
// belong to that match — a stale report (organizer already entered the result,
// or the round was regenerated) is dropped instead of shown.
export function actionableReports(tournament: Tournament, reports: ReportRow[]): ReportRow[] {
  return reports.filter((report) => {
    const match = tournament.matches.find((m) => m.id === report.match_id);
    if (!match || match.isBye || match.winnerId) return false;
    const players = [match.player1Id, match.player2Id];
    return players.includes(report.reported_by) && players.includes(report.winner_id);
  });
}

/** A result both players reported the same way, ready to apply without asking. */
export type AgreedResult = {
  matchId: string;
  winnerId: string;
  score?: MatchScore;
  /** Both report rows, to be consumed in the same push that applies the result. */
  reportIds: string[];
};

/**
 * Finds the matches where BOTH players have reported and they agree.
 *
 * Confirming every result by hand is the organizer's whole job during an
 * event, and most of it is rubber-stamping two people who already agree about
 * who won. When they agree there is nothing to arbitrate, so the result is
 * applied on its own; when they do not, it still goes to the organizer exactly
 * as before.
 *
 * Deliberately strict about what counts as agreement:
 *  * both reports must come from the two players of that match, and not twice
 *    from the same person (re-reporting replaces your own row server-side, but
 *    this does not rely on that);
 *  * the winner must match;
 *  * in Bo3, the SCORE must match too. Same winner with different games is a
 *    disagreement about the detail that feeds the tiebreakers, and guessing
 *    which one is right is exactly the judgement call the organizer is for.
 */
export function agreedReports(tournament: Tournament, reports: ReportRow[]): AgreedResult[] {
  const byMatch = new Map<string, ReportRow[]>();
  for (const report of actionableReports(tournament, reports)) {
    const list = byMatch.get(report.match_id);
    if (list) list.push(report);
    else byMatch.set(report.match_id, [report]);
  }

  const agreed: AgreedResult[] = [];
  for (const [matchId, rows] of byMatch) {
    const reporters = new Set(rows.map((r) => r.reported_by));
    if (reporters.size < 2) continue;

    const winners = new Set(rows.map((r) => r.winner_id));
    if (winners.size !== 1) continue;

    const scores = new Set(rows.map((r) => (r.score ? `${r.score.p1}-${r.score.p2}` : 'none')));
    if (scores.size !== 1) continue;

    agreed.push({
      matchId,
      winnerId: rows[0].winner_id,
      score: rows[0].score ?? undefined,
      reportIds: rows.map((r) => r.id),
    });
  }
  return agreed;
}

// ---------------------------------------------------------------------------
// Viewers (identity) and betting
// ---------------------------------------------------------------------------
//
// A viewer is "this device, as this person". The secret is generated here,
// stored on the device, and sent with every action; the server keeps only its
// hash. Same shape as the organizer credential — see the note at the top.

export type ViewerRow = {
  id: string;
  code: string;
  name: string;
  participant_id: string | null;
  created_at: string;
  // Bumped every time this person changes their picture. Optional because a
  // build talking to a database where avatars.sql has not been run yet simply
  // gets rows without the column — which reads as "nobody has a picture"
  // rather than as an error.
  avatar_version?: number | null;
};

export type BetRow = {
  id: string;
  code: string;
  viewer_id: string;
  match_id: string;
  pick: string;
  amount: number;
  created_at: string;
};

/** What a device keeps locally to prove it is a given viewer. */
export type ViewerIdentity = {
  viewerId: string;
  secret: string;
  name: string;
  participantId: string | null;
};

export function generateViewerSecret(): string {
  return generateOrganizerSecret();
}

export async function joinAsViewer(
  code: string,
  name: string,
  participantId: string | null
): Promise<ViewerIdentity> {
  const secret = generateViewerSecret();
  const viewerId = await callRpc<string>('join_tournament', {
    p_code: code,
    p_secret: secret,
    p_name: name.trim(),
    p_participant_id: participantId,
  });
  return { viewerId, secret, name: name.trim(), participantId };
}

/**
 * Upgrades an existing viewer to a roster slot. Used when someone who entered
 * the link before round 1 (as a nameless-yet sign-up) finally appears on the
 * roster: they keep the identity, chips and picture they already had instead
 * of getting a second row.
 */
export async function claimParticipantSlot(
  code: string,
  identity: ViewerIdentity,
  participantId: string
): Promise<ViewerIdentity> {
  await callRpc<null>('claim_participant_slot', {
    p_code: code,
    p_viewer_id: identity.viewerId,
    p_secret: identity.secret,
    p_participant_id: participantId,
  });
  return { ...identity, participantId };
}

export function fetchViewers(code: string): Promise<ViewerRow[]> {
  return selectRows<ViewerRow>('tournament_viewers', `code=eq.${code}&select=*&order=created_at.asc`);
}

export function fetchBets(code: string): Promise<BetRow[]> {
  return selectRows<BetRow>('tournament_bets', `code=eq.${code}&select=*&order=created_at.asc`);
}

// Replaces the old open-insert report path: the server now checks that the
// caller is who they claim and that the match is theirs, so a report can no
// longer be filed in someone else's name.
export async function submitReportAsViewer(
  code: string,
  identity: ViewerIdentity,
  report: { matchId: string; winnerId: string; score?: MatchScore }
): Promise<void> {
  await callRpc<string>('submit_report', {
    p_code: code,
    p_viewer_id: identity.viewerId,
    p_secret: identity.secret,
    p_match_id: report.matchId,
    p_winner_id: report.winnerId,
    p_score: report.score ?? null,
  });
}

export async function placeBet(
  code: string,
  identity: ViewerIdentity,
  bet: { matchId: string; pick: string; amount: number }
): Promise<void> {
  await callRpc<string>('place_bet', {
    p_code: code,
    p_viewer_id: identity.viewerId,
    p_secret: identity.secret,
    p_match_id: bet.matchId,
    p_pick: bet.pick,
    p_amount: bet.amount,
  });
}

// ---------------------------------------------------------------------------
// Profile pictures
// ---------------------------------------------------------------------------
//
// Images live in their own table on purpose. The snapshot every device pulls
// every 6 seconds already carries one row per viewer; putting the picture in
// there would re-download everybody's face ten times a minute. Instead the
// viewer row carries a version number, and a device fetches an image once and
// keeps it until that number moves.

export type AvatarRow = {
  viewer_id: string;
  image: string;
  version: number;
};

/** Fetches the pictures of specific viewers. Returns [] for an empty request. */
export async function fetchAvatars(code: string, viewerIds: string[]): Promise<AvatarRow[]> {
  if (viewerIds.length === 0) return [];
  const list = viewerIds.join(',');
  return selectRows<AvatarRow>(
    'tournament_avatars',
    `code=eq.${code}&viewer_id=in.(${list})&select=viewer_id,image,version`
  );
}

/**
 * Gives up this device's place in the tournament, freeing the roster slot for
 * whoever claims it next — including the same person on a different phone.
 *
 * Without this, "not me" only forgot the local credential while the server row
 * (and therefore the claim on that slot) lived on forever: the slot could never
 * be taken again, by anybody, on any device. Deleting the row takes that
 * viewer's bets and picture with it, so the caller warns first when there is
 * betting in play.
 */
export async function leaveTournament(code: string, identity: ViewerIdentity): Promise<void> {
  await callRpc<null>('leave_tournament', {
    p_code: code,
    p_viewer_id: identity.viewerId,
    p_secret: identity.secret,
  });
}

/** Sets your own picture; returns the new version. */
export function setViewerAvatar(
  code: string,
  identity: ViewerIdentity,
  image: string
): Promise<number> {
  return callRpc<number>('set_viewer_avatar', {
    p_code: code,
    p_viewer_id: identity.viewerId,
    p_secret: identity.secret,
    p_image: image,
  });
}

/** Removes your own picture; returns the version everyone should now see. */
export function clearViewerAvatar(code: string, identity: ViewerIdentity): Promise<number> {
  return callRpc<number>('clear_viewer_avatar', {
    p_code: code,
    p_viewer_id: identity.viewerId,
    p_secret: identity.secret,
  });
}
