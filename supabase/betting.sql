-- PokeMMO Companion — viewers (identity) and betting
-- Run this AFTER schema.sql, in the Supabase SQL editor. Idempotent.
--
-- Until now "who am I" was a preference stored on the player's own phone: the
-- app asked you to pick your name off the roster and took your word for it.
-- That was tolerable when the worst you could do was file a report the
-- organizer has to confirm anyway. Betting needs a real answer, so entering by
-- the link now registers a VIEWER: a row holding a display name, optionally a
-- claimed roster slot, and the SHA-256 of a secret the device generates and
-- keeps. Every action a person takes from here on carries that secret.
--
-- A viewer with participant_id = null is a spectator: they can watch and bet,
-- but they have no match of their own and cannot report results.

create table if not exists public.tournament_viewers (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.tournaments(code) on delete cascade,
  name text not null,
  -- The roster slot this person claims to be, or null for a spectator.
  participant_id text,
  secret_hash text not null,
  created_at timestamptz not null default now(),
  constraint viewers_name_len check (char_length(name) between 1 and 40)
);

create index if not exists tournament_viewers_code_idx on public.tournament_viewers (code);
create unique index if not exists tournament_viewers_unique_name
  on public.tournament_viewers (code, lower(name));
-- One person per roster slot: two phones cannot both be "Ana".
create unique index if not exists tournament_viewers_unique_participant
  on public.tournament_viewers (code, participant_id)
  where participant_id is not null;

create table if not exists public.tournament_bets (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.tournaments(code) on delete cascade,
  viewer_id uuid not null references public.tournament_viewers(id) on delete cascade,
  match_id text not null,
  -- The participant this bet backs to win.
  pick text not null,
  amount integer not null,
  created_at timestamptz not null default now(),
  constraint bets_amount_positive check (amount >= 1 and amount <= 1000000)
);

create index if not exists tournament_bets_code_idx on public.tournament_bets (code);
-- One bet per person per match, and final once placed: the table is
-- insert-only, so nobody moves their money after seeing how it is going.
create unique index if not exists tournament_bets_one_per_match
  on public.tournament_bets (code, viewer_id, match_id);

alter table public.tournament_viewers enable row level security;
alter table public.tournament_bets enable row level security;

-- Both tables are readable by anyone with the link: the betting standings are
-- public, and every device derives the same payouts from these same rows.
drop policy if exists viewers_read on public.tournament_viewers;
create policy viewers_read on public.tournament_viewers for select to anon, authenticated using (true);

drop policy if exists bets_read on public.tournament_bets;
create policy bets_read on public.tournament_bets for select to anon, authenticated using (true);

-- No insert policy on either: both go through the secret-checked functions
-- below. That is what makes "you cannot bet on your own match" and "you cannot
-- report someone else's result" enforceable rather than advisory.
grant select on public.tournament_viewers to anon, authenticated;
grant select on public.tournament_bets to anon, authenticated;
revoke insert, update, delete, truncate on public.tournament_viewers from anon, authenticated;
revoke insert, update, delete, truncate on public.tournament_bets from anon, authenticated;

