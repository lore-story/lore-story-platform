-- Lore-Werkstatt Stufe 2: private, owner-scoped draft media.
-- Supabase anonymous sign-ins use the authenticated role, so every policy also
-- rejects JWTs whose is_anonymous claim is true.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mission-draft-media', 'mission-draft-media', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where storage.buckets.id = 'mission-draft-media';

create table if not exists public.mission_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  title text,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  created_at timestamptz not null default now(),
  check (storage_path like owner_id::text || '/%')
);
alter table public.mission_media enable row level security;

-- Only replace policies owned by this migration; unrelated policies remain intact.
drop policy if exists "teachers select own mission media" on public.mission_media;
drop policy if exists "teachers insert own mission media" on public.mission_media;
drop policy if exists "teachers update own mission media" on public.mission_media;
drop policy if exists "teachers delete own mission media" on public.mission_media;
create policy "teachers select own mission media" on public.mission_media for select to authenticated
  using (owner_id = auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
create policy "teachers insert own mission media" on public.mission_media for insert to authenticated
  with check (owner_id = auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
create policy "teachers update own mission media" on public.mission_media for update to authenticated
  using (owner_id = auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false)
  with check (owner_id = auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
create policy "teachers delete own mission media" on public.mission_media for delete to authenticated
  using (owner_id = auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);

drop policy if exists "teachers read own draft objects" on storage.objects;
drop policy if exists "teachers insert own draft objects" on storage.objects;
drop policy if exists "teachers update own draft objects" on storage.objects;
drop policy if exists "teachers delete own draft objects" on storage.objects;
create policy "teachers read own draft objects" on storage.objects for select to authenticated
  using (bucket_id = 'mission-draft-media' and (storage.foldername(name))[1] = auth.uid()::text and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
create policy "teachers insert own draft objects" on storage.objects for insert to authenticated
  with check (bucket_id = 'mission-draft-media' and (storage.foldername(name))[1] = auth.uid()::text and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
create policy "teachers update own draft objects" on storage.objects for update to authenticated
  using (bucket_id = 'mission-draft-media' and (storage.foldername(name))[1] = auth.uid()::text and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false)
  with check (bucket_id = 'mission-draft-media' and (storage.foldername(name))[1] = auth.uid()::text and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
create policy "teachers delete own draft objects" on storage.objects for delete to authenticated
  using (bucket_id = 'mission-draft-media' and (storage.foldername(name))[1] = auth.uid()::text and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
