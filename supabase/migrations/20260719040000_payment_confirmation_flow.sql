alter table public.bill_participants
add column payment_status text not null default 'unpaid'
  check (payment_status in ('unpaid', 'marked_paid', 'confirmed_paid')),
add column paid_at timestamptz,
add column confirmed_at timestamptz,
add constraint bill_participants_payment_state_consistency check (
  (
    payment_status = 'unpaid'
    and paid_at is null
    and confirmed_at is null
  )
  or (
    payment_status = 'marked_paid'
    and paid_at is not null
    and confirmed_at is null
  )
  or (
    payment_status = 'confirmed_paid'
    and paid_at is not null
    and confirmed_at is not null
    and confirmed_at >= paid_at
  )
);

comment on column public.bill_participants.payment_status is
  'Irreversible payment state: unpaid, participant-marked paid, then biller-confirmed paid.';

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
    'marked_paid',
    'confirmed_paid',
    'bill_settled',
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
    if not (
      old.status = 'open'
      and new.status = 'settled'
      and old.deleted_at is null
      and exists (
        select 1
        from public.bill_participants
        where bill_id = old.id
      )
      and not exists (
        select 1
        from public.bill_participants
        where bill_id = old.id
          and payment_status <> 'confirmed_paid'
      )
    ) then
      raise exception 'Bill status is system-controlled.';
    end if;
  end if;

  if new.total_amount <> old.total_amount then
    raise exception 'The bill total cannot be changed after allocations are created.';
  end if;

  if old.deleted_at is not null then
    if new.category_id <> old.category_id
      or new.incurred_on <> old.incurred_on
      or new.description <> old.description
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by is distinct from old.deleted_by
      or new.status <> old.status then
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
      or new.description <> old.description
      or new.status <> old.status then
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

create or replace function public.enforce_bill_payment_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  jwt_issued_at timestamptz;
  payment_metadata_changed boolean;
begin
  payment_metadata_changed :=
    new.payment_status <> old.payment_status
    or new.paid_at is distinct from old.paid_at
    or new.confirmed_at is distinct from old.confirmed_at;

  if not payment_metadata_changed then
    return new;
  end if;

  if actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  if old.auth_status <> 'authenticated'
    or new.auth_status <> 'authenticated' then
    raise exception 'The allocation must be accepted before payment can change.';
  end if;

  if old.payment_status = 'unpaid'
    and new.payment_status = 'marked_paid' then
    if actor_id <> old.participant_id then
      raise exception 'Only the participant can mark this allocation as paid.';
    end if;

    new.paid_at := now();
    new.confirmed_at := null;
  elsif old.payment_status = 'marked_paid'
    and new.payment_status = 'confirmed_paid' then
    if not public.is_bill_biller(old.bill_id) then
      raise exception 'Only the biller can confirm receipt.';
    end if;

    jwt_issued_at := to_timestamp(((select auth.jwt()) ->> 'iat')::double precision);
    if jwt_issued_at is null
      or jwt_issued_at < now() - interval '2 minutes' then
      raise exception 'Recent password authentication is required.';
    end if;

    new.paid_at := old.paid_at;
    new.confirmed_at := now();
  else
    raise exception 'That payment status transition is not allowed.';
  end if;

  return new;
end;
$$;

create trigger bill_participants_enforce_payment_state
before update on public.bill_participants
for each row execute function public.enforce_bill_payment_state();

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
  elsif old.payment_status = 'unpaid'
    and new.payment_status = 'marked_paid' then
    event_name := 'marked_paid';
    event_payload := jsonb_build_object('paid_at', new.paid_at);
  elsif old.payment_status = 'marked_paid'
    and new.payment_status = 'confirmed_paid' then
    event_name := 'confirmed_paid';
    event_payload := jsonb_build_object('confirmed_at', new.confirmed_at);
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

create or replace function public.settle_bill_when_fully_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_actor uuid := (select auth.uid());
  settled_bill_id uuid;
begin
  if old.payment_status <> 'confirmed_paid'
    and new.payment_status = 'confirmed_paid' then
    update public.bills
    set status = 'settled'
    where id = new.bill_id
      and status = 'open'
      and deleted_at is null
      and not exists (
        select 1
        from public.bill_participants
        where bill_id = new.bill_id
          and payment_status <> 'confirmed_paid'
      )
    returning id into settled_bill_id;

    if settled_bill_id is not null then
      insert into public.bill_status_history (
        bill_participant_id,
        event_type,
        event_data,
        actor_id
      )
      values (
        new.id,
        'bill_settled',
        jsonb_build_object('bill_id', settled_bill_id),
        event_actor
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger bill_participants_settle_bill
after update on public.bill_participants
for each row execute function public.settle_bill_when_fully_paid();

drop policy "Billers can add pending participant allocations"
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
  and payment_status = 'unpaid'
  and paid_at is null
  and confirmed_at is null
  and (select public.is_bill_biller(bill_id))
);

create or replace function public.mark_bill_participant_paid(
  p_participant_id uuid
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
  set payment_status = 'marked_paid'
  where id = p_participant_id
    and participant_id = (select auth.uid())
    and auth_status = 'authenticated'
    and payment_status = 'unpaid';

  get diagnostics changed_rows = row_count;

  if changed_rows <> 1 then
    raise exception 'Only your accepted unpaid allocation can be marked as paid.';
  end if;
end;
$$;

create or replace function public.confirm_bill_participant_paid(
  p_participant_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_bill_id uuid;
  changed_rows integer;
  jwt_issued_at timestamptz;
begin
  jwt_issued_at := to_timestamp(((select auth.jwt()) ->> 'iat')::double precision);

  if jwt_issued_at is null
    or jwt_issued_at < now() - interval '2 minutes' then
    raise exception 'Recent password authentication is required.';
  end if;

  select bill_id
  into target_bill_id
  from public.bill_participants
  where id = p_participant_id;

  perform 1
  from public.bills
  where id = target_bill_id
    and biller_id = (select auth.uid())
  for update;

  update public.bill_participants
  set payment_status = 'confirmed_paid'
  where id = p_participant_id
    and auth_status = 'authenticated'
    and payment_status = 'marked_paid'
    and (select public.is_bill_biller(bill_id));

  get diagnostics changed_rows = row_count;

  if changed_rows <> 1 then
    raise exception 'Only the biller can confirm a marked payment.';
  end if;
end;
$$;

revoke all on function public.mark_bill_participant_paid(uuid) from public;
grant execute on function public.mark_bill_participant_paid(uuid) to authenticated;

revoke all on function public.confirm_bill_participant_paid(uuid) from public;
grant execute on function public.confirm_bill_participant_paid(uuid) to authenticated;
