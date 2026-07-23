create or replace function public.get_action_notifications()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  notification_feed jsonb;
begin
  if viewer_id is null then
    raise exception 'Authentication is required.';
  end if;

  with notification_rows as (
    select
      'allocation_review:' || participant.id::text as id,
      'allocation_review'::text as kind,
      participant.created_at,
      bill.id as resource_id,
      bill.description as resource_label,
      '/bills?bill=' || bill.id::text as href,
      round(participant.owed_amount * 100)::bigint as amount_minor,
      1::integer as action_count
    from public.bill_participants as participant
    join public.bills as bill on bill.id = participant.bill_id
    where participant.participant_id = viewer_id
      and participant.auth_status = 'pending'
      and bill.status = 'open'
      and bill.deleted_at is null

    union all

    select
      'payment_due:' || participant.id::text,
      'payment_due'::text,
      participant.authenticated_at,
      bill.id,
      bill.description,
      '/bills?bill=' || bill.id::text,
      round(participant.owed_amount * 100)::bigint,
      1::integer
    from public.bill_participants as participant
    join public.bills as bill on bill.id = participant.bill_id
    where participant.participant_id = viewer_id
      and participant.auth_status = 'authenticated'
      and participant.payment_status = 'unpaid'
      and bill.status = 'open'
      and bill.deleted_at is null

    union all

    select
      'dispute_resolution:' || bill.id::text,
      'dispute_resolution'::text,
      max(coalesce(participant.disputed_at, participant.updated_at)),
      bill.id,
      bill.description,
      '/bills?bill=' || bill.id::text,
      round(sum(participant.owed_amount) * 100)::bigint,
      count(*)::integer
    from public.bills as bill
    join public.bill_participants as participant
      on participant.bill_id = bill.id
    where bill.biller_id = viewer_id
      and participant.auth_status = 'disputed'
      and bill.status = 'open'
      and bill.deleted_at is null
    group by bill.id, bill.description

    union all

    select
      'confirm_receipt:' || bill.id::text,
      'confirm_receipt'::text,
      max(participant.paid_at),
      bill.id,
      bill.description,
      '/bills?bill=' || bill.id::text,
      round(sum(participant.owed_amount) * 100)::bigint,
      count(*)::integer
    from public.bills as bill
    join public.bill_participants as participant
      on participant.bill_id = bill.id
    where bill.biller_id = viewer_id
      and participant.auth_status = 'authenticated'
      and participant.payment_status = 'marked_paid'
      and bill.status = 'open'
      and bill.deleted_at is null
    group by bill.id, bill.description

    union all

    select
      'poll_vote:' || poll.id::text,
      'poll_vote'::text,
      poll.created_at,
      poll.id,
      poll.question,
      '/polls#poll-' || poll.id::text,
      0::bigint,
      1::integer
    from public.polls as poll
    where poll.status = 'open'
      and (poll.expires_at is null or poll.expires_at > now())
      and not exists (
        select 1
        from public.poll_votes as vote
        where vote.poll_id = poll.id
          and vote.voter_id = viewer_id
      )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'kind', kind,
        'created_at', created_at,
        'resource_id', resource_id,
        'resource_label', resource_label,
        'href', href,
        'amount_minor', amount_minor,
        'action_count', action_count
      )
      order by created_at desc nulls last, id
    ),
    '[]'::jsonb
  )
  into notification_feed
  from notification_rows;

  return notification_feed;
end;
$$;

revoke all on function public.get_action_notifications() from public;
grant execute on function public.get_action_notifications() to authenticated;

comment on function public.get_action_notifications() is
  'Returns the caller''s currently actionable bill and poll notifications. Items are derived from source-of-truth state and clear automatically when resolved.';

notify pgrst, 'reload schema';
