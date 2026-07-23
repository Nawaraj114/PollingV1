create table public.bill_receipts (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null unique references public.bills (id) on delete restrict,
  uploaded_by uuid not null references auth.users (id) on delete restrict,
  storage_path text not null unique
    check (char_length(storage_path) between 10 and 240),
  original_name text not null
    check (char_length(trim(original_name)) between 1 and 120),
  mime_type text not null
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size integer not null
    check (file_size between 1 and 5242880),
  created_at timestamptz not null default now()
);

create index bill_receipts_uploader_created_idx
on public.bill_receipts (uploaded_by, created_at desc);

comment on table public.bill_receipts is
  'Private receipt image metadata. The object itself lives in the bill-receipts Storage bucket and signed URLs are generated only when read.';

alter table public.bill_receipts enable row level security;

revoke all on table public.bill_receipts from anon, authenticated;
grant select, insert, delete on table public.bill_receipts to authenticated;

create or replace function public.can_manage_bill_receipt(
  target_bill_id uuid
)
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
      and status = 'open'
      and deleted_at is null
  );
$$;

create or replace function public.can_manage_bill_receipt_path(
  target_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (storage.foldername(target_path))[1] = (select auth.uid()::text)
    and exists (
      select 1
      from public.bills
      where id::text = (storage.foldername(target_path))[2]
        and biller_id = (select auth.uid())
        and status = 'open'
        and deleted_at is null
    );
$$;

revoke all on function public.can_manage_bill_receipt(uuid) from public;
revoke all on function public.can_manage_bill_receipt_path(text) from public;
grant execute on function public.can_manage_bill_receipt(uuid) to authenticated;
grant execute on function public.can_manage_bill_receipt_path(text) to authenticated;

create policy "Bill members can read receipt metadata"
on public.bill_receipts
for select
to authenticated
using ((select public.can_read_bill(bill_id)));

create policy "Billers can attach one receipt to active bills"
on public.bill_receipts
for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (select public.can_manage_bill_receipt(bill_id))
  and storage_path like (
    (select auth.uid()::text) || '/' || bill_id::text || '/%'
  )
);

create policy "Billers can remove receipts from active bills"
on public.bill_receipts
for delete
to authenticated
using (
  uploaded_by = (select auth.uid())
  and (select public.can_manage_bill_receipt(bill_id))
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'bill-receipts',
  'bill-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Bill members can view receipt objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'bill-receipts'
  and exists (
    select 1
    from public.bill_receipts as receipt
    where receipt.storage_path = name
      and (select public.can_read_bill(receipt.bill_id))
  )
);

create policy "Billers can upload receipt objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'bill-receipts'
  and (select public.can_manage_bill_receipt_path(name))
);

create policy "Billers can remove receipt objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'bill-receipts'
  and owner_id = (select auth.uid()::text)
  and (select public.can_manage_bill_receipt_path(name))
);

create or replace function public.get_bill_feed()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with visible_bills as materialized (
    select bill.*
    from public.bills as bill
    where bill.status <> 'settled'
  ),
  visible_participants as materialized (
    select participant.*
    from public.bill_participants as participant
    join visible_bills as bill on bill.id = participant.bill_id
  )
  select jsonb_build_object(
    'bills', coalesce((
      select jsonb_agg(to_jsonb(bill) order by bill.incurred_on desc, bill.created_at desc)
      from visible_bills as bill
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(to_jsonb(category) order by category.name)
      from public.bill_categories as category
    ), '[]'::jsonb),
    'profiles', coalesce((
      select jsonb_agg(to_jsonb(profile) order by profile.full_name)
      from public.profiles as profile
    ), '[]'::jsonb),
    'participants', coalesce((
      select jsonb_agg(to_jsonb(participant) order by participant.created_at, participant.id)
      from visible_participants as participant
    ), '[]'::jsonb),
    'line_items', coalesce((
      select jsonb_agg(to_jsonb(line_item) order by line_item.created_at, line_item.id)
      from public.bill_line_items as line_item
      join visible_participants as participant
        on participant.id = line_item.bill_participant_id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(to_jsonb(history_event) order by history_event.created_at, history_event.id)
      from public.bill_status_history as history_event
      join visible_participants as participant
        on participant.id = history_event.bill_participant_id
    ), '[]'::jsonb),
    'receipts', coalesce((
      select jsonb_agg(to_jsonb(receipt) order by receipt.created_at, receipt.id)
      from public.bill_receipts as receipt
      join visible_bills as bill on bill.id = receipt.bill_id
    ), '[]'::jsonb)
  );
$$;

comment on function public.get_bill_feed() is
  'Returns the signed-in member billing feed, including private receipt metadata, in one RLS-protected database round trip; settled bills are excluded.';

alter publication supabase_realtime
add table public.bill_receipts;

notify pgrst, 'reload schema';
