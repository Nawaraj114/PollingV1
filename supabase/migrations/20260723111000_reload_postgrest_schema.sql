notify pgrst, 'reload schema';

comment on function public.mark_bill_participants_paid(uuid[]) is
  'Atomically marks up to 50 of the caller''s accepted, active, unpaid allocations as sent. Existing triggers timestamp and audit every row.';
