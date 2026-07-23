import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  BalancePaymentPanel,
  type DueAllocation,
} from "@/components/balance-payment-panel";
import { BalanceRealtimeRefresh } from "@/components/balance-realtime-refresh";
import { MemberAvatar } from "@/components/member-avatar";
import { requireViewer } from "@/lib/auth/session";
import {
  simplifyBalances,
  type BalanceObligation,
} from "@/lib/balances/simplify";
import { formatMinorInr } from "@/lib/bills/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Balances" };

type BalanceSnapshot = {
  obligations: Array<{
    amount_minor: number;
    creditor_id: string;
    debtor_id: string;
  }>;
  viewer_due: Array<{
    amount_minor: number;
    bill_id: string;
    biller_id: string;
    description: string;
    incurred_on: string;
    participant_id: string;
  }>;
  viewer_awaiting: {
    receivable_minor: number;
    sent_minor: number;
  };
};

function parseMinor(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}

function parseSnapshot(value: unknown): BalanceSnapshot {
  if (!value || typeof value !== "object") {
    return {
      obligations: [],
      viewer_due: [],
      viewer_awaiting: { receivable_minor: 0, sent_minor: 0 },
    };
  }

  const raw = value as {
    obligations?: unknown;
    viewer_due?: unknown;
    viewer_awaiting?: unknown;
  };
  const awaiting =
    raw.viewer_awaiting && typeof raw.viewer_awaiting === "object"
      ? (raw.viewer_awaiting as Record<string, unknown>)
      : {};
  const obligations = Array.isArray(raw.obligations)
    ? raw.obligations.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        const amountMinor = parseMinor(item.amount_minor);
        const creditorId =
          typeof item.creditor_id === "string" ? item.creditor_id : "";
        const debtorId =
          typeof item.debtor_id === "string" ? item.debtor_id : "";

        return amountMinor > 0 && creditorId && debtorId
          ? [{ amount_minor: amountMinor, creditor_id: creditorId, debtor_id: debtorId }]
          : [];
      })
    : [];
  const viewerDue = Array.isArray(raw.viewer_due)
    ? raw.viewer_due.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        const amountMinor = parseMinor(item.amount_minor);
        const billId = typeof item.bill_id === "string" ? item.bill_id : "";
        const billerId =
          typeof item.biller_id === "string" ? item.biller_id : "";
        const description =
          typeof item.description === "string" ? item.description : "";
        const incurredOn =
          typeof item.incurred_on === "string" ? item.incurred_on : "";
        const participantId =
          typeof item.participant_id === "string" ? item.participant_id : "";

        return amountMinor > 0 &&
          billId &&
          billerId &&
          description &&
          incurredOn &&
          participantId
          ? [
              {
                amount_minor: amountMinor,
                bill_id: billId,
                biller_id: billerId,
                description,
                incurred_on: incurredOn,
                participant_id: participantId,
              },
            ]
          : [];
      })
    : [];

  return {
    obligations,
    viewer_due: viewerDue,
    viewer_awaiting: {
      receivable_minor: parseMinor(awaiting.receivable_minor),
      sent_minor: parseMinor(awaiting.sent_minor),
    },
  };
}

