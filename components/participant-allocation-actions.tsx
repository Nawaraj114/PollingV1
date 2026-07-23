"use client";

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useActionState } from "react";

import {
  acceptAllocation,
  disputeAllocation,
  type BillActionState,
} from "@/lib/bills/state-actions";
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

export function ParticipantAllocationActions({
  authenticatedAt,
  compact = false,
  disputeNote,
  hasPasskey,
  participantId,
  status,
}: {
  authenticatedAt: string | null;
  compact?: boolean;
  disputeNote: string | null;
  hasPasskey: boolean;
  participantId: string;
  status: "authenticated" | "disputed" | "pending";
}) {
  const [acceptState, acceptAction, accepting] = useActionState(
    acceptAllocation,
    initialState,
  );
  const [disputeState, disputeAction, disputing] = useActionState(
    disputeAllocation,
    initialState,
  );

  if (status === "authenticated") {
    return (
      <section className={`${compact ? "mt-5" : "mt-7 rounded-[1.5rem] border border-[#b9dfc5] p-5"} flex items-start gap-3 bg-[#eefaf1] text-[#27663a]`}>
        <LockKeyhole className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
        <div>
          <h2 className="font-semibold">You accepted this allocation</h2>
          <p className="mt-1 text-sm leading-6 text-[#4a7657]">
            The amount and category breakdown are now locked by the database
            {authenticatedAt
              ? ` since ${new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Kathmandu",
                }).format(new Date(authenticatedAt))}`
              : ""}.
          </p>
        </div>
      </section>
    );
  }

  if (status === "disputed") {
    return (
      <section className={`${compact ? "mt-5 rounded-2xl p-4" : "mt-7 rounded-[1.5rem] p-5"} flex items-start gap-3 border border-[#efd39a] bg-[#fff8e8] text-[#79571c]`}>
        <AlertTriangle className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
        <div>
          <h2 className="font-semibold">You disputed this allocation</h2>
          <p className="mt-1 text-sm leading-6 text-[#866a36]">
            “{disputeNote}” The biller must correct and resubmit the unlocked
            allocations before you can review them again.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={compact ? "mt-5 border-t border-[#dceafb] pt-5" : "mt-7 rounded-[1.7rem] border border-[#9cc9ff] bg-white p-5 shadow-[0_10px_35px_rgba(20,115,230,0.08)] sm:p-7"}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#edf5ff] text-[#1473e6]">
          <ShieldCheck size={19} aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold tracking-[-0.02em]">Review your allocation</h2>
          <p className="mt-1 text-sm leading-6 text-[#74777f]">
            Approve with this device&apos;s passkey or use your password as a fallback.
            Once accepted, neither the biller nor a direct API call can alter this amount.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#dceafb] bg-[#f7fbff] p-4">
          {hasPasskey && (
            <div className="mb-4 border-b border-[#dceafb] pb-4">
              <p className="mb-3 text-sm font-semibold">Approve with this device</p>
              <PasskeyStepUpButton
                action="accept_allocation"
                label="Authenticate & accept"
                targetId={participantId}
              />
            </div>
          )}
          <form action={acceptAction} noValidate>
          <input name="participantId" type="hidden" value={participantId} />
          <label className="block text-sm font-semibold" htmlFor={`password-${participantId}`}>
            {hasPasskey ? "Password fallback" : "Re-enter your password"}
          </label>
          <input
            autoComplete="current-password"
            className="field mt-2 h-11"
            id={`password-${participantId}`}
            name="password"
            required
            type="password"
          />
          {acceptState.errors?.password?.[0] && (
            <p className="mt-1.5 text-sm text-[#c43f32]" role="alert">{acceptState.errors.password[0]}</p>
          )}
          <button className="button button-primary mt-3 w-full" disabled={accepting} type="submit">
            {accepting ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
            {accepting ? "Verifying" : "Authenticate & accept"}
          </button>
          <ActionMessage state={acceptState} />
          </form>
        </div>

        <form action={disputeAction} className="rounded-2xl border border-[#eee0c0] bg-[#fffaf0] p-4" noValidate>
          <input name="participantId" type="hidden" value={participantId} />
          <label className="block text-sm font-semibold" htmlFor={`note-${participantId}`}>
            Something is wrong?
          </label>
          <textarea
            className="field mt-2 min-h-20 resize-y py-3"
            id={`note-${participantId}`}
            maxLength={300}
            name="note"
            placeholder="Explain what should be corrected"
            required
          />
          {disputeState.errors?.note?.[0] && (
            <p className="mt-1.5 text-sm text-[#c43f32]" role="alert">{disputeState.errors.note[0]}</p>
          )}
          <button className="button button-light mt-3 w-full border-[#e3c98f] text-[#79571c]" disabled={disputing} type="submit">
            {disputing ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <AlertTriangle size={17} aria-hidden="true" />}
            {disputing ? "Submitting" : "Dispute allocation"}
          </button>
          <ActionMessage state={disputeState} />
        </form>
      </div>
    </section>
  );
}
