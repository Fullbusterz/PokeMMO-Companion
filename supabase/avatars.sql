-- PokeMMO Companion — profile pictures for tournament viewers
-- Run this AFTER betting.sql, in the Supabase SQL editor. Idempotent.
--
-- The picture lives in its OWN table, and the viewer row only carries an
-- integer `avatar_version`. That split is the whole point: the snapshot every
-- device pulls every 6 seconds already contains one row per viewer, and
-- inlining even a 5 KB thumbnail there would mean re-downloading everybody's
-- face ten times a minute for the length of the event. With a version number
-- instead, a device fetches an image once and re-uses it until that number
-- changes.
--
-- Same security model as the rest: no insert/update policy, the only write
-- path is a function that checks the viewer's secret. So you can change your
-- own picture and nobody else's.

create table if not exists public.tournament_avatars (
  code text not null references public.tournaments(code) on delete cascade,
  viewer_id uuid not null references public.tournament_viewers(id) on delete cascade,
  -- A data URI (image/jpeg, downscaled by the client before upload). Kept as
  -- text rather than bytea so a device can render it straight from the JSON
  -- the REST endpoint returns, with no decoding step.
  image text not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (code, viewer_id),
  -- ~64 KB of base64 is roughly a 48 KB image: far above what a 128px JPEG
  -- needs (3-8 KB), and far below anything that could be used to park a file
  -- in the database. The client is what keeps them small; this is the ceiling.
  constraint avatars_image_len check (char_length(image) between 32 and 65536)
);

alter table public.tournament_viewers
  add column if not exists avatar_version integer not null default 0;

alter table public.tournament_avatars enable row level security;

drop policy if exists avatars_read on public.tournament_avatars;
create policy avatars_read on public.tournament_avatars for select to anon, authenticated using (true);

grant select on public.tournament_avatars to anon, authenticated;
revoke insert, update, delete, truncate on public.tournament_avatars from anon, authenticated;

-- Sets (or replaces) your own picture and bumps the version everyone polls.
-- Returns the new version so the caller can cache under it immediately instead
-- of waiting for the next poll to learn it.
create or replace function public.set_viewer_avatar(
  p_code text,
  p_viewer_id uuid,
  p_secret text,
  p_image text
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_next integer;
begin
  if not exists (
    select 1 from public.tournament_viewers
     where id = p_viewer_id and code = p_code and secret_hash = public.hash_secret(p_secret)
  ) then
    raise exception 'invalid viewer';
  end if;

  -- Only formats every browser and React Native can render, and only base64
  -- data URIs: no remote URL, so a picture can never make a device fetch
  -- something a stranger chose.
  if p_image !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' then
    raise exception 'unsupported image format';
  end if;

  insert into public.tournament_avatars as a (code, viewer_id, image, version)
  values (p_code, p_viewer_id, p_image, 1)
  on conflict (code, viewer_id) do update
    set image = excluded.image,
        version = a.version + 1,
        updated_at = now()
  returning a.version into v_next;

  update public.tournament_viewers
     set avatar_version = v_next
   where id = p_viewer_id;

  return v_next;
end;
$fn$;

-- Removing your picture is the same write path, and leaves the version moving
-- forward so devices holding the old one know to drop it.
create or replace function public.clear_viewer_avatar(
  p_code text,
  p_viewer_id uuid,
  p_secret text
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_next integer;
begin
  if not exists (
    select 1 from public.tournament_viewers
     where id = p_viewer_id and code = p_code and secret_hash = public.hash_secret(p_secret)
  ) then
    raise exception 'invalid viewer';
  end if;

  select coalesce(version, 0) + 1 into v_next
    from public.tournament_avatars
   where code = p_code and viewer_id = p_viewer_id;

  delete from public.tournament_avatars
   where code = p_code and viewer_id = p_viewer_id;

  update public.tournament_viewers
     set avatar_version = coalesce(v_next, 0)
   where id = p_viewer_id;

  return coalesce(v_next, 0);
end;
$fn$;

grant execute on function public.set_viewer_avatar(text, uuid, text, text) to anon, authenticated;
grant execute on function public.clear_viewer_avatar(text, uuid, text) to anon, authenticated;
