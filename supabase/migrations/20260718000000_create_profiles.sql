create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public app profile linked one-to-one with an authenticated user.';

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;

create policy "Authenticated members can view profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "Members can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  profile_name text;
begin
  profile_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  if char_length(profile_name) < 2 then
    profile_name := split_part(coalesce(new.email, 'Friend'), '@', 1);
  end if;

  if char_length(profile_name) < 2 then
    profile_name := 'Friend';
  end if;

  insert into public.profiles (id, full_name)
  values (new.id, left(profile_name, 80));

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
