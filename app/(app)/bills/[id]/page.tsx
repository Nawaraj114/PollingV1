import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  History,
  LockKeyhole,
  RotateCcw,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DisputeResolutionForm } from "@/components/dispute-resolution-form";
import { DeleteBillForm } from "@/components/delete-bill-form";
import { MemberAvatar } from "@/components/member-avatar";
import { ParticipantAllocationActions } from "@/components/participant-allocation-actions";
import { requireViewer } from "@/lib/auth/session";
import { formatInr } from "@/lib/bills/money";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export const metadata: Metadata = { title: "Bill Details" };

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(timestamp));
}

function eventValue(data: Json, key: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const value = data[key];
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: bill, error } = await supabase
    .from("bills")
    .select("biller_id, category_id, created_at, deleted_at, deleted_by, description, id, incurred_on, status, total_amount")
    .eq("id", id)
    .maybeSingle();

  if (error || !bill) {
    notFound();
  }

  const [{ data: categories }, { data: profiles }, { data: participants }] = await Promise.all([
    supabase.from("bill_categories").select("id, name"),
    supabase.from("profiles").select("avatar_path, full_name, id"),
    supabase
      .from("bill_participants")
      .select("auth_method, auth_status, authenticated_at, dispute_note, disputed_at, id, owed_amount, participant_id, split_method")
      .eq("bill_id", bill.id)
      .order("created_at"),
  ]);
  const participantIds = (participants ?? []).map(({ id: participantId }) => participantId);
  const [{ data: lineItems }, { data: history }] = participantIds.length
    ? await Promise.all([
        supabase
          .from("bill_line_items")
          .select("amount, bill_participant_id, category_id, id")
          .in("bill_participant_id", participantIds)
          .order("created_at"),
        supabase
          .from("bill_status_history")
          .select("actor_id, bill_participant_id, created_at, event_data, event_type, id")
          .in("bill_participant_id", participantIds)
          .order("created_at")
          .order("id"),
      ])
    : [{ data: [] }, { data: [] }];
  const categoryById = new Map((categories ?? []).map((category) => [category.id, category.name]));
  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const biller = profilesById.get(bill.biller_id);
  const avatarUrls = new Map<string, string>();
  const viewerParticipant = (participants ?? []).find(
    ({ participant_id }) => participant_id === viewer.id,
  );
  const isBiller = bill.biller_id === viewer.id;
  const isDeleted = bill.deleted_at !== null;
  const hasDispute = (participants ?? []).some(
    ({ auth_status }) => auth_status === "disputed",
  );
  const unlockedAllocations = (participants ?? []).filter(
    ({ auth_status }) => auth_status !== "authenticated",
  );
  const lockedTotal = (participants ?? [])
    .filter(({ auth_status }) => auth_status === "authenticated")
    .reduce((total, participant) => total + participant.owed_amount, 0);

  await Promise.all(
    (profiles ?? []).map(async (profile) => {
      if (!profile.avatar_path) return;
      const { data } = await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 60 * 60);
      if (data?.signedUrl) avatarUrls.set(profile.id, data.signedUrl);
    }),
  );

  return (
    <main className="mx-auto max-w-5xl px-5 py-9 sm:px-8 sm:py-12">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#6f727a] hover:text-[#202124]" href="/bills">
        <ArrowLeft size={16} aria-hidden="true" /> Back to bills
      </Link>

      <section className="mt-6 overflow-hidden rounded-[2rem] bg-[#202124] text-white shadow-[0_24px_70px_rgba(25,27,31,0.18)]">
        <div className="p-6 sm:p-9">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#163d68] px-3 py-1.5 text-xs font-semibold text-[#75baff]">{categoryById.get(bill.category_id) ?? "Bill"}</span>
            <span className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-semibold capitalize text-white/70">{bill.status}</span>
            {isDeleted && <span className="rounded-full bg-[#6b2924] px-3 py-1.5 text-xs font-semibold text-[#ffb9b1]">Deleted</span>}
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">{bill.description}</h1>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/55">
                <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} aria-hidden="true" /> {formatDate(bill.incurred_on)}</span>
                <span className="inline-flex items-center gap-1.5"><UserRound size={15} aria-hidden="true" /> Paid by {bill.biller_id === viewer.id ? "you" : biller?.full_name ?? "Circle member"}</span>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-white/45">Bill total</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.04em]">{formatInr(bill.total_amount)}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-white/8 bg-white/4 px-6 py-4 text-sm text-white/55 sm:px-9">
          {isDeleted
            ? `Deleted by the bill creator on ${formatTimestamp(bill.deleted_at!)}. This record and its audit history are read-only.`
            : "Phase 3 requires each participant to accept or dispute their allocation. Accepted amounts are database-locked; payment arrives in Phase 4."}
        </div>
      </section>

      <section className="mt-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#1473e6]">Allocation</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Who owes what</h2>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#777a82] shadow-sm">{participants?.length ?? 0} participant{participants?.length === 1 ? "" : "s"}</span>
        </div>

        <div className="mt-5 grid gap-4">
          {(participants ?? []).map((participant) => {
            const profile = profilesById.get(participant.participant_id);
            const personLineItems = (lineItems ?? []).filter(({ bill_participant_id }) => bill_participant_id === participant.id);
            const isViewer = participant.participant_id === viewer.id;
            const statusStyles = {
              authenticated: "bg-[#eaf8ee] text-[#2f7042]",
              disputed: "bg-[#fff0d0] text-[#94620f]",
              pending: "bg-[#f0f1f3] text-[#777a82]",
            }[participant.auth_status];
            const statusLabel = {
              authenticated: "Accepted & locked",
              disputed: "Disputed",
              pending: "Awaiting acceptance",
            }[participant.auth_status];

            return (
              <article className={`rounded-[1.5rem] border bg-white p-5 ${isViewer ? "border-[#8fc3ff] shadow-[0_8px_30px_rgba(20,115,230,0.08)]" : "border-black/7"}`} key={participant.id}>
                <div className="flex items-center gap-3">
                  <MemberAvatar avatarUrl={avatarUrls.get(participant.participant_id)} name={profile?.full_name ?? "Circle member"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{profile?.full_name ?? "Circle member"}</h3>
                      {isViewer && <span className="rounded-full bg-[#edf5ff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#1473e6]">You</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${statusStyles}`}>{statusLabel}</span>
                    </div>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs capitalize text-[#898c93]"><CircleDot size={12} aria-hidden="true" /> {participant.split_method.replace("explicit", "exact amount").replace("automatic", "auto-split")}</p>
                  </div>
                  <p className="text-xl font-semibold tracking-[-0.035em]">{formatInr(participant.owed_amount)}</p>
                </div>

                {personLineItems.length > 0 && (
                  <div className="mt-4 grid gap-2 border-t border-[#ececef] pt-4 sm:grid-cols-2">
                    {personLineItems.map((lineItem) => (
                      <div className="flex items-center justify-between rounded-xl bg-[#f7f7f8] px-3 py-2 text-sm" key={lineItem.id}>
                        <span className="text-[#74777f]">{categoryById.get(lineItem.category_id) ?? "Category"}</span>
                        <span className="font-semibold">{formatInr(lineItem.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {participant.dispute_note && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#fff8e8] px-3 py-2.5 text-sm leading-6 text-[#79571c]">
                    <AlertTriangle className="mt-1 shrink-0" size={14} aria-hidden="true" />
                    “{participant.dispute_note}”
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {viewerParticipant && !isDeleted && (
        <ParticipantAllocationActions
          authenticatedAt={viewerParticipant.authenticated_at}
          disputeNote={viewerParticipant.dispute_note}
          participantId={viewerParticipant.id}
          status={viewerParticipant.auth_status}
        />
      )}

      {isBiller && hasDispute && !isDeleted && (
        <DisputeResolutionForm
          allocations={unlockedAllocations.map((participant) => ({
            amount: participant.owed_amount,
            disputeNote: participant.dispute_note,
            id: participant.id,
            name:
              profilesById.get(participant.participant_id)?.full_name ??
              "Circle member",
            status: participant.auth_status as "disputed" | "pending",
          }))}
          billId={bill.id}
          lockedTotal={lockedTotal}
          totalAmount={bill.total_amount}
        />
      )}

      <section className="mt-7 flex items-start gap-3 rounded-[1.5rem] border border-[#b9dfc5] bg-[#eefaf1] p-5 text-[#27663a]">
        <CheckCircle2 className="mt-0.5 shrink-0" size={19} aria-hidden="true" />
        <div>
          <h2 className="font-semibold">The allocation matches the full bill total</h2>
          <p className="mt-1 text-sm leading-6 text-[#4a7657]">Both the app server and database validate the amounts before this bill can be created.</p>
        </div>
      </section>

      {isBiller && !isDeleted && <DeleteBillForm billId={bill.id} />}

      <section className="mt-7 rounded-[1.7rem] border border-black/7 bg-white p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f0effc] text-[#625cb5]">
            <History size={19} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#625cb5]">Immutable audit trail</p>
            <h2 className="mt-0.5 text-xl font-semibold tracking-[-0.03em]">Allocation history</h2>
          </div>
        </div>

        <div className="mt-6 space-y-0">
          {(history ?? []).map((event, index) => {
            const participant = (participants ?? []).find(
              ({ id: participantId }) => participantId === event.bill_participant_id,
            );
            const participantName = participant
              ? profilesById.get(participant.participant_id)?.full_name ?? "Circle member"
              : "Circle member";
            const actorName =
              event.actor_id === viewer.id
                ? "You"
                : profilesById.get(event.actor_id)?.full_name ?? "Circle member";
            const eventDetails = {
              amount_updated: `${actorName} corrected ${participantName}'s allocation to ${formatInr(Number(eventValue(event.event_data, "owed_amount") ?? participant?.owed_amount ?? 0))}.`,
              authenticated: `${participantName} accepted and database-locked the allocation with password authentication.`,
              bill_deleted: `${actorName} deleted the bill. The record became read-only and moved out of active bills.`,
              breakdown_updated: `${actorName} updated ${participantName}'s category breakdown.`,
              created: `${actorName} created ${participantName}'s ${formatInr(Number(eventValue(event.event_data, "owed_amount") ?? participant?.owed_amount ?? 0))} allocation.`,
              disputed: `${participantName} disputed the allocation: “${String(eventValue(event.event_data, "note") ?? "Correction requested") }”`,
              resubmitted: `${actorName} corrected or resubmitted ${participantName}'s allocation for a new review.`,
            }[event.event_type];
            const EventIcon = {
              amount_updated: RotateCcw,
              authenticated: LockKeyhole,
              bill_deleted: AlertTriangle,
              breakdown_updated: RotateCcw,
              created: CircleDot,
              disputed: AlertTriangle,
              resubmitted: RotateCcw,
            }[event.event_type];

            return (
              <div className="grid grid-cols-[2rem_1fr] gap-3" key={event.id}>
                <div className="flex flex-col items-center">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f1f1f4] text-[#666a73]">
                    <EventIcon size={14} aria-hidden="true" />
                  </span>
                  {index < (history?.length ?? 0) - 1 && <span className="h-full w-px bg-[#e4e5e8]" />}
                </div>
                <div className="pb-6">
                  <p className="text-sm leading-6 text-[#42454b]">{eventDetails}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#9699a0]"><Clock3 size={12} aria-hidden="true" /> {formatTimestamp(event.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
