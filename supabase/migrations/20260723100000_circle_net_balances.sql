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
      participant.participant_id as debtor_id,
      bill.biller_id as creditor_id,
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

revoke all on function public.get_circle_balance_snapshot() from public;
grant execute on function public.get_circle_balance_snapshot() to authenticated;

comment on function public.get_circle_balance_snapshot() is
  'Returns circle-wide, bill-free aggregate obligations for debt simplification plus only the caller''s marked-paid totals. Pending, disputed, deleted, settled, and confirmed allocations are excluded.';
