"use client";

import { AlertTriangle, LoaderCircle, RotateCcw } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { formatInr } from "@/lib/bills/money";
import {
  resubmitAllocations,
  type BillActionState,
} from "@/lib/bills/state-actions";

type UnlockedAllocation = {
  amount: number;
  disputeNote: string | null;
  id: string;
  name: string;
  status: "disputed" | "pending";
};

const initialState: BillActionState = {};

export function DisputeResolutionForm({
  allocations,
  billId,
  lockedTotal,
  totalAmount,
}: {
  allocations: UnlockedAllocation[];
  billId: string;
  lockedTotal: number;
  totalAmount: number;
}) {
  const [state, formAction, pending] = useActionState(
    resubmitAllocations,
    initialState,
  );
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(
      allocations.map((allocation) => [allocation.id, allocation.amount.toFixed(2)]),
    ),
  );
  const proposedTotal = useMemo(
    () =>
      lockedTotal +
      allocations.reduce((total, allocation) => {
        const value = Number(amounts[allocation.id]);
        return total + (Number.isFinite(value) ? value : 0);
      }, 0),
    [allocations, amounts, lockedTotal],
  );
  const allocationsJson = JSON.stringify(
    allocations.map((allocation) => ({
      amount: amounts[allocation.id],
      participantRowId: allocation.id,
    })),
  );
  const balances = Math.abs(proposedTotal - totalAmount) < 0.001;

  return (
    <section className="mt-7 rounded-[1.7rem] border border-[#efd39a] bg-[#fffaf0] p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-[#a86608]" size={21} aria-hidden="true" />
        <div>
          <h2 className="font-semibold tracking-[-0.02em]">Resolve disputed allocations</h2>
          <p className="mt-1 text-sm leading-6 text-[#7e6a43]">
            Correct unlocked amounts and resubmit them. Accepted allocations stay
            locked, and the complete bill must still equal {formatInr(totalAmount)}.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-5" noValidate>
        <input name="allocationsJson" type="hidden" value={allocationsJson} />
        <input name="billId" type="hidden" value={billId} />
        <div className="space-y-3">
          {allocations.map((allocation) => (
            <div className="rounded-2xl border border-[#eadbb9] bg-white p-4" key={allocation.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{allocation.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${allocation.status === "disputed" ? "bg-[#fff0d0] text-[#94620f]" : "bg-[#f0f1f3] text-[#777a82]"}`}>
                      {allocation.status}
                    </span>
                  </div>
                  {allocation.disputeNote && (
                    <p className="mt-1 text-sm leading-6 text-[#8a6729]">“{allocation.disputeNote}”</p>
                  )}
                </div>
                <div className="sm:w-44">
                  <label className="sr-only" htmlFor={`resolution-${allocation.id}`}>Corrected amount for {allocation.name}</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-semibold text-[#777a82]">₹</span>
                    <input
                      className="field h-11 pl-9"
                      id={`resolution-${allocation.id}`}
                      inputMode="decimal"
                      onChange={(event) => setAmounts((current) => ({ ...current, [allocation.id]: event.target.value }))}
                      required
                      value={amounts[allocation.id]}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={`mt-4 flex flex-col gap-3 rounded-2xl px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${balances ? "bg-[#eefaf1] text-[#27663a]" : "bg-[#fff3f1] text-[#9e342a]"}`}>
          <span>Accepted and locked: {formatInr(lockedTotal)}</span>
          <span className="font-semibold">Proposed total: {formatInr(proposedTotal)}</span>
        </div>

        {state.message && (
          <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${state.status === "success" ? "bg-[#eefaf1] text-[#27663a]" : "bg-[#fff3f1] text-[#9e342a]"}`} role="status">
            {state.message}
          </p>
        )}

        <button className="button button-dark mt-4" disabled={pending || !balances} type="submit">
          {pending ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <RotateCcw size={17} aria-hidden="true" />}
          {pending ? "Resubmitting" : "Resubmit for acceptance"}
        </button>
      </form>
    </section>
  );
}

