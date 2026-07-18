import {
  ArrowRight,
  CalendarDays,
  CirclePlus,
  ReceiptText,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { requireViewer } from "@/lib/auth/session";
import { formatInr } from "@/lib/bills/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bills" };

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}
export default async function BillsPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: bills, error } = await supabase
    .from("bills")
    .select("biller_id, category_id, created_at, description, id, incurred_on, status, total_amount")
    .order("incurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  const billIds = (bills ?? []).map(({ id }) => id);
  const [{ data: categories }, { data: profiles }, participantResult] = await Promise.all([
    supabase.from("bill_categories").select("id, name"),
    supabase.from("profiles").select("full_name, id"),
    billIds.length
      ? supabase.from("bill_participants").select("bill_id, owed_amount, participant_id").in("bill_id", billIds)
      : Promise.resolve({ data: [] }),
  ]);
  const categoryById = new Map((categories ?? []).map((category) => [category.id, category.name]));
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const participants = participantResult.data ?? [];

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">
            <ReceiptText size={14} className="text-[#1473e6]" aria-hidden="true" />
            Billing core
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">My bills</h1>
          <p className="mt-3 max-w-xl text-lg leading-8 text-[#74777f]">
            Bills you paid and bills where a friend included you.
          </p>
        </div>
        <Link className="button button-primary h-12 px-5" href="/bills/new">
          <CirclePlus size={18} aria-hidden="true" /> Create bill
        </Link>
      </section>

      {error && (
        <div className="mt-8 rounded-2xl border border-[#f1c5bf] bg-[#fff3f1] px-5 py-4 text-sm text-[#9e342a]">
          Billing data could not be loaded. Confirm that the Phase 2 migration has been applied.
        </div>
      )}

      {!error && !bills?.length && (
        <section className="mt-10 rounded-[2rem] border border-dashed border-[#cfd1d6] bg-white px-6 py-14 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#edf5ff] text-[#1473e6]">
            <ReceiptText size={25} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em]">No bills in your circle yet</h2>
          <p className="mx-auto mt-2 max-w-md leading-7 text-[#7d8088]">Create the first bill and let the tested split calculator assign every paisa.</p>
          <Link className="button button-dark mt-6" href="/bills/new">Create your first bill</Link>
        </section>
      )}

      <section className="mt-9 grid gap-4" aria-label="Bills">
        {(bills ?? []).map((bill) => {
          const billParticipants = participants.filter(({ bill_id }) => bill_id === bill.id);
          const viewerAllocation = billParticipants.find(({ participant_id }) => participant_id === viewer.id);
          const billerName = profileById.get(bill.biller_id) ?? "Circle member";

          return (
            <Link
              className="group grid gap-5 rounded-[1.6rem] border border-black/7 bg-white p-5 shadow-[0_9px_30px_rgba(34,37,43,0.035)] hover:-translate-y-0.5 hover:shadow-[0_15px_38px_rgba(34,37,43,0.08)] sm:grid-cols-[1fr_auto] sm:items-center sm:p-6"
              href={`/bills/${bill.id}`}
              key={bill.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#edf5ff] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#1767bf]">
                    {categoryById.get(bill.category_id) ?? "Bill"}
                  </span>
                  <span className="rounded-full bg-[#f1f2f3] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#70737a]">
                    {bill.status}
                  </span>
                </div>
                <h2 className="mt-3 truncate text-xl font-semibold tracking-[-0.035em]">{bill.description}</h2>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#81848c]">
                  <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" /> {formatDate(bill.incurred_on)}</span>
                  <span className="inline-flex items-center gap-1.5"><UserRound size={14} aria-hidden="true" /> Paid by {bill.biller_id === viewer.id ? "you" : billerName}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-5 sm:justify-end">
                <div className="text-left sm:text-right">
                  <p className="text-xs font-medium text-[#92959d]">{viewerAllocation ? "You owe" : "Bill total"}</p>
                  <p className="mt-1 text-xl font-semibold tracking-[-0.035em]">{formatInr(viewerAllocation?.owed_amount ?? bill.total_amount)}</p>
                  <p className="mt-1 text-xs text-[#92959d]">{billParticipants.length} participant{billParticipants.length === 1 ? "" : "s"}</p>
                </div>
                <ArrowRight className="text-[#a6a8ae] group-hover:translate-x-1 group-hover:text-[#202124]" size={19} aria-hidden="true" />
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
