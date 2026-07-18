alter table public.bill_participants
add column auth_status text not null default 'pending'
  check (auth_status in ('pending', 'authenticated', 'disputed')),
add column auth_method text
  check (auth_method is null or auth_method in ('password', 'webauthn')),
add column authenticated_at timestamptz,
add column dispute_note text
  check (
    dispute_note is null
    or char_length(trim(dispute_note)) between 2 and 300
  ),
add column disputed_at timestamptz,
add constraint bill_participants_auth_state_consistency check (
  (
    auth_status = 'pending'
    and auth_method is null
    and authenticated_at is null
    and dispute_note is null
    and disputed_at is null
  )
  or (
    auth_status = 'authenticated'
    and auth_method is not null
    and authenticated_at is not null
    and dispute_note is null
    and disputed_at is null
  )
  or (
    auth_status = 'disputed'
    and auth_method is null
    and authenticated_at is null
    and dispute_note is not null
    and disputed_at is not null
  )
);

create table public.bill_status_history (
  id uuid primary key default gen_random_uuid(),
  bill_participant_id uuid not null
    references public.bill_participants (id) on delete restrict,
  event_type text not null
    check (event_type in ('created', 'amount_updated', 'breakdown_updated', 'authenticated', 'disputed', 'resubmitted')),
  event_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_data) = 'object'),
  actor_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index bill_status_history_participant_created_idx
on public.bill_status_history (bill_participant_id, created_at, id);

comment on table public.bill_status_history is
  'Append-only, trigger-generated audit events for every allocation state transition.';

alter table public.bill_status_history enable row level security;
revoke all on table public.bill_status_history from anon, authenticated;
grant select on table public.bill_status_history to authenticated;

create or replace function public.can_read_bill_participant(
  target_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bill_participants
    where id = target_participant_id
      and public.can_read_bill(bill_id)
  );
$$;

revoke all on function public.can_read_bill_participant(uuid) from public;
grant execute on function public.can_read_bill_participant(uuid) to authenticated;

create policy "Bill members can read allocation history"
on public.bill_status_history
for select
to authenticated
using ((select public.can_read_bill_participant(bill_participant_id)));

create or replace function public.enforce_bill_header_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.biller_id <> old.biller_id then
    raise exception 'The biller cannot be changed.';
  end if;

  if new.status <> old.status then
    raise exception 'Bill status is system-controlled.';
  end if;

  if new.total_amount <> old.total_amount then
    raise exception 'The bill total cannot be changed after allocations are created.';
  end if;

  if exists (
    select 1
    from public.bill_participants
    where bill_id = old.id
      and auth_status = 'authenticated'
  ) and (
    new.category_id <> old.category_id
    or new.incurred_on <> old.incurred_on
    or new.description <> old.description
  ) then
    raise exception 'Accepted bills cannot be edited.';
  end if;

  return new;
end;
$$;

create trigger bills_enforce_header_lock
before update on public.bills
for each row execute function public.enforce_bill_header_lock();

create or replace function public.enforce_bill_participant_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_is_biller boolean;
  financial_changed boolean;
  state_metadata_changed boolean;
