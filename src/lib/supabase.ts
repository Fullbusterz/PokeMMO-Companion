// Deliberately NOT using @supabase/supabase-js: everything this app needs from
// Supabase is four REST calls and three RPCs, and this project already has to
// install with --legacy-peer-deps because of the react/react-native/expo
// dependency graph. A plain fetch client adds zero packages, works identically
// on web and native, and keeps the web bundle unchanged in size.
//
// Live updates are done by polling (see ONLINE_POLL_MS) rather than websockets:
// with a handful of players a 6-second refresh is indistinguishable from
// realtime, and it means no socket lifecycle to get wrong on mobile when the
// app is backgrounded.

// EXPO_PUBLIC_* variables are inlined into the bundle at build time by Expo.
// The anon key is designed to be public — every table is behind RLS and the
// only writes it can perform are "insert a report" and "insert a signup".
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const ONLINE_POLL_MS = 6000;

export function isOnlineConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export class SupabaseError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'SupabaseError';
  }
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// `fetch` has no timeout of its own: a request that never settles (captive
// portal, a phone that lost signal mid-flight) would otherwise leave the
// caller awaiting forever — which in the organizer's poll loop meant sync
// silently stopped while the UI still claimed to be up to date. Every request
// is therefore bounded, and a timeout surfaces as the same status-0 "couldn't
// reach the server" as any other network failure.
const REQUEST_TIMEOUT_MS = 15000;

async function request<T>(path: string, init: RequestInit): Promise<T> {
  if (!isOnlineConfigured()) {
    throw new SupabaseError('Supabase is not configured in this build', 0);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}${path}`, { ...init, signal: controller.signal });
  } catch {
    // Offline, DNS failure, captive portal, or our own timeout — surfaced as a
    // status-0 error so callers can tell "couldn't reach the server" from
    // "server said no".
    throw new SupabaseError('network', 0);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new SupabaseError(body || response.statusText, response.status);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function selectRows<T>(table: string, query: string): Promise<T[]> {
  return request<T[]>(`/rest/v1/${table}?${query}`, { method: 'GET', headers: headers() });
}

export function insertRow<T>(table: string, row: Record<string, unknown>): Promise<T[]> {
  return request<T[]>(`/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
}

export function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  return request<T>(`/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(args),
  });
}
