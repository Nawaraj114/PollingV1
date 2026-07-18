create table public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null
    check (char_length(trim(question)) between 5 and 240),
  created_by uuid not null references auth.users (id) on delete restrict,
  allows_multiple boolean not null default false,
  status text not null default 'open'
    check (status in ('open', 'closed')),
  expires_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint polls_expiry_after_creation check (
    expires_at is null or expires_at > created_at
  ),
  constraint polls_closed_state_consistency check (
    (status = 'open' and closed_at is null and closed_by is null)
    or (status = 'closed' and closed_at is not null and closed_by is not null)
  )
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null
    check (char_length(trim(label)) between 1 and 100),
  position smallint not null check (position between 0 and 9),
  created_at timestamptz not null default now(),
  unique (poll_id, position),
  unique (id, poll_id)
);

create unique index poll_options_unique_normalized_label_idx
on public.poll_options (poll_id, lower(trim(label)));

create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  poll_option_id uuid not null,
  voter_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint poll_votes_option_belongs_to_poll foreign key (
    poll_option_id,
    poll_id
  ) references public.poll_options (id, poll_id) on delete cascade,
  unique (poll_id, voter_id, poll_option_id)
);

create index polls_created_at_idx
on public.polls (created_at desc);

create index poll_votes_poll_created_idx
on public.poll_votes (poll_id, created_at, id);

comment on table public.polls is
  'Private circle polls. Expiry is enforced at vote time even before the stored status is manually closed.';

comment on table public.poll_votes is
  'Append-only selected options. All choices in one multiple-choice ballot are inserted atomically by cast_poll_vote.';

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

revoke all on table public.polls from anon, authenticated;
revoke all on table public.poll_options from anon, authenticated;
revoke all on table public.poll_votes from anon, authenticated;

grant select on table public.polls to authenticated;
grant select on table public.poll_options to authenticated;
grant select on table public.poll_votes to authenticated;

create policy "Circle members can read polls"
on public.polls
for select
to authenticated
using (true);

create policy "Circle members can read poll options"
on public.poll_options
for select
to authenticated
using (true);

create policy "Circle members can read poll votes"
on public.poll_votes
for select
to authenticated
using (true);

create view public.poll_overview
with (security_invoker = true)
as
select
  poll.*,
  (
    poll.status = 'open'
    and (poll.expires_at is null or poll.expires_at > now())
  ) as is_open
from public.polls as poll;

revoke all on table public.poll_overview from anon, authenticated;
grant select on table public.poll_overview to authenticated;

create trigger polls_set_updated_at
before update on public.polls
for each row execute function public.set_updated_at();

create or replace function public.create_poll(
  p_question text,
  p_allows_multiple boolean,
  p_expires_at timestamptz,
  p_options text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  clean_question text := trim(p_question);
  option_count integer := coalesce(array_length(p_options, 1), 0);
  new_poll_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  if char_length(clean_question) not between 5 and 240 then
    raise exception 'The poll question must contain between 5 and 240 characters.';
  end if;

  if option_count not between 2 and 10 then
    raise exception 'A poll must contain between 2 and 10 options.';
  end if;

  if exists (
    select 1
    from unnest(p_options) as option_label
    where char_length(trim(option_label)) not between 1 and 100
  ) then
    raise exception 'Every option must contain between 1 and 100 characters.';
  end if;

  if (
    select count(distinct lower(trim(option_label)))
    from unnest(p_options) as option_label
  ) <> option_count then
    raise exception 'Poll options must be unique.';
  end if;

  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Poll expiry must be in the future.';
  end if;

  insert into public.polls (
    question,
    created_by,
    allows_multiple,
    expires_at
  )
  values (
    clean_question,
    actor_id,
    p_allows_multiple,
    p_expires_at
  )
  returning id into new_poll_id;

  insert into public.poll_options (poll_id, label, position)
  select
    new_poll_id,
    trim(option_label),
    (ordinality - 1)::smallint
  from unnest(p_options) with ordinality as option_rows(option_label, ordinality);

  return new_poll_id;
end;
$$;

create or replace function public.cast_poll_vote(
  p_poll_id uuid,
  p_option_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  choice_count integer := coalesce(array_length(p_option_ids, 1), 0);
  target_poll public.polls%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
  into target_poll
  from public.polls
  where id = p_poll_id
  for update;

  if not found then
    raise exception 'The poll does not exist.';
  end if;

  if target_poll.status <> 'open'
    or (target_poll.expires_at is not null and target_poll.expires_at <= now()) then
    raise exception 'This poll is closed.';
  end if;

  if choice_count < 1
    or choice_count > 10
    or (not target_poll.allows_multiple and choice_count <> 1) then
    raise exception 'Choose the allowed number of options.';
  end if;

  if (
    select count(distinct option_id)
    from unnest(p_option_ids) as option_id
  ) <> choice_count then
    raise exception 'Every selected option must be unique.';
  end if;

  if (
    select count(*)
    from public.poll_options
    where poll_id = p_poll_id
      and id = any(p_option_ids)
  ) <> choice_count then
    raise exception 'A selected option does not belong to this poll.';
  end if;

  if exists (
    select 1
    from public.poll_votes
    where poll_id = p_poll_id
      and voter_id = actor_id
  ) then
    raise exception 'You have already voted in this poll.';
  end if;

  insert into public.poll_votes (
    poll_id,
    poll_option_id,
    voter_id
  )
  select p_poll_id, option_id, actor_id
  from unnest(p_option_ids) as option_id;
end;
$$;

create or replace function public.close_poll(
  p_poll_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  changed_rows integer;
begin
  if actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  update public.polls
  set
    status = 'closed',
    closed_at = now(),
    closed_by = actor_id
  where id = p_poll_id
    and created_by = actor_id
    and status = 'open';

  get diagnostics changed_rows = row_count;

  if changed_rows <> 1 then
    raise exception 'Only the creator can close an open poll.';
  end if;
end;
$$;

revoke all on function public.create_poll(text, boolean, timestamptz, text[]) from public;
grant execute on function public.create_poll(text, boolean, timestamptz, text[]) to authenticated;

revoke all on function public.cast_poll_vote(uuid, uuid[]) from public;
grant execute on function public.cast_poll_vote(uuid, uuid[]) to authenticated;

revoke all on function public.close_poll(uuid) from public;
grant execute on function public.close_poll(uuid) to authenticated;

alter publication supabase_realtime
add table public.polls, public.poll_votes;
