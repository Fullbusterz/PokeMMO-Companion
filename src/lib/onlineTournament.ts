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

  const [reports, signups] = await Promise.all([
    selectRows<ReportRow>('tournament_reports', `code=eq.${code}&select=*&order=created_at.asc`),
    selectRows<SignupRow>('tournament_signups', `code=eq.${code}&select=*&order=created_at.asc`),
  ]);

  return { tournament, updatedAt: row.updated_at, reports, signups };
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

export async function submitOnlineReport(
  code: string,
  report: { matchId: string; reportedBy: string; winnerId: string; score?: MatchScore }
): Promise<void> {
  await insertRow('tournament_reports', {
    code,
    match_id: report.matchId,
    reported_by: report.reportedBy,
    winner_id: report.winnerId,
    score: report.score ?? null,
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
