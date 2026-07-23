create or replace function public.get_circle_balance_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  snapshot jsonb;
begin
  if viewer_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = viewer_id
  ) then
    raise exception 'A circle profile is required.';
  end if;

  with accepted_open_allocations as materialized (
    select
      participant.id as participant_id,
      participant.participant_id as debtor_id,
      bill.biller_id as creditor_id,
      bill.id as bill_id,
      bill.description,
      bill.incurred_on,
      round(participant.owed_amount * 100)::bigint as amount_minor,
      participant.payment_status
    from public.bill_participants as participant
    join public.bills as bill on bill.id = participant.bill_id
    where bill.status = 'open'
      and bill.deleted_at is null
      and participant.auth_status = 'authenticated'
      and participant.payment_status in ('unpaid', 'marked_paid')
  ),
  actionable_obligations as (
    select
      debtor_id,
      creditor_id,
      sum(amount_minor)::bigint as amount_minor
    from accepted_open_allocations
    where payment_status = 'unpaid'
    group by debtor_id, creditor_id
  ),
  viewer_awaiting as (
    select
      coalesce(sum(amount_minor) filter (
        where payment_status = 'marked_paid'
          and debtor_id = viewer_id
      ), 0)::bigint as sent_minor,
      coalesce(sum(amount_minor) filter (
        where payment_status = 'marked_paid'
          and creditor_id = viewer_id
      ), 0)::bigint as receivable_minor
    from accepted_open_allocations
  )
  select jsonb_build_object(
    'obligations',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'debtor_id', debtor_id,
          'creditor_id', creditor_id,
          'amount_minor', amount_minor
        )
        order by debtor_id, creditor_id
      )
      from actionable_obligations
    ), '[]'::jsonb),
    'viewer_due',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'participant_id', participant_id,
          'bill_id', bill_id,
          'biller_id', creditor_id,
          'description', description,
          'incurred_on', incurred_on,
          'amount_minor', amount_minor
        )
        order by incurred_on desc, bill_id
      )
      from accepted_open_allocations
      where payment_status = 'unpaid'
        and debtor_id = viewer_id
    ), '[]'::jsonb),
    'viewer_awaiting',
    jsonb_build_object(
      'sent_minor', viewer_awaiting.sent_minor,
      'receivable_minor', viewer_awaiting.receivable_minor
    )
  )
  into snapshot
  from viewer_awaiting;

  return snapshot;
end;
$$;

comment on function public.get_circle_balance_snapshot() is
  'Returns aggregate circle obligations, the caller''s payable allocation details, and only the caller''s marked-paid totals. Pending, disputed, deleted, settled, and confirmed allocations are excluded.';

create or replace function public.mark_bill_participants_paid(
  p_participant_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requested_count integer;
  eligible_count integer;
  changed_rows integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.';
  end if;

  requested_count := cardinality(p_participant_ids);

  if requested_count is null
    or requested_count < 1
    or requested_count > 50 then
    raise exception 'Choose between 1 and 50 unpaid allocations.';
  end if;

  if (
    select count(distinct participant_id)
    from unnest(p_participant_ids) as participant_id
  ) <> requested_count then
    raise exception 'Every selected allocation must be unique.';
  end if;

  select count(*)
  into eligible_count
  from public.bill_participants as participant
  join public.bills as bill on bill.id = participant.bill_id
  where participant.id = any(p_participant_ids)
    and participant.participant_id = (select auth.uid())
    and participant.auth_status = 'authenticated'
    and participant.payment_status = 'unpaid'
    and bill.status = 'open'
    and bill.deleted_at is null;

  if eligible_count <> requested_count then
    raise exception 'Every selected allocation must be your accepted unpaid bill.';
  end if;

  update public.bill_participants as participant
  set payment_status = 'marked_paid'
  from public.bills as bill
  where participant.id = any(p_participant_ids)
    and participant.participant_id = (select auth.uid())
    and participant.auth_status = 'authenticated'
    and participant.payment_status = 'unpaid'
    and bill.id = participant.bill_id
    and bill.status = 'open'
    and bill.deleted_at is null;

  get diagnostics changed_rows = row_count;

  if changed_rows <> requested_count then
    raise exception 'One or more selected allocations changed. Refresh and try again.';
  end if;

  return changed_rows;
end;
$$;

revoke all on function public.mark_bill_participants_paid(uuid[]) from public;
grant execute on function public.mark_bill_participants_paid(uuid[]) to authenticated;

comment on function public.mark_bill_participants_paid(uuid[]) is
  'Atomically marks up to 50 of the caller''s accepted, active, unpaid allocations as sent. Existing triggers timestamp and audit every row.';
