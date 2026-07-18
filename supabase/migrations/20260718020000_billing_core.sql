create table public.bill_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 40),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index bill_categories_system_name_key
on public.bill_categories (lower(name))
where created_by is null;

create unique index bill_categories_member_name_key
on public.bill_categories (created_by, lower(name))
where created_by is not null;

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  biller_id uuid not null references auth.users (id) on delete restrict,
  category_id uuid not null references public.bill_categories (id) on delete restrict,
  total_amount numeric(12, 2) not null check (total_amount > 0),
  incurred_on date not null,
  description text not null check (char_length(trim(description)) between 2 and 200),
  status text not null default 'open' check (status in ('open', 'settled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bills_biller_created_idx
on public.bills (biller_id, created_at desc);

create table public.bill_participants (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills (id) on delete cascade,
  participant_id uuid not null references auth.users (id) on delete restrict,
  owed_amount numeric(12, 2) not null check (owed_amount > 0),
  split_method text not null check (split_method in ('automatic', 'explicit', 'breakdown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bill_id, participant_id)
);

create index bill_participants_member_idx
on public.bill_participants (participant_id, created_at desc);

create table public.bill_line_items (
  id uuid primary key default gen_random_uuid(),
  bill_participant_id uuid not null references public.bill_participants (id) on delete cascade,
  category_id uuid not null references public.bill_categories (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (bill_participant_id, category_id)
);

create index bill_line_items_participant_idx
on public.bill_line_items (bill_participant_id);

comment on table public.bill_categories is 'System and member-created categories available to the trusted circle.';
comment on table public.bills is 'Bill headers created by the member who paid and recorded the expense.';
comment on table public.bill_participants is 'Per-member owed allocations calculated in integer minor units by the app and stored as exact numerics.';
comment on table public.bill_line_items is 'Optional category breakdown that must exactly equal a breakdown participant allocation.';

insert into public.bill_categories (id, name)
values
  ('00000000-0000-4000-8000-000000000001', 'Food'),
  ('00000000-0000-4000-8000-000000000002', 'Games'),
  ('00000000-0000-4000-8000-000000000003', 'Beverages'),
  ('00000000-0000-4000-8000-000000000004', 'Others');

alter table public.bill_categories enable row level security;
alter table public.bills enable row level security;
alter table public.bill_participants enable row level security;
alter table public.bill_line_items enable row level security;

revoke all on table public.bill_categories from anon, authenticated;
revoke all on table public.bills from anon, authenticated;
revoke all on table public.bill_participants from anon, authenticated;
revoke all on table public.bill_line_items from anon, authenticated;

grant select, insert on table public.bill_categories to authenticated;
grant select, insert, update on table public.bills to authenticated;
grant select, insert, update, delete on table public.bill_participants to authenticated;
grant select, insert, update, delete on table public.bill_line_items to authenticated;

create or replace function public.is_bill_biller(target_bill_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bills
    where id = target_bill_id
      and biller_id = (select auth.uid())
  );
$$;

create or replace function public.can_read_bill(target_bill_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bills
    where id = target_bill_id
      and biller_id = (select auth.uid())
  ) or exists (
    select 1
    from public.bill_participants
    where bill_id = target_bill_id
      and participant_id = (select auth.uid())
  );
$$;

revoke all on function public.is_bill_biller(uuid) from public;
revoke all on function public.can_read_bill(uuid) from public;
grant execute on function public.is_bill_biller(uuid) to authenticated;
grant execute on function public.can_read_bill(uuid) to authenticated;

create policy "Members can read circle categories"
on public.bill_categories
for select
to authenticated
using (true);

create policy "Members can create their own categories"
on public.bill_categories
for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy "Bill members can read bills"
on public.bills
for select
to authenticated
using ((select public.can_read_bill(id)));

create policy "Billers can create bills"
on public.bills
for insert
to authenticated
with check (biller_id = (select auth.uid()));

create policy "Billers can update their bills"
on public.bills
for update
to authenticated
using (biller_id = (select auth.uid()))
with check (biller_id = (select auth.uid()));

create policy "Bill members can read participant allocations"
on public.bill_participants
for select
to authenticated
using ((select public.can_read_bill(bill_id)));

create policy "Billers can add participant allocations"
on public.bill_participants
for insert
to authenticated
with check ((select public.is_bill_biller(bill_id)));

create policy "Billers can update participant allocations"
on public.bill_participants
for update
to authenticated
using ((select public.is_bill_biller(bill_id)))
with check ((select public.is_bill_biller(bill_id)));

create policy "Billers can remove participant allocations"
on public.bill_participants
for delete
to authenticated
using ((select public.is_bill_biller(bill_id)));

create policy "Bill members can read allocation line items"
on public.bill_line_items
for select
to authenticated
using (
  exists (
    select 1
    from public.bill_participants
    where id = bill_participant_id
      and (select public.can_read_bill(bill_id))
  )
);

create policy "Billers can add allocation line items"
on public.bill_line_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.bill_participants
    where id = bill_participant_id
      and (select public.is_bill_biller(bill_id))
  )
);

create policy "Billers can update allocation line items"
on public.bill_line_items
for update
to authenticated
using (
  exists (
    select 1
    from public.bill_participants
    where id = bill_participant_id
      and (select public.is_bill_biller(bill_id))
  )
)
with check (
  exists (
    select 1
    from public.bill_participants
    where id = bill_participant_id
      and (select public.is_bill_biller(bill_id))
  )
);

create policy "Billers can remove allocation line items"
on public.bill_line_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.bill_participants
    where id = bill_participant_id
      and (select public.is_bill_biller(bill_id))
  )
);

create trigger bills_set_updated_at
before update on public.bills
for each row execute function public.set_updated_at();

create trigger bill_participants_set_updated_at
before update on public.bill_participants
for each row execute function public.set_updated_at();

create or replace function public.create_bill(
  p_total_amount numeric,
  p_incurred_on date,
  p_description text,
  p_category_id uuid,
  p_custom_category text,
  p_participants jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  resolved_category_id uuid;
  new_bill_id uuid;
  participant jsonb;
  participant_row_id uuid;
  line_item jsonb;
  participant_count integer;
  owed_total numeric;
  breakdown_total numeric;
begin
  if viewer_id is null then
    raise exception 'Authentication is required.';
  end if;

  if p_total_amount is null
    or p_total_amount <= 0
    or p_total_amount <> round(p_total_amount, 2) then
    raise exception 'Bill total must be a positive amount with at most two decimal places.';
  end if;

  if p_incurred_on is null then
    raise exception 'Bill date is required.';
  end if;

  if char_length(trim(coalesce(p_description, ''))) not between 2 and 200 then
    raise exception 'Description must contain between 2 and 200 characters.';
  end if;

  if p_category_id is not null and nullif(trim(coalesce(p_custom_category, '')), '') is not null then
    raise exception 'Choose an existing category or create a custom category, not both.';
  end if;

  if p_category_id is not null then
    select id into resolved_category_id
    from public.bill_categories
    where id = p_category_id;

    if resolved_category_id is null then
      raise exception 'The selected category does not exist.';
    end if;
  else
    if char_length(trim(coalesce(p_custom_category, ''))) not between 2 and 40 then
      raise exception 'Custom category must contain between 2 and 40 characters.';
    end if;

    select id into resolved_category_id
    from public.bill_categories
    where created_by = viewer_id
      and lower(name) = lower(trim(p_custom_category))
    limit 1;

    if resolved_category_id is null then
      insert into public.bill_categories (name, created_by)
      values (trim(p_custom_category), viewer_id)
      returning id into resolved_category_id;
    end if;
  end if;

  if jsonb_typeof(p_participants) <> 'array' then
    raise exception 'Participants must be a JSON array.';
  end if;

  participant_count := jsonb_array_length(p_participants);

  if participant_count < 1 or participant_count > 50 then
    raise exception 'Choose between 1 and 50 participants.';
  end if;

  if (
    select count(distinct value ->> 'participant_id')
    from jsonb_array_elements(p_participants)
  ) <> participant_count then
    raise exception 'Every participant must be unique.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_participants)
    where value ->> 'participant_id' is null
      or (value ->> 'participant_id')::uuid = viewer_id
  ) then
    raise exception 'The biller cannot be included as an owing participant.';
  end if;

  if (
    select count(*)
    from public.profiles
    where id in (
      select (value ->> 'participant_id')::uuid
      from jsonb_array_elements(p_participants)
    )
  ) <> participant_count then
    raise exception 'Every participant must be an existing circle member.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_participants)
    where (value ->> 'split_method') not in ('automatic', 'explicit', 'breakdown')
      or (value ->> 'owed_amount')::numeric <= 0
      or (value ->> 'owed_amount')::numeric <> round((value ->> 'owed_amount')::numeric, 2)
      or jsonb_typeof(coalesce(value -> 'line_items', '[]'::jsonb)) <> 'array'
  ) then
    raise exception 'Participant allocations are invalid.';
  end if;

  select sum((value ->> 'owed_amount')::numeric)
  into owed_total
  from jsonb_array_elements(p_participants);

  if owed_total <> p_total_amount then
    raise exception 'Participant allocations must equal the bill total.';
  end if;

  for participant in
    select value from jsonb_array_elements(p_participants)
  loop
    select coalesce(sum((item ->> 'amount')::numeric), 0)
    into breakdown_total
    from jsonb_array_elements(coalesce(participant -> 'line_items', '[]'::jsonb)) as item;

    if participant ->> 'split_method' = 'breakdown' then
      if breakdown_total <> (participant ->> 'owed_amount')::numeric then
        raise exception 'A category breakdown must equal its participant allocation.';
      end if;
    elsif breakdown_total <> 0 then
      raise exception 'Only breakdown allocations may contain line items.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(coalesce(participant -> 'line_items', '[]'::jsonb)) as item
      where (item ->> 'amount')::numeric <= 0
        or (item ->> 'amount')::numeric <> round((item ->> 'amount')::numeric, 2)
        or not exists (
          select 1
          from public.bill_categories
          where id = (item ->> 'category_id')::uuid
        )
    ) then
      raise exception 'A category breakdown contains an invalid line item.';
    end if;
  end loop;

  new_bill_id := gen_random_uuid();

  insert into public.bills (
    id,
    biller_id,
    category_id,
    total_amount,
    incurred_on,
    description
  )
  values (
    new_bill_id,
    viewer_id,
    resolved_category_id,
    p_total_amount,
    p_incurred_on,
    trim(p_description)
  );

  for participant in
    select value from jsonb_array_elements(p_participants)
  loop
    participant_row_id := gen_random_uuid();

    insert into public.bill_participants (
      id,
      bill_id,
      participant_id,
      owed_amount,
      split_method
    )
    values (
      participant_row_id,
      new_bill_id,
      (participant ->> 'participant_id')::uuid,
      (participant ->> 'owed_amount')::numeric,
      participant ->> 'split_method'
    );

    for line_item in
      select value
      from jsonb_array_elements(coalesce(participant -> 'line_items', '[]'::jsonb))
    loop
      insert into public.bill_line_items (
        bill_participant_id,
        category_id,
        amount
      )
      values (
        participant_row_id,
        (line_item ->> 'category_id')::uuid,
        (line_item ->> 'amount')::numeric
      );
    end loop;
  end loop;

  return new_bill_id;
end;
$$;

revoke all on function public.create_bill(numeric, date, text, uuid, text, jsonb) from public;
grant execute on function public.create_bill(numeric, date, text, uuid, text, jsonb) to authenticated;
