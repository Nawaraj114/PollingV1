alter table public.profiles
rename column avatar_url to avatar_path;

comment on column public.profiles.avatar_path is
  'Object path in the private avatars Storage bucket; never stores a signed URL.';

revoke update on table public.profiles from authenticated;
revoke update (full_name, avatar_path) on table public.profiles from authenticated;
grant update (full_name, avatar_path) on table public.profiles to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Members can view circle avatars"
on storage.objects
for select
to authenticated
using (bucket_id = 'avatars');

create policy "Members can upload their own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Members can delete their own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
