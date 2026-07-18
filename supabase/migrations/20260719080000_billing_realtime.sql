alter publication supabase_realtime
add table
  public.bills,
  public.bill_participants,
  public.bill_line_items,
  public.bill_status_history;
