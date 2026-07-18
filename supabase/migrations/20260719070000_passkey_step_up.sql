create table public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  credential_id text not null unique
    check (char_length(credential_id) between 16 and 2048),
  public_key text not null
    check (char_length(public_key) between 16 and 4096),
  counter bigint not null default 0 check (counter >= 0),
  transports text[] not null default '{}'::text[],
  device_type text not null
    check (device_type in ('singleDevice', 'multiDevice')),
  backed_up boolean not null default false,
  device_label text not null
    check (char_length(trim(device_label)) between 2 and 80),
  rp_id text not null check (char_length(rp_id) between 1 and 253),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index webauthn_credentials_user_created_idx
on public.webauthn_credentials (user_id, created_at, id);

create table public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge text not null unique
    check (char_length(challenge) between 16 and 2048),
  ceremony text not null
    check (ceremony in ('registration', 'authentication')),
  action_type text
    check (action_type is null or action_type in ('accept_allocation', 'confirm_receipt')),
  target_id uuid,
  rp_id text not null check (char_length(rp_id) between 1 and 253),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint webauthn_challenge_action_consistency check (
    (
      ceremony = 'registration'
      and action_type is null
      and target_id is null
    )
    or (
      ceremony = 'authentication'
      and action_type is not null
      and target_id is not null
    )
  ),
  constraint webauthn_challenge_expiry_after_creation check (
    expires_at > created_at
  )
);

create index webauthn_challenges_active_user_idx
on public.webauthn_challenges (user_id, ceremony, expires_at)
where used_at is null;

comment on table public.webauthn_credentials is
  'Public-key passkey credentials. Private key material remains in the device authenticator.';

comment on table public.webauthn_challenges is
  'Short-lived, one-time WebAuthn challenges bound to a user, relying-party hostname, and sensitive action.';

alter table public.webauthn_credentials enable row level security;
alter table public.webauthn_challenges enable row level security;

revoke all on table public.webauthn_credentials from anon, authenticated;
revoke all on table public.webauthn_challenges from anon, authenticated;

grant select, delete on table public.webauthn_credentials to authenticated;
grant all on table public.webauthn_credentials to service_role;
grant all on table public.webauthn_challenges to service_role;

create policy "Members can read their own passkeys"
on public.webauthn_credentials
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Members can remove their own passkeys"
on public.webauthn_credentials
for delete
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.friendcircle_actor_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  context_actor text := current_setting('friendcircle.actor_id', true);
begin
  return coalesce(
    (select auth.uid()),
    nullif(context_actor, '')::uuid
  );
end;
$$;

create or replace function public.friendcircle_step_up_method()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(current_setting('friendcircle.step_up_method', true), '');
$$;

revoke all on function public.friendcircle_actor_id() from public;
revoke all on function public.friendcircle_step_up_method() from public;

create or replace function public.enforce_bill_participant_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.friendcircle_actor_id();
  actor_is_biller boolean;
  financial_changed boolean;
  state_metadata_changed boolean;
  step_up_method text := public.friendcircle_step_up_method();
begin
  if actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  actor_is_biller := exists (
    select 1
    from public.bills
    where id = old.bill_id
      and biller_id = actor_id
  );

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

    new.auth_method := case
      when step_up_method = 'webauthn' then 'webauthn'
      else 'password'
    end;
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

create or replace function public.enforce_bill_payment_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.friendcircle_actor_id();
  jwt_issued_at timestamptz;
  payment_metadata_changed boolean;
  step_up_method text := public.friendcircle_step_up_method();
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
    if not exists (
      select 1
      from public.bills
      where id = old.bill_id
        and biller_id = actor_id
    ) then
      raise exception 'Only the biller can confirm receipt.';
    end if;

    if step_up_method <> 'webauthn' then
      jwt_issued_at := to_timestamp(((select auth.jwt()) ->> 'iat')::double precision);
      if jwt_issued_at is null
        or jwt_issued_at < now() - interval '2 minutes' then
        raise exception 'Recent password or passkey authentication is required.';
      end if;
    end if;

    new.paid_at := old.paid_at;
    new.confirmed_at := now();
  else
    raise exception 'That payment status transition is not allowed.';
  end if;

  return new;
end;
$$;

create or replace function public.record_bill_participant_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
  event_payload jsonb;
  event_actor uuid := public.friendcircle_actor_id();
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
  event_actor uuid := public.friendcircle_actor_id();
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

create or replace function public.complete_webauthn_bill_action(
  p_user_id uuid,
  p_action_type text,
  p_participant_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_rows integer;
begin
  if p_action_type not in ('accept_allocation', 'confirm_receipt') then
    raise exception 'Unsupported passkey action.';
  end if;

  perform set_config('friendcircle.actor_id', p_user_id::text, true);
  perform set_config('friendcircle.step_up_method', 'webauthn', true);

  if p_action_type = 'accept_allocation' then
    update public.bill_participants
    set auth_status = 'authenticated'
    where id = p_participant_id
      and participant_id = p_user_id
      and auth_status = 'pending';
  else
    update public.bill_participants as participant
    set payment_status = 'confirmed_paid'
    from public.bills as bill
    where participant.id = p_participant_id
      and bill.id = participant.bill_id
      and bill.biller_id = p_user_id
      and bill.deleted_at is null
      and participant.auth_status = 'authenticated'
      and participant.payment_status = 'marked_paid';
  end if;

  get diagnostics changed_rows = row_count;

  if changed_rows <> 1 then
    raise exception 'The passkey-authorized action is no longer available.';
  end if;
end;
$$;

revoke all on function public.complete_webauthn_bill_action(uuid, text, uuid) from public;
grant execute on function public.complete_webauthn_bill_action(uuid, text, uuid) to service_role;
