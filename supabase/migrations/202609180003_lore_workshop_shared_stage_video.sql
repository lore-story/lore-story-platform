-- Lore-Werkstatt: additive video support. Apply after 202609180002_lore_workshop_stage_2_media.sql.
-- This migration is intentionally not applied automatically to any remote project.
update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/webm']
where id = 'mission-draft-media';

alter table public.mission_media drop constraint if exists mission_media_mime_type_check;
alter table public.mission_media drop constraint if exists mission_media_byte_size_check;
alter table public.mission_media
  add constraint mission_media_mime_type_check
  check (mime_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm')) not valid;
alter table public.mission_media
  add constraint mission_media_byte_size_check
  check (
    byte_size >= 1 and
    ((mime_type like 'image/%' and byte_size <= 10485760) or
     (mime_type in ('video/mp4','video/webm') and byte_size <= 104857600))
  ) not valid;
alter table public.mission_media validate constraint mission_media_mime_type_check;
alter table public.mission_media validate constraint mission_media_byte_size_check;
