"use client";

import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  CircleDot,
  Clock3,
  History,
  UserRound,
} from "lucide-react";
import { useState } from "react";

import { DeleteBillForm } from "@/components/delete-bill-form";
import { DisputeResolutionForm } from "@/components/dispute-resolution-form";
import { ParticipantAllocationActions } from "@/components/participant-allocation-actions";
import {
  ConfirmReceiptForm,
  ParticipantPaymentAction,
} from "@/components/payment-actions";
import { formatInr } from "@/lib/bills/money";
import type { Json } from "@/types/database";

type FeedParticipant = {
  authMethod: "password" | "webauthn" | null;
  authenticatedAt: string | null;
  authStatus: "authenticated" | "disputed" | "pending";
  confirmedAt: string | null;
  disputeNote: string | null;
  id: string;
  lineItems: Array<{
    amount: number;
    categoryName: string;
    id: string;
  }>;
  name: string;
  owedAmount: number;
  paidAt: string | null;
  participantId: string;
  paymentStatus: "confirmed_paid" | "marked_paid" | "unpaid";
  splitMethod: "automatic" | "breakdown" | "explicit";
};

type FeedHistoryEvent = {
  actorId: string;
  actorName: string;
  createdAt: string;
  eventData: Json;
  eventType:
    | "amount_updated"
    | "authenticated"
    | "bill_deleted"
    | "bill_settled"
    | "breakdown_updated"
    | "confirmed_paid"
    | "created"
    | "disputed"
    | "marked_paid"
    | "resubmitted";
  id: string;
  participantId: string;
};

