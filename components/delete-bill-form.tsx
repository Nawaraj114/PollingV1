"use client";

import { LoaderCircle, Trash2, X } from "lucide-react";
import { useActionState, useState } from "react";

import {
  deleteBill,
  type BillActionState,
} from "@/lib/bills/state-actions";

const initialState: BillActionState = {};

export function DeleteBillForm({ billId }: { billId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteBill, initialState);

  if (!open) {
    return (
      <button
        className="button mt-7 border border-[#efc4be] bg-white text-[#a33a30] hover:bg-[#fff4f1]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Trash2 size={17} aria-hidden="true" /> Delete this bill
      </button>
    );
  }

  return (
    <section className="mt-7 rounded-[1.7rem] border border-[#efb8b0] bg-[#fff6f4] p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#b44236]">Confirm deletion</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">Remove this bill from active bills?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7f5b57]">
            The bill will become read-only and move to Deleted bills. Its members
            and audit history are retained so an accepted record cannot silently disappear.
          </p>
        </div>
        <button
          aria-label="Cancel bill deletion"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#8a625d] hover:bg-white"
          disabled={pending}
          onClick={() => setOpen(false)}
          type="button"
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>

      <form action={formAction} className="mt-5 max-w-xl" noValidate>
        <input name="billId" type="hidden" value={billId} />
        <label className="block text-sm font-semibold" htmlFor={`delete-password-${billId}`}>
          Re-enter your account password
        </label>
        <input
          autoComplete="current-password"
          className="field mt-2"
          id={`delete-password-${billId}`}
          name="password"
          required
          type="password"
        />
        {state.errors?.password?.[0] && (
          <p className="mt-1.5 text-sm text-[#c43f32]" role="alert">{state.errors.password[0]}</p>
        )}

        <label className="mt-4 flex items-start gap-2.5 text-sm leading-6 text-[#684d49]">
          <input
            className="mt-1 h-4 w-4 shrink-0 accent-[#b44236]"
            name="confirmation"
            type="checkbox"
          />
          I understand this bill will be removed from active bills and cannot be restored.
        </label>
        {state.errors?.confirmation?.[0] && (
          <p className="mt-1.5 text-sm text-[#c43f32]" role="alert">{state.errors.confirmation[0]}</p>
        )}

        {state.message && (
          <p className="mt-3 rounded-xl bg-[#ffe9e5] px-3 py-2 text-sm text-[#9e342a]" role="alert">
            {state.message}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button className="button bg-[#b44236] text-white hover:bg-[#96352c]" disabled={pending} type="submit">
            {pending ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <Trash2 size={17} aria-hidden="true" />}
            {pending ? "Deleting bill" : "Confirm deletion"}
          </button>
          <button className="button button-light" disabled={pending} onClick={() => setOpen(false)} type="button">
            Keep bill
          </button>
        </div>
      </form>
    </section>
  );
}

