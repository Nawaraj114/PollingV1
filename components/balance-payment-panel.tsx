"use client";

import {
  BanknoteArrowUp,
  Check,
  LoaderCircle,
  ReceiptText,
} from "lucide-react";
import { useActionState, useState } from "react";

import {
  markBalanceAllocationsPaid,
  type BalancePaymentState,
} from "@/lib/balances/actions";
import { formatMinorInr } from "@/lib/bills/money";

const initialState: BalancePaymentState = {};

export type DueAllocation = {
  amountMinor: number;
  billerName: string;
  description: string;
  id: string;
  incurredOn: string;
};

function formatBillDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function BalancePaymentPanel({
  allocations,
}: {
  allocations: DueAllocation[];
}) {
  const [state, action, pending] = useActionState(
    markBalanceAllocationsPaid,
    initialState,
  );
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(allocations.map(({ id }) => id)),
  );
  const allSelected =
    allocations.length > 0 && selectedIds.size === allocations.length;
  const selectedTotal = allocations.reduce(
    (total, allocation) =>
      selectedIds.has(allocation.id)
        ? total + allocation.amountMinor
        : total,
    0,
  );

  function toggleAllocation(allocationId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(allocationId)) next.delete(allocationId);
      else next.add(allocationId);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(
      allSelected
        ? new Set()
        : new Set(allocations.map(({ id }) => id)),
    );
  }

  return (
    <section className="mt-10 rounded-[2rem] border border-[#b7d7ff] bg-[#f7fbff] p-5 shadow-[0_16px_45px_rgba(20,115,230,0.08)] sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5e87b5]">
            Quick payment
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
            Mark bills as paid
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#65788e]">
            Select the payments you have actually sent. They will move to
            awaiting confirmation together, with a separate audit entry for
            every bill.
          </p>
        </div>
        <button
          className="button button-light shrink-0"
          disabled={pending}
          onClick={toggleAll}
          type="button"
        >
          <Check size={16} aria-hidden="true" />
          {allSelected ? "Clear all" : "Select all"}
        </button>
      </div>

      <form
        action={action}
        className="mt-6"
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Mark ${selectedIds.size} ${selectedIds.size === 1 ? "payment" : "payments"} totalling ${formatMinorInr(selectedTotal)} as sent? This cannot be undone.`,
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <div className="grid gap-3">
          {allocations.map((allocation) => {
            const checked = selectedIds.has(allocation.id);
            return (
              <label
                className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition-colors ${
                  checked
                    ? "border-[#8fc3ff] bg-white"
                    : "border-black/6 bg-white/45"
                }`}
                key={allocation.id}
              >
                <input
                  checked={checked}
                  className="h-5 w-5 shrink-0 accent-[#1473e6]"
                  disabled={pending}
                  name="participantIds"
                  onChange={() => toggleAllocation(allocation.id)}
                  type="checkbox"
                  value={allocation.id}
                />
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#edf5ff] text-[#1473e6]">
                  <ReceiptText size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {allocation.description}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#818d9a]">
                    To {allocation.billerName} ·{" "}
                    {formatBillDate(allocation.incurredOn)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold">
                  {formatMinorInr(allocation.amountMinor)}
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-[#202124] p-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
              Selected total
            </p>
            <p className="mt-1 text-xl font-semibold tracking-[-0.03em]">
              {formatMinorInr(selectedTotal)}
              <span className="ml-2 text-sm font-medium text-white/50">
                · {selectedIds.size} of {allocations.length}
              </span>
            </p>
          </div>
          <button
            className="button button-primary min-w-52"
            disabled={pending || selectedIds.size === 0}
            type="submit"
          >
            {pending ? (
              <LoaderCircle
                className="animate-spin"
                size={17}
                aria-hidden="true"
              />
            ) : (
              <BanknoteArrowUp size={17} aria-hidden="true" />
            )}
            {pending
              ? "Marking payments"
              : allSelected
                ? `Mark all ${allocations.length} as paid`
                : `Mark selected (${selectedIds.size})`}
          </button>
        </div>

        {state.message && (
          <p
            aria-live="polite"
            className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
              state.status === "success"
                ? "bg-[#eaf8ee] text-[#2f7042]"
                : "bg-[#fff0ed] text-[#a23e30]"
            }`}
            role={state.status === "error" ? "alert" : "status"}
          >
            {state.message}
          </p>
        )}
      </form>
    </section>
  );
}
