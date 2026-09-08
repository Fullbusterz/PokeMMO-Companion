-- PokeMMO Companion — give up your own place in a tournament
-- Run this AFTER betting.sql, in the Supabase SQL editor. Idempotent.
--
-- Identity is per DEVICE: entering by the link stores a secret on that phone
-- and claims a roster slot server-side. That is what stops someone reporting
-- in another player's name — but it also meant a slot, once claimed, was
-- claimed forever. Ferran hit it during his own event: he had taken "Respiros"
-- from his laptop to set a photo, and from his phone the app then told him
-- every player was taken and he could only watch. The screen had a "not me"
-- button, but it only cleared the local credential — the row stayed, so the
-- slot stayed locked and nobody could ever be that player again.
--
-- This is the missing half: the device that holds an identity can give it up.
-- It proves it is that viewer with the same secret every other action uses, so
-- nobody can throw anybody else out.
--
-- The row is deleted rather than detached because of the unique index on
-- (code, lower(name)): leaving the row behind as a nameless spectator would
-- block the same person from re-entering under their own name. The cascade
-- takes their bets and their picture with it, which is why the app warns
-- before calling this when there is betting in play.

create or replace function public.leave_tournament(
  p_code text,
  p_viewer_id uuid,
  p_secret text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not exists (
    select 1 from public.tournament_viewers
     where id = p_viewer_id and code = p_code and secret_hash = public.hash_secret(p_secret)
  ) then
    raise exception 'invalid viewer';
  end if;

  delete from public.tournament_viewers where id = p_viewer_id and code = p_code;
end;
$fn$;

grant execute on function public.leave_tournament(text, uuid, text) to anon, authenticated;