type FeedBill = {
  billerId: string;
  billerName: string;
  categoryName: string;
  deletedAt: string | null;
  description: string;
  id: string;
  incurredOn: string;
  status: "open" | "settled";
  totalAmount: number;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
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

function participantStatus(participant: FeedParticipant) {
  if (participant.paymentStatus === "confirmed_paid") return "Payment confirmed";
  if (participant.paymentStatus === "marked_paid") return "Awaiting receipt";
  return {
    authenticated: "Accepted · unpaid",
    disputed: "Disputed",
    pending: "Awaiting acceptance",
  }[participant.authStatus];
}

export function BillFeedCard({
  bill,
  hasPasskey,
  history,
  initiallyExpanded = false,
  participants,
  viewerId,
}: {
  bill: FeedBill;
  hasPasskey: boolean;
  history: FeedHistoryEvent[];
  initiallyExpanded?: boolean;
  participants: FeedParticipant[];
  viewerId: string;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const viewerAllocation = participants.find(
    ({ participantId }) => participantId === viewerId,
  );
  const isBiller = bill.billerId === viewerId;
  const isDeleted = Boolean(bill.deletedAt);
  const markedPayments = participants.filter(
    ({ paymentStatus }) => paymentStatus === "marked_paid",
  );
  const hasDispute = participants.some(
    ({ authStatus }) => authStatus === "disputed",
  );
  const unlockedAllocations = participants.filter(
    ({ authStatus }) => authStatus !== "authenticated",
  );
  const lockedTotal = participants
    .filter(({ authStatus }) => authStatus === "authenticated")
    .reduce((total, participant) => total + participant.owedAmount, 0);
  const acceptedCount = participants.filter(
    ({ authStatus }) => authStatus === "authenticated",
  ).length;
  const confirmedCount = participants.filter(
    ({ paymentStatus }) => paymentStatus === "confirmed_paid",
  ).length;
  const viewerStatus = isDeleted
    ? "Deleted"
    : bill.status === "settled"
      ? "Settled"
      : viewerAllocation?.paymentStatus === "confirmed_paid"
        ? "Payment confirmed"
        : viewerAllocation?.paymentStatus === "marked_paid"
          ? "Awaiting receipt confirmation"
          : viewerAllocation
            ? {
                authenticated: "Accepted · payment due",
                disputed: "You disputed",
                pending: "Needs your review",
              }[viewerAllocation.authStatus]
            : isBiller && markedPayments.length > 0
              ? "Confirm a payment"
              : hasDispute
                ? "Dispute needs attention"
                : `${acceptedCount}/${participants.length} accepted`;

  return (
    <article className="overflow-hidden rounded-[1.6rem] border border-black/7 bg-white shadow-[0_9px_30px_rgba(34,37,43,0.035)]">
      <div className="p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#edf5ff] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#1767bf]">
                {bill.categoryName}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${isDeleted ? "bg-[#fff0ee] text-[#a33a30]" : "bg-[#f1f2f3] text-[#70737a]"}`}>
                {viewerStatus}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.035em]">
              {bill.description}
            </h2>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#81848c]">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden="true" /> {formatDate(bill.incurredOn)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound size={14} aria-hidden="true" /> Paid by {isBiller ? "you" : bill.billerName}
              </span>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-xs font-medium text-[#92959d]">
              {viewerAllocation ? "You owe" : "Bill total"}
            </p>
            <p className="mt-1 text-xl font-semibold tracking-[-0.035em]">
              {formatInr(viewerAllocation?.owedAmount ?? bill.totalAmount)}
            </p>
            <p className="mt-1 text-xs text-[#92959d]">
              {bill.status === "settled"
                ? "All payments confirmed"
                : `${confirmedCount} of ${participants.length} payments confirmed`}
            </p>
          </div>
        </div>

        {!isDeleted && viewerAllocation?.authStatus === "pending" && (
          <ParticipantAllocationActions
            authenticatedAt={viewerAllocation.authenticatedAt}
            compact
            disputeNote={viewerAllocation.disputeNote}
            hasPasskey={hasPasskey}
            participantId={viewerAllocation.id}
            status={viewerAllocation.authStatus}
          />
        )}

        {!isDeleted && viewerAllocation?.authStatus === "disputed" && (
          <ParticipantAllocationActions
            authenticatedAt={viewerAllocation.authenticatedAt}
            compact
            disputeNote={viewerAllocation.disputeNote}
            hasPasskey={hasPasskey}
            participantId={viewerAllocation.id}
            status={viewerAllocation.authStatus}
          />
        )}

        {!isDeleted && viewerAllocation?.authStatus === "authenticated" && (
          <ParticipantPaymentAction
            compact
            confirmedAt={viewerAllocation.confirmedAt}
            paidAt={viewerAllocation.paidAt}
            participantId={viewerAllocation.id}
            paymentStatus={viewerAllocation.paymentStatus}
          />
        )}

        {!isDeleted && isBiller && markedPayments.length > 0 && (
          <section className="mt-5 border-t border-[#e8e9eb] pt-5">
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-0.5 shrink-0 text-[#1473e6]" size={19} aria-hidden="true" />
              <div>
                <h3 className="font-semibold">Confirm received payments</h3>
                <p className="mt-1 text-sm leading-6 text-[#74777f]">
                  Confirm only after the money reaches you.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {markedPayments.map((participant) => (
                <ConfirmReceiptForm
                  amount={participant.owedAmount}
                  hasPasskey={hasPasskey}
                  key={participant.id}
                  name={participant.name}
                  participantId={participant.id}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <button
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 border-t border-[#ececef] bg-[#fafafa] px-5 py-3.5 text-left text-sm font-semibold text-[#666a73] hover:bg-[#f5f6f7] sm:px-6"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span>{expanded ? "Hide details" : "More details"}</span>
        <ChevronDown
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          size={17}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="border-t border-[#ececef] bg-[#fcfcfd] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#1473e6]">
                Full breakdown
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-[-0.025em]">Who owes what</h3>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#777a82] shadow-sm">
              Total {formatInr(bill.totalAmount)}
            </span>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {participants.map((participant) => (
              <div className="rounded-2xl border border-[#e4e5e8] bg-white p-4" key={participant.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {participant.participantId === viewerId ? "You" : participant.name}
                      </p>
                      <span className="rounded-full bg-[#f1f2f3] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#74777f]">
                        {participantStatus(participant)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs capitalize text-[#92959d]">
                      {participant.splitMethod.replace("explicit", "exact amount").replace("automatic", "auto-split")}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">{formatInr(participant.owedAmount)}</p>
                </div>

                {participant.lineItems.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-[#ececef] pt-3">
                    {participant.lineItems.map((lineItem) => (
                      <div className="flex justify-between gap-3 text-xs" key={lineItem.id}>
                        <span className="text-[#7d8088]">{lineItem.categoryName}</span>
                        <span className="font-semibold">{formatInr(lineItem.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {participant.disputeNote && (
                  <p className="mt-3 rounded-xl bg-[#fff8e8] px-3 py-2 text-xs leading-5 text-[#79571c]">
                    <AlertTriangle className="mr-1.5 inline" size={13} aria-hidden="true" />
                    {participant.disputeNote}
                  </p>
                )}
              </div>
            ))}
          </div>

          {isBiller && hasDispute && !isDeleted && (
            <DisputeResolutionForm
              allocations={unlockedAllocations.map((participant) => ({
                amount: participant.owedAmount,
                disputeNote: participant.disputeNote,
                id: participant.id,
                name: participant.name,
                status: participant.authStatus as "disputed" | "pending",
              }))}
              billId={bill.id}
              lockedTotal={lockedTotal}
              totalAmount={bill.totalAmount}
            />
          )}

          <details className="mt-6 rounded-2xl border border-[#e4e5e8] bg-white p-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-[#666a73]">
              <History size={16} className="text-[#625cb5]" aria-hidden="true" />
              Audit history ({history.length})
            </summary>
            <div className="mt-4 space-y-4 border-t border-[#ececef] pt-4">
              {history.map((event) => {
                const participant = participants.find(({ id }) => id === event.participantId);
                const participantName = participant?.participantId === viewerId
                  ? "You"
                  : participant?.name ?? "Circle member";
                const actorName = event.actorId === viewerId ? "You" : event.actorName;
                const details = {
                  amount_updated: `${actorName} corrected ${participantName}'s allocation to ${formatInr(Number(eventValue(event.eventData, "owed_amount") ?? participant?.owedAmount ?? 0))}.`,
                  authenticated: `${participantName} accepted and locked the allocation with ${eventValue(event.eventData, "auth_method") === "webauthn" ? "passkey" : "password"} authentication.`,
                  bill_deleted: `${actorName} deleted the bill.`,
                  bill_settled: `${actorName} confirmed the final payment and settled the bill.`,
                  breakdown_updated: `${actorName} updated ${participantName}'s category breakdown.`,
                  confirmed_paid: `${actorName} confirmed receipt of ${participantName}'s payment.`,
                  created: `${actorName} created ${participantName}'s ${formatInr(Number(eventValue(event.eventData, "owed_amount") ?? participant?.owedAmount ?? 0))} allocation.`,
                  disputed: `${participantName} disputed the allocation: “${String(eventValue(event.eventData, "note") ?? "Correction requested")}”`,
                  marked_paid: `${participantName} marked the payment as sent.`,
                  resubmitted: `${actorName} resubmitted ${participantName}'s allocation for review.`,
                }[event.eventType];

                return (
                  <div className="grid grid-cols-[1.5rem_1fr] gap-2.5" key={event.id}>
                    <CircleDot className="mt-1 text-[#777a82]" size={14} aria-hidden="true" />
                    <div>
                      <p className="text-sm leading-6 text-[#4b4e55]">{details}</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#9699a0]">
                        <Clock3 size={12} aria-hidden="true" /> {formatTimestamp(event.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </details>

          {isBiller && !isDeleted && <DeleteBillForm billId={bill.id} />}
          {isDeleted && bill.deletedAt && (
            <p className="mt-5 text-sm text-[#92959d]">
              Deleted {formatTimestamp(bill.deletedAt)}. This record is read-only.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