begin
  if actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  actor_is_biller := public.is_bill_biller(old.bill_id);

  if tg_op = 'DELETE' then
    if not actor_is_biller then
      raise exception 'Only the biller can remove an allocation.';
    end if;

    if old.auth_status = 'authenticated' then
      raise exception 'An authenticated allocation cannot be removed.';
    end if;

    return old;
  end if;

  if new.bill_id <> old.bill_id
    or new.participant_id <> old.participant_id
    or new.created_at <> old.created_at then
    raise exception 'Allocation ownership cannot be changed.';
  end if;

  financial_changed :=
    new.owed_amount <> old.owed_amount
    or new.split_method <> old.split_method;
  state_metadata_changed :=
    new.auth_method is distinct from old.auth_method
    or new.authenticated_at is distinct from old.authenticated_at
    or new.dispute_note is distinct from old.dispute_note
    or new.disputed_at is distinct from old.disputed_at;

  if financial_changed and (
    not actor_is_biller
    or old.auth_status not in ('pending', 'disputed')
    or new.auth_status <> 'pending'
  ) then
    raise exception 'Only the biller can edit an unlocked allocation.';
  end if;

  if old.auth_status = 'pending' and new.auth_status = 'authenticated' then
    if actor_id <> old.participant_id or financial_changed then
      raise exception 'Only the participant can authenticate an unchanged allocation.';
    end if;

    new.auth_method := 'password';
    new.authenticated_at := now();
    new.dispute_note := null;
    new.disputed_at := null;
  elsif old.auth_status = 'pending' and new.auth_status = 'disputed' then
    if actor_id <> old.participant_id or financial_changed then
      raise exception 'Only the participant can dispute an unchanged allocation.';
    end if;

    if char_length(trim(coalesce(new.dispute_note, ''))) not between 2 and 300 then
      raise exception 'A dispute note must contain between 2 and 300 characters.';
    end if;

    new.auth_method := null;
    new.authenticated_at := null;
    new.dispute_note := trim(new.dispute_note);
    new.disputed_at := now();
  elsif old.auth_status = 'disputed' and new.auth_status = 'pending' then
    if not actor_is_biller then
      raise exception 'Only the biller can resubmit a disputed allocation.';
    end if;

    new.auth_method := null;
    new.authenticated_at := null;
    new.dispute_note := null;
    new.disputed_at := null;
  elsif new.auth_status <> old.auth_status then
    raise exception 'That allocation status transition is not allowed.';
  elsif state_metadata_changed then
    raise exception 'Allocation authentication metadata is immutable.';
  end if;

  if old.auth_status = 'authenticated' and financial_changed then
    raise exception 'An authenticated allocation is locked.';
  end if;

  return new;
end;
$$;

create trigger bill_participants_enforce_state
before update or delete on public.bill_participants
for each row execute function public.enforce_bill_participant_state();

create or replace function public.enforce_bill_line_item_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_participant_id uuid := coalesce(new.bill_participant_id, old.bill_participant_id);
  target_bill_id uuid;
  target_auth_status text;
begin
  select bill_id, auth_status
  into target_bill_id, target_auth_status
  from public.bill_participants
  where id = target_participant_id;

  if target_bill_id is null then
    raise exception 'The allocation does not exist.';
  end if;

  if not public.is_bill_biller(target_bill_id) then
    raise exception 'Only the biller can edit category breakdowns.';
  end if;

  if target_auth_status = 'authenticated' then
    raise exception 'An authenticated category breakdown is locked.';
  end if;

  if tg_op = 'UPDATE'
    and new.bill_participant_id <> old.bill_participant_id then
    raise exception 'A line item cannot be moved to another allocation.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger bill_line_items_enforce_lock
before insert or update or delete on public.bill_line_items
for each row execute function public.enforce_bill_line_item_lock();

create or replace function public.record_bill_line_item_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_participant_id uuid := coalesce(new.bill_participant_id, old.bill_participant_id);
  event_actor uuid := (select auth.uid());
  event_payload jsonb;
