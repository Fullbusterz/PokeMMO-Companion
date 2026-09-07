-- PokeMMO Companion — online tournaments (Swiss)
-- Paste this whole file into the Supabase SQL editor and run it once.
--
-- Security model, in one paragraph: there are no user accounts. The organizer
-- holds a secret that is generated on their device and never travels in the
-- share link; the server stores only its SHA-256. Everyone else (anonymous,
-- using the public anon key) can READ a tournament and can INSERT a signup or
-- a result report — nothing else. The tournament document itself can only be
-- rewritten through push_tournament(), which refuses to do anything unless the
-- secret hashes to the stored value. So a player who inspects the app's
-- network traffic can, at worst, submit a report the organizer has to reject.

create table if not exists public.tournaments (
  code text primary key,
  secret_hash text not null,
  -- The whole Tournament JSON as the app serialises it, minus the organizer
  -- credentials. Kept as one document on purpose: the app already validates
  -- this shape on import (parseImportedTournament), so there is exactly one
  -- parser to trust rather than a second, schema-shaped one.
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Cheap abuse guards: this is an open-insert table.
  constraint tournaments_code_len check (char_length(code) between 6 and 16),
  constraint tournaments_data_size check (pg_column_size(data) < 512000)
);

create table if not exists public.tournament_reports (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.tournaments(code) on delete cascade,
  match_id text not null,
  reported_by text not null,
  winner_id text not null,
  score jsonb,
  created_at timestamptz not null default now(),
  constraint reports_ids_len check (
    char_length(match_id) between 1 and 64
    and char_length(reported_by) between 1 and 64
    and char_length(winner_id) between 1 and 64
  )
);

create index if not exists tournament_reports_code_idx on public.tournament_reports (code);

create table if not exists public.tournament_signups (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.tournaments(code) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint signups_name_len check (char_length(name) between 1 and 40)
);

create index if not exists tournament_signups_code_idx on public.tournament_signups (code);
-- Two people typing the same name is a real possibility in a 9-player event;
-- rejecting the duplicate at the database is clearer than silently merging.
create unique index if not exists tournament_signups_unique_name on public.tournament_signups (code, lower(name));

alter table public.tournaments enable row level security;
alter table public.tournament_reports enable row level security;
alter table public.tournament_signups enable row level security;

-- Anyone with the link can read.
drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments for select to anon, authenticated using (true);

drop policy if exists reports_read on public.tournament_reports;
create policy reports_read on public.tournament_reports for select to anon, authenticated using (true);

drop policy if exists signups_read on public.tournament_signups;
create policy signups_read on public.tournament_signups for select to anon, authenticated using (true);

-- Players may only ever ADD a report or a signup. No update, no delete: a
-- submitted report can be replaced by submitting another one (the app shows
-- the newest), and only the organizer's push can clear them.
drop policy if exists reports_insert on public.tournament_reports;
create policy reports_insert on public.tournament_reports for insert to anon, authenticated with check (true);

drop policy if exists signups_insert on public.tournament_signups;
create policy signups_insert on public.tournament_signups for insert to anon, authenticated with check (true);

-- No direct insert/update/delete policy on `tournaments`: both writes go
-- through the functions below, which are the only place the secret is checked.

create or replace function public.hash_secret(p_secret text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(p_secret, 'utf8')), 'hex');
$$;

-- Creates the tournament and returns its code. Runs as the definer so it can
-- write to a table that has no insert policy.
create or replace function public.create_tournament(p_code text, p_secret text, p_data jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(p_secret) < 16 then
    raise exception 'secret too short';
  end if;
  insert into public.tournaments (code, secret_hash, data)
  values (p_code, public.hash_secret(p_secret), p_data);
  return p_code;
end;
$$;

-- The organizer's only write path. Replaces the document and, in the same
-- transaction, consumes the reports that were folded into it — so a report
-- can never be applied twice, and never lingers after being rejected.
create or replace function public.push_tournament(
  p_code text,
  p_secret text,
  p_data jsonb,
  p_consume_reports uuid[] default '{}'::uuid[]
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated timestamptz;
begin
  update public.tournaments
     set data = p_data,
         updated_at = now()
   where code = p_code
     and secret_hash = public.hash_secret(p_secret)
  returning updated_at into v_updated;

  if v_updated is null then
    raise exception 'invalid code or secret';
  end if;

  if p_consume_reports is not null and array_length(p_consume_reports, 1) is not null then
    delete from public.tournament_reports
     where code = p_code
       and id = any(p_consume_reports);
  end if;

  return v_updated;
end;
$$;

-- Lets the organizer clear the roster of a signup they removed locally, so it
-- doesn't get re-merged on the next pull.
create or replace function public.delete_signup(p_code text, p_secret text, p_signup_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.tournaments
     where code = p_code and secret_hash = public.hash_secret(p_secret)
  ) then
    raise exception 'invalid code or secret';
  end if;
  delete from public.tournament_signups where code = p_code and id = p_signup_id;
  return true;
end;
$$;

-- Table privileges, granted explicitly rather than relying on the project's
-- "automatically expose new tables" setting (which Supabase now recommends
-- turning OFF, and which would otherwise leave these tables invisible to the
-- REST API). RLS above is what actually decides which ROWS are visible; these
-- grants only decide which STATEMENTS are allowed at all. Note what is absent:
-- no update, no delete, and no insert on `tournaments` — those go through the
-- secret-checked functions below.
grant select on public.tournaments to anon, authenticated;
grant select, insert on public.tournament_reports to anon, authenticated;
grant select, insert on public.tournament_signups to anon, authenticated;

-- And take back what the project's "automatically expose new tables" setting
-- hands out by default (full DML on every new table in `public`). Without
-- this, RLS is the ONLY thing standing between a player and someone else's
-- tournament: verified against the live project, a DELETE on
-- tournament_reports came back 204 rather than a privilege error, because the
-- statement was allowed and merely matched zero visible rows. Two independent
-- layers means a policy added carelessly later still cannot open up a write
-- path that was never granted in the first place.
revoke insert, update, delete, truncate on public.tournaments from anon, authenticated;
revoke update, delete, truncate on public.tournament_reports from anon, authenticated;
revoke update, delete, truncate on public.tournament_signups from anon, authenticated;

grant execute on function public.create_tournament(text, text, jsonb) to anon, authenticated;
grant execute on function public.push_tournament(text, text, jsonb, uuid[]) to anon, authenticated;
grant execute on function public.delete_signup(text, text, uuid) to anon, authenticated;
-- hash_secret is an internal helper; nobody needs to call it directly.
revoke execute on function public.hash_secret(text) from anon, authenticated;
