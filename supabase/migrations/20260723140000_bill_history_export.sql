create or replace function public.get_bill_history_export()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with visible_bills as materialized (
    select bill.*
    from public.bills as bill
  ),
  visible_participants as materialized (
    select participant.*
    from public.bill_participants as participant
    join visible_bills as bill on bill.id = participant.bill_id
  )
  select jsonb_build_object(
    'bills', coalesce((
      select jsonb_agg(
        to_jsonb(bill)
        order by bill.incurred_on desc, bill.created_at desc, bill.id
      )
      from visible_bills as bill
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(to_jsonb(category) order by category.name, category.id)
      from public.bill_categories as category
    ), '[]'::jsonb),
    'profiles', coalesce((
      select jsonb_agg(to_jsonb(profile) order by profile.full_name, profile.id)
      from public.profiles as profile
    ), '[]'::jsonb),
    'participants', coalesce((
      select jsonb_agg(
        to_jsonb(participant)
        order by participant.created_at, participant.id
      )
      from visible_participants as participant
    ), '[]'::jsonb),
    'line_items', coalesce((
      select jsonb_agg(
        to_jsonb(line_item)
        order by line_item.created_at, line_item.id
      )
      from public.bill_line_items as line_item
      join visible_participants as participant
        on participant.id = line_item.bill_participant_id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(
        to_jsonb(history_event)
        order by history_event.created_at, history_event.id
      )
      from public.bill_status_history as history_event
      join visible_participants as participant
        on participant.id = history_event.bill_participant_id
    ), '[]'::jsonb),
    'receipts', coalesce((
      select jsonb_agg(
        to_jsonb(receipt)
        order by receipt.created_at, receipt.id
      )
      from public.bill_receipts as receipt
      join visible_bills as bill on bill.id = receipt.bill_id
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_bill_history_export() from public;
grant execute on function public.get_bill_history_export() to authenticated;

comment on function public.get_bill_history_export() is
  'Returns every open, settled, or soft-deleted bill visible to the caller with its complete RLS-protected audit context in one database round trip.';

notify pgrst, 'reload schema';