begin
  if tg_op = 'INSERT' then
    event_payload := jsonb_build_object(
      'action', 'added',
      'amount', new.amount,
      'category_id', new.category_id
    );
  elsif tg_op = 'UPDATE' then
    event_payload := jsonb_build_object(
      'action', 'changed',
      'previous_amount', old.amount,
      'amount', new.amount,
      'previous_category_id', old.category_id,
      'category_id', new.category_id
    );
  else
    event_payload := jsonb_build_object(
      'action', 'removed',
      'amount', old.amount,
      'category_id', old.category_id
    );
  end if;

  insert into public.bill_status_history (
    bill_participant_id,
    event_type,
    event_data,
    actor_id
  )
  values (
    target_participant_id,
    'breakdown_updated',
    event_payload,
    event_actor
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger bill_line_items_record_history
after insert or update or delete on public.bill_line_items
for each row execute function public.record_bill_line_item_history();

create or replace function public.record_bill_participant_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
  event_payload jsonb;
  event_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    event_name := 'created';
    event_payload := jsonb_build_object(
      'owed_amount', new.owed_amount,
      'split_method', new.split_method
    );
  elsif old.auth_status = 'pending' and new.auth_status = 'authenticated' then
    event_name := 'authenticated';
    event_payload := jsonb_build_object('auth_method', new.auth_method);
  elsif old.auth_status = 'pending' and new.auth_status = 'disputed' then
    event_name := 'disputed';
    event_payload := jsonb_build_object('note', new.dispute_note);
  elsif old.auth_status = 'disputed' and new.auth_status = 'pending' then
    event_name := 'resubmitted';
    event_payload := jsonb_build_object(
      'previous_owed_amount', old.owed_amount,
      'owed_amount', new.owed_amount
    );
  elsif old.owed_amount <> new.owed_amount
    or old.split_method <> new.split_method then
    event_name := 'amount_updated';
    event_payload := jsonb_build_object(
      'previous_owed_amount', old.owed_amount,
      'owed_amount', new.owed_amount
    );
  else
    return new;
  end if;

  if event_actor is null then
    select biller_id into event_actor
    from public.bills
    where id = new.bill_id;
  end if;

  insert into public.bill_status_history (
    bill_participant_id,
    event_type,
    event_data,
    actor_id
  )
  values (new.id, event_name, event_payload, event_actor);

  return new;
end;
$$;

create trigger bill_participants_record_history
after insert or update on public.bill_participants
for each row execute function public.record_bill_participant_history();

insert into public.bill_status_history (
  bill_participant_id,
  event_type,
  event_data,
  actor_id,
  created_at
)
select
  participant.id,
  'created',
  jsonb_build_object(
    'owed_amount', participant.owed_amount,
    'split_method', participant.split_method
  ),
  bill.biller_id,
  participant.created_at
from public.bill_participants as participant
join public.bills as bill on bill.id = participant.bill_id;

drop policy "Billers can update participant allocations"
on public.bill_participants;

drop policy "Billers can remove participant allocations"
on public.bill_participants;

drop policy "Billers can add participant allocations"
on public.bill_participants;

create policy "Billers can add pending participant allocations"
on public.bill_participants
for insert
to authenticated
with check (
  auth_status = 'pending'
  and auth_method is null
  and authenticated_at is null
  and dispute_note is null
  and disputed_at is null
  and (select public.is_bill_biller(bill_id))
);

create policy "Participants and billers can transition allocations"
on public.bill_participants
for update
to authenticated
using (
  participant_id = (select auth.uid())
  or (select public.is_bill_biller(bill_id))
)
with check (
  participant_id = (select auth.uid())
  or (select public.is_bill_biller(bill_id))
);

revoke delete on table public.bill_participants from authenticated;

drop policy "Billers can add allocation line items"
on public.bill_line_items;

drop policy "Billers can update allocation line items"
on public.bill_line_items;

drop policy "Billers can remove allocation line items"
on public.bill_line_items;

create policy "Billers can add unlocked allocation line items"
on public.bill_line_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.bill_participants
    where id = bill_participant_id
      and auth_status <> 'authenticated'
      and (select public.is_bill_biller(bill_id))
  )
);

create policy "Billers can update unlocked allocation line items"
on public.bill_line_items
for update
to authenticated
using (
  exists (
    select 1
    from public.bill_participants
    where id = bill_participant_id
      and auth_status <> 'authenticated'
      and (select public.is_bill_biller(bill_id))
  )
)
with check (
  exists (
    select 1
    from public.bill_participants
    where id = bill_participant_id
      and auth_status <> 'authenticated'
      and (select public.is_bill_biller(bill_id))
  )
);

create policy "Billers can remove unlocked allocation line items"
on public.bill_line_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.bill_participants
    where id = bill_participant_id
      and auth_status <> 'authenticated'
      and (select public.is_bill_biller(bill_id))
  )
);

