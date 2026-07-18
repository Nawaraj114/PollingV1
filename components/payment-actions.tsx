"use client";

import {
  BadgeCheck,
  BanknoteArrowUp,
  Clock3,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useActionState } from "react";

import {
  confirmPaymentReceipt,
  markAllocationPaid,
  type BillActionState,
} from "@/lib/bills/state-actions";
import { formatInr } from "@/lib/bills/money";
import { PasskeyStepUpButton } from "@/components/passkey-step-up-button";

const initialState: BillActionState = {};

function ActionMessage({ state }: { state: BillActionState }) {
  if (!state.message) return null;

  return (
    <p
      className={`mt-3 rounded-xl px-3 py-2 text-sm ${
        state.status === "success"
          ? "bg-[#eefaf1] text-[#27663a]"
          : "bg-[#fff3f1] text-[#9e342a]"
      }`}
      role="status"
    >
      {state.message}
    </p>
  );
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(timestamp));
}

export function ParticipantPaymentAction({
  confirmedAt,
  paidAt,
  participantId,
  paymentStatus,
}: {
  confirmedAt: string | null;
  paidAt: string | null;
  participantId: string;
  paymentStatus: "confirmed_paid" | "marked_paid" | "unpaid";
}) {
  const [state, action, pending] = useActionState(markAllocationPaid, initialState);

  if (paymentStatus === "confirmed_paid") {
    return (
      <section className="mt-7 flex items-start gap-3 rounded-[1.5rem] border border-[#b9dfc5] bg-[#eefaf1] p-5 text-[#27663a]">
        <BadgeCheck className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
        <div>
          <h2 className="font-semibold">Your payment was confirmed</h2>
          <p className="mt-1 text-sm leading-6 text-[#4a7657]">
            The biller confirmed receipt
            {confirmedAt ? ` on ${formatTimestamp(confirmedAt)}` : ""}. This payment record is now locked.
          </p>
        </div>
      </section>
    );
  }

  if (paymentStatus === "marked_paid") {
    return (
      <section className="mt-7 flex items-start gap-3 rounded-[1.5rem] border border-[#9cc9ff] bg-[#f7fbff] p-5 text-[#285e99]">
        <Clock3 className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
        <div>
          <h2 className="font-semibold">Waiting for receipt confirmation</h2>
          <p className="mt-1 text-sm leading-6 text-[#56789d]">
            You marked this payment as sent
            {paidAt ? ` on ${formatTimestamp(paidAt)}` : ""}. The biller must confirm that it was received.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-7 rounded-[1.7rem] border border-[#9cc9ff] bg-white p-5 shadow-[0_10px_35px_rgba(20,115,230,0.08)] sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#edf5ff] text-[#1473e6]">
          <BanknoteArrowUp size={19} aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h2 className="font-semibold tracking-[-0.02em]">Have you paid this amount?</h2>
          <p className="mt-1 text-sm leading-6 text-[#74777f]">
            Mark it only after sending the payment. The biller will still need to confirm receipt.
          </p>
        </div>
      </div>
      <form action={action} className="mt-5" noValidate>
        <input name="participantId" type="hidden" value={participantId} />
        <button className="button button-primary w-full sm:w-auto" disabled={pending} type="submit">
          {pending ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <BanknoteArrowUp size={17} aria-hidden="true" />}
          {pending ? "Recording payment" : "Mark as paid"}
        </button>
        <ActionMessage state={state} />
      </form>
    </section>
  );
}

export function ConfirmReceiptForm({
  amount,
  hasPasskey,
  name,
  participantId,
}: {
  amount: number;
  hasPasskey: boolean;
  name: string;
  participantId: string;
}) {
  const [state, action, pending] = useActionState(confirmPaymentReceipt, initialState);

  return (
    <div className="rounded-2xl border border-[#dceafb] bg-[#f7fbff] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{name}</p>
          <p className="mt-0.5 text-sm text-[#74777f]">Marked {formatInr(amount)} as paid</p>
        </div>
        <ShieldCheck className="shrink-0 text-[#1473e6]" size={19} aria-hidden="true" />
      </div>
      {hasPasskey && (
        <div className="mt-4">
          <PasskeyStepUpButton
            action="confirm_receipt"
            label="Confirm receipt with passkey"
            targetId={participantId}
          />
        </div>
      )}
      <form action={action} className={hasPasskey ? "mt-4 border-t border-[#dceafb] pt-4" : "mt-4"} noValidate>
        <input name="participantId" type="hidden" value={participantId} />
        <label className="block text-sm font-semibold" htmlFor={`confirm-password-${participantId}`}>
          {hasPasskey ? "Password fallback" : "Re-enter your password to confirm receipt"}
        </label>
        <input
          autoComplete="current-password"
          className="field mt-2 h-11"
          id={`confirm-password-${participantId}`}
          name="password"
          required
          type="password"
        />
        {state.errors?.password?.[0] && (
          <p className="mt-1.5 text-sm text-[#c43f32]" role="alert">{state.errors.password[0]}</p>
        )}
        <button className={`button mt-3 w-full ${hasPasskey ? "button-light" : "button-primary"}`} disabled={pending} type="submit">
          {pending ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <BadgeCheck size={17} aria-hidden="true" />}
          {pending ? "Confirming" : "Confirm receipt with password"}
        </button>
        <ActionMessage state={state} />
      </form>
    </div>
  );
}
