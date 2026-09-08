-- PokeMMO Companion — let an existing viewer take a roster slot
-- Run this AFTER betting.sql, in the Supabase SQL editor. Idempotent.
--
-- Why this exists: a player who opens the link BEFORE round 1 is paired is not
-- on the roster yet, so all they could do was leave their name in the sign-up
-- table and wait. That left them with no identity at all — and therefore no
-- profile picture, no betting, nothing — until the organizer folded them in.
-- Now they are registered as a viewer straight away (with no slot), and this
-- function upgrades that same row once their name appears on the roster.
--
-- Registering a second viewer instead would hit the unique name index, and
-- would also mean their chips and picture belonged to a row nobody uses.

create or replace function public.claim_participant_slot(
  p_code text,
  p_viewer_id uuid,
  p_secret text,
  p_participant_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_current text;
begin
  select participant_id into v_current
    from public.tournament_viewers
   where id = p_viewer_id and code = p_code and secret_hash = public.hash_secret(p_secret);
  if not found then
    raise exception 'invalid viewer';
  end if;

  -- Claiming is one-way. Letting someone swap slots mid-event would let a
  -- player who is losing move onto somebody else's results.
  if v_current is not null then
    raise exception 'this viewer already has a slot';
  end if;

  if not exists (
    select 1 from public.tournaments t, jsonb_array_elements(t.data -> 'participants') p
     where t.code = p_code and p ->> 'id' = p_participant_id
  ) then
    raise exception 'no such participant';
  end if;

  -- The unique index on (code, participant_id) is what actually stops two
  -- devices taking the same slot; this check only turns the race into a
  -- clearer message for the common, non-racing case.
  if exists (
    select 1 from public.tournament_viewers
     where code = p_code and participant_id = p_participant_id
  ) then
    raise exception 'slot already taken';
  end if;

  update public.tournament_viewers
     set participant_id = p_participant_id
   where id = p_viewer_id;
end;
$fn$;

grant execute on function public.claim_participant_slot(text, uuid, text, text) to anon, authenticated;
