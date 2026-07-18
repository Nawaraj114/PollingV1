alter table public.bills
add column deleted_at timestamptz,
add column deleted_by uuid references auth.users (id) on delete restrict,
add constraint bills_deletion_consistency check (
  (deleted_at is null and deleted_by is null)
  or (deleted_at is not null and deleted_by is not null)
);

create index bills_active_member_idx
on public.bills (incurred_on desc, created_at desc)
where deleted_at is null;

comment on column public.bills.deleted_at is
  'Soft-deletion timestamp. Deleted bills remain readable to their members for auditability.';

alter table public.bill_status_history
drop constraint bill_status_history_event_type_check;

alter table public.bill_status_history
add constraint bill_status_history_event_type_check check (
  event_type in (
    'created',
    'amount_updated',
    'breakdown_updated',
    'authenticated',
    'disputed',
    'resubmitted',
    'bill_deleted'
  )
);

create or replace function public.enforce_bill_header_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  jwt_issued_at timestamptz;
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

  if old.deleted_at is not null then
    if new.category_id <> old.category_id
      or new.incurred_on <> old.incurred_on
      or new.description <> old.description
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by is distinct from old.deleted_by then
      raise exception 'A deleted bill is immutable.';
    end if;

    return new;
  end if;

  if new.deleted_at is distinct from old.deleted_at
    or new.deleted_by is distinct from old.deleted_by then
    jwt_issued_at := to_timestamp(((select auth.jwt()) ->> 'iat')::double precision);

    if actor_id is null
      or actor_id <> old.biller_id
      or new.deleted_at is null
      or new.deleted_by <> actor_id then
      raise exception 'Only the biller can delete this bill.';
    end if;

    if jwt_issued_at is null
      or jwt_issued_at < now() - interval '2 minutes' then
      raise exception 'Recent password authentication is required.';
    end if;

    if new.category_id <> old.category_id
      or new.incurred_on <> old.incurred_on
      or new.description <> old.description then
      raise exception 'A bill cannot be edited while it is being deleted.';
    end if;

    return new;
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

create or replace function public.block_deleted_bill_participant_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_bill_id uuid := coalesce(new.bill_id, old.bill_id);
begin
  if exists (
    select 1
    from public.bills
    where id = target_bill_id
      and deleted_at is not null
  ) then
    raise exception 'Deleted bill allocations are immutable.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger bill_participants_block_deleted_bill
before insert or update or delete on public.bill_participants
for each row execute function public.block_deleted_bill_participant_changes();

create or replace function public.block_deleted_bill_line_item_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_participant_id uuid := coalesce(
    new.bill_participant_id,
    old.bill_participant_id
  );
begin
  if exists (
    select 1
    from public.bill_participants as participant
    join public.bills as bill on bill.id = participant.bill_id
    where participant.id = target_participant_id
      and bill.deleted_at is not null
  ) then
    raise exception 'Deleted bill category breakdowns are immutable.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger bill_line_items_block_deleted_bill
before insert or update or delete on public.bill_line_items
for each row execute function public.block_deleted_bill_line_item_changes();

create or replace function public.record_bill_deletion_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    insert into public.bill_status_history (
      bill_participant_id,
      event_type,
      event_data,
      actor_id,
      created_at
    )
    select
      participant.id,
      'bill_deleted',
      jsonb_build_object('bill_id', new.id),
      new.deleted_by,
      new.deleted_at
    from public.bill_participants as participant
    where participant.bill_id = new.id;
  end if;

  return new;
end;
$$;

create trigger bills_record_deletion_history
after update on public.bills
for each row execute function public.record_bill_deletion_history();

create or replace function public.soft_delete_bill(p_bill_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  jwt_issued_at timestamptz;
  changed_rows integer;
begin
  jwt_issued_at := to_timestamp(((select auth.jwt()) ->> 'iat')::double precision);

  if actor_id is null
    or jwt_issued_at is null
    or jwt_issued_at < now() - interval '2 minutes' then
    raise exception 'Recent password authentication is required.';
  end if;

  update public.bills
  set
    deleted_at = now(),
    deleted_by = actor_id
  where id = p_bill_id
    and biller_id = actor_id
    and deleted_at is null;

  get diagnostics changed_rows = row_count;

  if changed_rows <> 1 then
    raise exception 'Only the biller can delete an active bill.';
  end if;
end;
$$;

revoke all on function public.soft_delete_bill(uuid) from public;
grant execute on function public.soft_delete_bill(uuid) to authenticated;
