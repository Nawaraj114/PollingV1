import { CirclePlus, Download, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { BillFeedCard } from "@/components/bill-feed-card";
import { BillRealtimeRefresh } from "@/components/bill-realtime-refresh";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const metadata: Metadata = { title: "Bills" };

type PublicTables = Database["public"]["Tables"];
type BillFeedPayload = {
  bills: PublicTables["bills"]["Row"][];
  categories: PublicTables["bill_categories"]["Row"][];
  history: PublicTables["bill_status_history"]["Row"][];
  line_items: PublicTables["bill_line_items"]["Row"][];
  participants: PublicTables["bill_participants"]["Row"][];
  profiles: PublicTables["profiles"]["Row"][];
  receipts: PublicTables["bill_receipts"]["Row"][];
};

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ bill?: string }>;
}) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { bill: expandedBillId } = await searchParams;
  const requestHeaders = await headers();
  const requestHost = (
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? ""
  )
    .split(",")[0]
    .trim()
    .replace(/:\d+$/u, "");
  const [
    { data: rawFeed, error },
    { data: currentSitePasskey },
  ] = await Promise.all([
    supabase.rpc("get_bill_feed"),
    supabase
      .from("webauthn_credentials")
      .select("id")
      .eq("user_id", viewer.id)
      .eq("rp_id", requestHost)
      .limit(1)
      .maybeSingle(),
  ]);
  const feed = (rawFeed ?? {
    bills: [],
    categories: [],
    history: [],
    line_items: [],
    participants: [],
    profiles: [],
    receipts: [],
  }) as unknown as BillFeedPayload;
  const bills = feed.bills;
  const categories = feed.categories;
  const profiles = feed.profiles;
  const participants = feed.participants;
  const lineItems = feed.line_items;
  const history = feed.history;
  const receipts = feed.receipts;
  const receiptPaths = receipts.map(({ storage_path }) => storage_path);
  const { data: signedReceipts } = receiptPaths.length
    ? await supabase.storage
        .from("bill-receipts")
        .createSignedUrls(receiptPaths, 60 * 60)
    : { data: [] };
  const receiptUrlByPath = new Map(
    (signedReceipts ?? []).map((receipt) => [
      receipt.path,
      receipt.signedUrl,
    ]),
  );
  const categoryById = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const profileById = new Map(
    profiles.map((profile) => [profile.id, profile.full_name]),
  );
  const activeBills = bills.filter(({ deleted_at }) => !deleted_at);
  const deletedBills = bills.filter(({ deleted_at }) => Boolean(deleted_at));
  const hasPasskey = Boolean(currentSitePasskey);

  function renderBill(bill: (typeof bills)[number]) {
    const billParticipants = participants.filter(
      ({ bill_id }) => bill_id === bill.id,
    );
    const billParticipantIds = new Set(
      billParticipants.map(({ id }) => id),
    );
    const receipt = receipts.find(({ bill_id }) => bill_id === bill.id);

    return (
      <BillFeedCard
        bill={{
          billerId: bill.biller_id,
          billerName: profileById.get(bill.biller_id) ?? "Circle member",
          categoryName: categoryById.get(bill.category_id) ?? "Bill",
          deletedAt: bill.deleted_at,
          description: bill.description,
          id: bill.id,
          incurredOn: bill.incurred_on,
          status: bill.status,
          totalAmount: bill.total_amount,
        }}
        hasPasskey={hasPasskey}
        history={history
          .filter(({ bill_participant_id }) => billParticipantIds.has(bill_participant_id))
          .map((event) => ({
            actorId: event.actor_id,
            actorName: profileById.get(event.actor_id) ?? "Circle member",
            createdAt: event.created_at,
            eventData: event.event_data,
            eventType: event.event_type,
            id: event.id,
            participantId: event.bill_participant_id,
          }))}
        initiallyExpanded={bill.id === expandedBillId}
        key={bill.id}
        participants={billParticipants.map((participant) => ({
          authMethod: participant.auth_method,
          authenticatedAt: participant.authenticated_at,
          authStatus: participant.auth_status,
          confirmedAt: participant.confirmed_at,
          disputeNote: participant.dispute_note,
          id: participant.id,
          lineItems: lineItems
            .filter(({ bill_participant_id }) => bill_participant_id === participant.id)
            .map((lineItem) => ({
              amount: lineItem.amount,
              categoryName: categoryById.get(lineItem.category_id) ?? "Category",
              id: lineItem.id,
            })),
          name: profileById.get(participant.participant_id) ?? "Circle member",
          owedAmount: participant.owed_amount,
          paidAt: participant.paid_at,
          participantId: participant.participant_id,
          paymentStatus: participant.payment_status,
          splitMethod: participant.split_method,
        }))}
        receipt={
          receipt
            ? {
                createdAt: receipt.created_at,
                id: receipt.id,
                originalName: receipt.original_name,
                signedUrl:
                  receiptUrlByPath.get(receipt.storage_path) ?? null,
                storagePath: receipt.storage_path,
                uploaderName:
                  profileById.get(receipt.uploaded_by) ?? "Circle member",
              }
            : null
        }
        viewerId={viewer.id}
      />
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">
            <ReceiptText size={14} className="text-[#1473e6]" aria-hidden="true" />
            Billing trust controls
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            My bills
          </h1>
          <p className="mt-3 max-w-xl text-lg leading-8 text-[#74777f]">
            Review, accept, and record payments without leaving this page.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            className="button button-light h-12 px-5"
            download
            href="/api/bills/export"
          >
            <Download size={18} aria-hidden="true" /> Export history
          </a>
          <Link className="button button-primary h-12 px-5" href="/bills/new" prefetch>
            <CirclePlus size={18} aria-hidden="true" /> Create bill
          </Link>
        </div>
      </section>

      {error && (
        <div className="mt-8 rounded-2xl border border-[#f1c5bf] bg-[#fff3f1] px-5 py-4 text-sm text-[#9e342a]">
          Billing data could not be loaded. Refresh and try again.
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <BillRealtimeRefresh />
      </div>

      {!error && !activeBills.length && (
        <section className="mt-4 rounded-[2rem] border border-dashed border-[#cfd1d6] bg-white px-6 py-14 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#edf5ff] text-[#1473e6]">
            <ReceiptText size={25} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em]">
            No active bills in your circle
          </h2>
          <p className="mx-auto mt-2 max-w-md leading-7 text-[#7d8088]">
            Create a bill and let the tested split calculator assign every paisa.
          </p>
          <Link className="button button-dark mt-6" href="/bills/new" prefetch>
            Create your first bill
          </Link>
        </section>
      )}

      <section className="mt-4 grid gap-5" aria-label="Active bills">
        {activeBills.map(renderBill)}
      </section>

      {deletedBills.length > 0 && (
        <details className="mt-10 rounded-[1.6rem] border border-black/7 bg-white p-5 sm:p-6">
          <summary className="cursor-pointer text-sm font-semibold text-[#6f727a]">
            Deleted bills ({deletedBills.length})
          </summary>
          <p className="mt-2 text-sm leading-6 text-[#92959d]">
            Deleted bills are read-only and retained for everyone who was part of them.
          </p>
          <div className="mt-4 grid gap-4">
            {deletedBills.map(renderBill)}
          </div>
        </details>
      )}
    </main>
  );
}