-- Registers a device as a viewer and returns its id. Claiming a roster slot
-- requires that the slot exists in the tournament document, so a hand-crafted
-- call cannot invent a participant.
create or replace function public.join_tournament(
  p_code text,
  p_secret text,
  p_name text,
  p_participant_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_doc jsonb;
  v_id uuid;
begin
  if char_length(p_secret) < 16 then
    raise exception 'secret too short';
  end if;

  select data into v_doc from public.tournaments where code = p_code;
  if v_doc is null then
    raise exception 'no such tournament';
  end if;

  if p_participant_id is not null and not exists (
    select 1 from jsonb_array_elements(v_doc -> 'participants') p
     where p ->> 'id' = p_participant_id
  ) then
    raise exception 'no such participant';
  end if;

  insert into public.tournament_viewers (code, name, participant_id, secret_hash)
  values (p_code, btrim(p_name), p_participant_id, public.hash_secret(p_secret))
  returning id into v_id;

  return v_id;
end;
$fn$;

-- Reporting a result now proves who you are, and that the match is yours.
-- Previously any caller could insert a report naming anyone as the reporter.
create or replace function public.submit_report(
  p_code text,
  p_viewer_id uuid,
  p_secret text,
  p_match_id text,
  p_winner_id text,
  p_score jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_participant text;
  v_match jsonb;
  v_id uuid;
begin
  select participant_id into v_participant
    from public.tournament_viewers
   where id = p_viewer_id and code = p_code and secret_hash = public.hash_secret(p_secret);
  if not found then
    raise exception 'invalid viewer';
  end if;
  if v_participant is null then
    raise exception 'spectators cannot report results';
  end if;

  select m into v_match
    from public.tournaments t, jsonb_array_elements(t.data -> 'matches') m
   where t.code = p_code and m ->> 'id' = p_match_id;
  if v_match is null then
    raise exception 'no such match';
  end if;
  if coalesce((v_match ->> 'isBye')::boolean, false) then
    raise exception 'a bye has no result to report';
  end if;
  if v_match ->> 'winnerId' is not null then
    raise exception 'this match is already decided';
  end if;
  if v_participant not in (v_match ->> 'player1Id', v_match ->> 'player2Id') then
    raise exception 'not your match';
  end if;
  if p_winner_id not in (v_match ->> 'player1Id', v_match ->> 'player2Id') then
    raise exception 'winner is not in this match';
  end if;

  -- Re-reporting replaces your previous claim rather than stacking up, so the
  -- organizer sees a corrected result instead of two contradictory rows.
  delete from public.tournament_reports
   where code = p_code and match_id = p_match_id and reported_by = v_participant;

  insert into public.tournament_reports (code, match_id, reported_by, winner_id, score)
  values (p_code, p_match_id, v_participant, p_winner_id, p_score)
  returning id into v_id;

  return v_id;
end;
$fn$;

-- Places a bet. The structural rules live here because these are the ones that
-- must not be negotiable from a patched client: the match has to be open, the
-- pick has to be one of its two players, and you cannot back a match you are
-- playing in yourself.
--
-- Deliberately NOT enforced here: whether you can afford it. A balance is the
-- result of settling every earlier bet, and re-implementing the payout maths in
-- PL/pgSQL would mean two copies of the same rules drifting apart. The app
-- computes the balance (src/lib/betting.ts) and refuses an overdraft there;
-- since every bet is public and every payout derives from the same rows, an
-- overdraft would be plainly visible to everyone rather than hidden.
create or replace function public.place_bet(
  p_code text,
  p_viewer_id uuid,
  p_secret text,
  p_match_id text,
  p_pick text,
  p_amount integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_participant text;
  v_match jsonb;
  v_id uuid;
begin
  select participant_id into v_participant
    from public.tournament_viewers
   where id = p_viewer_id and code = p_code and secret_hash = public.hash_secret(p_secret);
  if not found then
    raise exception 'invalid viewer';
  end if;

  select m into v_match
    from public.tournaments t, jsonb_array_elements(t.data -> 'matches') m
   where t.code = p_code and m ->> 'id' = p_match_id;
  if v_match is null then
    raise exception 'no such match';
  end if;
  if coalesce((v_match ->> 'isBye')::boolean, false) then
    raise exception 'cannot bet on a bye';
  end if;
  if v_match ->> 'winnerId' is not null then
    raise exception 'betting on this match is closed';
  end if;
  if p_pick not in (v_match ->> 'player1Id', v_match ->> 'player2Id') then
    raise exception 'pick is not in this match';
  end if;
  if v_participant is not null and v_participant in (v_match ->> 'player1Id', v_match ->> 'player2Id') then
    raise exception 'cannot bet on your own match';
  end if;

  insert into public.tournament_bets (code, viewer_id, match_id, pick, amount)
  values (p_code, p_viewer_id, p_match_id, p_pick, p_amount)
  returning id into v_id;

  return v_id;
end;
$fn$;

grant execute on function public.join_tournament(text, text, text, text) to anon, authenticated;
grant execute on function public.submit_report(text, uuid, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.place_bet(text, uuid, text, text, text, integer) to anon, authenticated;

-- The old open-insert path is retired: reports must now come through
-- submit_report(), which checks who you are. Without this the hardening above
-- would be optional — anyone could keep inserting reports directly.
revoke insert on public.tournament_reports from anon, authenticated;
drop policy if exists reports_insert on public.tournament_reports;