create or replace function public.authenticate_bill_participant(
  p_participant_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed_rows integer;
  jwt_issued_at timestamptz;
begin
  jwt_issued_at := to_timestamp(((select auth.jwt()) ->> 'iat')::double precision);

  if jwt_issued_at is null or jwt_issued_at < now() - interval '2 minutes' then
    raise exception 'Recent password authentication is required.';
  end if;

  update public.bill_participants
  set auth_status = 'authenticated'
  where id = p_participant_id
    and participant_id = (select auth.uid())
    and auth_status = 'pending';

  get diagnostics changed_rows = row_count;

  if changed_rows <> 1 then
    raise exception 'Only your pending allocation can be authenticated.';
  end if;
end;
$$;

create or replace function public.dispute_bill_participant(
  p_participant_id uuid,
  p_note text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed_rows integer;
begin
  update public.bill_participants
  set
    auth_status = 'disputed',
    dispute_note = trim(p_note)
  where id = p_participant_id
    and participant_id = (select auth.uid())
    and auth_status = 'pending';

  get diagnostics changed_rows = row_count;

  if changed_rows <> 1 then
    raise exception 'Only your pending allocation can be disputed.';
  end if;
end;
$$;

create or replace function public.resubmit_bill_allocations(
  p_bill_id uuid,
  p_allocations jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  allocation jsonb;
  allocation_count integer;
  unlocked_count integer;
  authenticated_total numeric;
  proposed_total numeric;
  bill_total numeric;
  current_row public.bill_participants%rowtype;
begin
  if not public.is_bill_biller(p_bill_id) then
    raise exception 'Only the biller can resubmit allocations.';
  end if;

  if jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'Allocations must be a JSON array.';
  end if;

  allocation_count := jsonb_array_length(p_allocations);

  select count(*) into unlocked_count
  from public.bill_participants
  where bill_id = p_bill_id
    and auth_status <> 'authenticated';

  if allocation_count = 0 or allocation_count <> unlocked_count then
    raise exception 'Every unlocked allocation must be included.';
  end if;

  if (
    select count(distinct value ->> 'participant_row_id')
    from jsonb_array_elements(p_allocations)
  ) <> allocation_count then
    raise exception 'Every allocation must be unique.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_allocations)
    where value ->> 'participant_row_id' is null
      or value ->> 'owed_amount' is null
      or (value ->> 'owed_amount')::numeric <= 0
      or (value ->> 'owed_amount')::numeric
        <> round((value ->> 'owed_amount')::numeric, 2)
      or not exists (
        select 1
        from public.bill_participants
        where id = (value ->> 'participant_row_id')::uuid
          and bill_id = p_bill_id
          and auth_status <> 'authenticated'
      )
  ) then
    raise exception 'An allocation is invalid or locked.';
  end if;

  select total_amount into bill_total
  from public.bills
  where id = p_bill_id;

  select coalesce(sum(owed_amount), 0) into authenticated_total
  from public.bill_participants
  where bill_id = p_bill_id
    and auth_status = 'authenticated';

  select sum((value ->> 'owed_amount')::numeric) into proposed_total
  from jsonb_array_elements(p_allocations);

  if authenticated_total + proposed_total <> bill_total then
    raise exception 'All allocations must continue to equal the bill total.';
  end if;

  for allocation in
    select value from jsonb_array_elements(p_allocations)
  loop
    select * into current_row
    from public.bill_participants
    where id = (allocation ->> 'participant_row_id')::uuid;

    if current_row.owed_amount <> (allocation ->> 'owed_amount')::numeric then
      delete from public.bill_line_items
      where bill_participant_id = current_row.id;

      update public.bill_participants
      set
        owed_amount = (allocation ->> 'owed_amount')::numeric,
        split_method = 'explicit',
        auth_status = 'pending'
      where id = current_row.id;
    elsif current_row.auth_status = 'disputed' then
      update public.bill_participants
      set auth_status = 'pending'
      where id = current_row.id;
    end if;
  end loop;
end;
$$;

revoke all on function public.authenticate_bill_participant(uuid) from public;
revoke all on function public.dispute_bill_participant(uuid, text) from public;
revoke all on function public.resubmit_bill_allocations(uuid, jsonb) from public;

grant execute on function public.authenticate_bill_participant(uuid) to authenticated;
grant execute on function public.dispute_bill_participant(uuid, text) to authenticated;
grant execute on function public.resubmit_bill_allocations(uuid, jsonb) to authenticated;