export default async function BalancesPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const [
    { data: rawSnapshot, error: balanceError },
    { data: profiles, error: profileError },
  ] = await Promise.all([
    supabase.rpc("get_circle_balance_snapshot"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name", { ascending: true }),
  ]);
  const snapshot = parseSnapshot(rawSnapshot);
  const obligations: BalanceObligation[] = snapshot.obligations.map(
    ({ amount_minor, creditor_id, debtor_id }) => ({
      amountMinor: amount_minor,
      creditorId: creditor_id,
      debtorId: debtor_id,
    }),
  );
  const { memberBalances, transfers } = simplifyBalances(obligations);
  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name]),
  );
  const nameFor = (memberId: string) =>
    profileById.get(memberId) ?? "Circle member";
  const viewerDue: DueAllocation[] = snapshot.viewer_due.map(
    ({
      amount_minor,
      biller_id,
      description,
      incurred_on,
      participant_id,
    }) => ({
      amountMinor: amount_minor,
      billerName: nameFor(biller_id),
      description,
      id: participant_id,
      incurredOn: incurred_on,
    }),
  );
  const viewerBalance =
    memberBalances.find(({ memberId }) => memberId === viewer.id)?.netMinor ?? 0;
  const totalToSettle = transfers.reduce(
    (total, transfer) => total + transfer.amountMinor,
    0,
  );
  const viewerAwaiting =
    snapshot.viewer_awaiting.sent_minor +
    snapshot.viewer_awaiting.receivable_minor;
  const error = balanceError ?? profileError;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">
            <Scale size={14} className="text-[#1473e6]" aria-hidden="true" />
            Circle debt overview
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            Net balances
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-[#74777f]">
            See the smallest practical set of transfers after accepted bills
            are netted across your circle.
          </p>
        </div>
        <BalanceRealtimeRefresh />
      </section>

      {error && (
        <div className="mt-8 rounded-2xl border border-[#f1c5bf] bg-[#fff3f1] px-5 py-4 text-sm text-[#9e342a]">
          Balance data could not be loaded. Apply the Phase 8 migration, then
          refresh this page.
        </div>
      )}

      {!error && (
        <>
          <section className="mt-9 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <article className="overflow-hidden rounded-[2rem] bg-[#202124] p-6 text-white sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                Your current position
              </p>
              {viewerBalance > 0 ? (
                <>
                  <div className="mt-5 flex items-center gap-3 text-[#75d99b]">
                    <TrendingUp size={24} aria-hidden="true" />
                    <span className="text-sm font-semibold">You receive</span>
                  </div>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                    {formatMinorInr(viewerBalance)}
                  </p>
                </>
              ) : viewerBalance < 0 ? (
                <>
                  <div className="mt-5 flex items-center gap-3 text-[#ffad98]">
                    <TrendingDown size={24} aria-hidden="true" />
                    <span className="text-sm font-semibold">You owe</span>
                  </div>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                    {formatMinorInr(-viewerBalance)}
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-5 flex items-center gap-3 text-[#75d99b]">
                    <CheckCircle2 size={24} aria-hidden="true" />
                    <span className="text-sm font-semibold">You are all square</span>
                  </div>
                  <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                    {formatMinorInr(0)}
                  </p>
                </>
              )}
              <p className="mt-6 max-w-lg text-sm leading-6 text-white/55">
                Only accepted, unpaid allocations are included. Pending,
                disputed, deleted, settled, and payment-sent amounts are not.
              </p>
            </article>

            <article className="rounded-[2rem] border border-black/7 bg-white p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a9da4]">
                Circle snapshot
              </p>
              <dl className="mt-6 grid gap-5">
                <div className="flex items-end justify-between gap-4 border-b border-black/7 pb-5">
                  <dt className="text-sm text-[#777a82]">Net transfers</dt>
                  <dd className="text-2xl font-semibold tracking-[-0.04em]">
                    {transfers.length}
                  </dd>
                </div>
                <div className="flex items-end justify-between gap-4 border-b border-black/7 pb-5">
                  <dt className="text-sm text-[#777a82]">Amount to settle</dt>
                  <dd className="text-xl font-semibold tracking-[-0.03em]">
                    {formatMinorInr(totalToSettle)}
                  </dd>
                </div>
                <div className="flex items-end justify-between gap-4">
                  <dt className="text-sm text-[#777a82]">Your payments pending</dt>
                  <dd className="text-xl font-semibold tracking-[-0.03em]">
                    {formatMinorInr(viewerAwaiting)}
                  </dd>
                </div>
              </dl>
            </article>
          </section>

          {viewerAwaiting > 0 && (
            <section className="mt-5 flex items-start gap-3 rounded-2xl border border-[#eed9aa] bg-[#fff9ea] px-5 py-4 text-sm leading-6 text-[#76591d]">
              <Clock className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
              <p>
                {snapshot.viewer_awaiting.sent_minor > 0 &&
                  `${formatMinorInr(snapshot.viewer_awaiting.sent_minor)} you marked as sent is awaiting confirmation. `}
                {snapshot.viewer_awaiting.receivable_minor > 0 &&
                  `${formatMinorInr(snapshot.viewer_awaiting.receivable_minor)} marked as sent to you is awaiting your confirmation. `}
                These amounts stay outside the suggested plan to avoid double
                counting.
              </p>
            </section>
          )}

          {viewerDue.length > 0 && (
            <BalancePaymentPanel
              allocations={viewerDue}
              key={viewerDue.map(({ id }) => id).join("-")}
            />
          )}

          <section className="mt-10 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <article className="rounded-[2rem] border border-black/7 bg-white p-5 sm:p-7">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a9da4]">
                    Simplified plan
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                    Suggested transfers
                  </h2>
                </div>
                <span className="rounded-full bg-[#edf5ff] px-3 py-1.5 text-xs font-semibold text-[#1473e6]">
                  Read-only
                </span>
              </div>

              {!transfers.length ? (
                <div className="mt-7 rounded-2xl bg-[#f3faf5] px-5 py-9 text-center">
                  <CheckCircle2
                    className="mx-auto text-[#3f9460]"
                    size={30}
                    aria-hidden="true"
                  />
                  <h3 className="mt-3 font-semibold">Nothing left to settle</h3>
                  <p className="mt-1 text-sm leading-6 text-[#777a82]">
                    Accepted balances across the circle currently net to zero.
                  </p>
                </div>
              ) : (
                <ol className="mt-7 grid gap-3">
                  {transfers.map((transfer) => {
                    const fromName = nameFor(transfer.fromId);
                    const toName = nameFor(transfer.toId);

                    return (
                      <li
                        className="flex flex-col gap-4 rounded-2xl border border-black/6 bg-[#fafafa] p-4 sm:flex-row sm:items-center"
                        key={`${transfer.fromId}-${transfer.toId}`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <MemberAvatar name={fromName} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{fromName}</p>
                            <p className="text-xs text-[#8a8d94]">pays</p>
                          </div>
                          <ArrowRight
                            className="mx-1 shrink-0 text-[#a1a4aa]"
                            size={18}
                            aria-hidden="true"
                          />
                          <MemberAvatar name={toName} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{toName}</p>
                            <p className="text-xs text-[#8a8d94]">receives</p>
                          </div>
                        </div>
                        <p className="shrink-0 pl-13 text-lg font-semibold tracking-[-0.03em] sm:pl-0">
                          {formatMinorInr(transfer.amountMinor)}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              )}

              <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#f1f3f5] px-4 py-3 text-xs leading-5 text-[#686b73]">
                <Info className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
                <p>
                  This plan summarizes the circle and can combine several bills.
                  Use the quick-payment controls above for your original
                  allocations so each bill&apos;s confirmation and audit history
                  stay exact.
                </p>
              </div>
            </article>

            <article className="rounded-[2rem] border border-black/7 bg-white p-5 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a9da4]">
                Member positions
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                Who is up or down
              </h2>
              {!memberBalances.length ? (
                <p className="mt-6 text-sm leading-6 text-[#7d8088]">
                  Everyone with an accepted bill is currently even.
                </p>
              ) : (
                <ul className="mt-6 grid gap-4">
                  {memberBalances.map(({ memberId, netMinor }) => {
                    const name = nameFor(memberId);
                    return (
                      <li className="flex items-center gap-3" key={memberId}>
                        <MemberAvatar name={name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{name}</p>
                          <p className="text-xs text-[#8b8e95]">
                            {netMinor > 0 ? "receives" : "owes"}
                          </p>
                        </div>
                        <p
                          className={`text-sm font-semibold ${netMinor > 0 ? "text-[#34784c]" : "text-[#a44737]"}`}
                        >
                          {netMinor > 0 ? "+" : "−"}
                          {formatMinorInr(Math.abs(netMinor))}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link className="button button-light mt-7 w-full" href="/bills" prefetch>
                Open bills
              </Link>
            </article>
          </section>
        </>
      )}
    </main>
  );
}
