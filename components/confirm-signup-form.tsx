"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { confirmSignup, type AuthState } from "@/lib/auth/actions";

const initialAuthState: AuthState = {};

export function ConfirmSignupForm({ tokenHash }: { tokenHash?: string }) {
  const [state, formAction, pending] = useActionState(
    confirmSignup,
    initialAuthState,
  );
  const hasToken = Boolean(tokenHash);

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <p className="text-sm font-semibold text-[#1473e6]">One last step</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-[#202124]">
          Confirm your account
        </h1>
        <p className="mt-3 leading-7 text-[#74777f]">
          Confirm only if you requested this FriendCircle account.
        </p>
      </div>

      {hasToken ? (
        <form action={formAction} className="space-y-5">
          <input name="tokenHash" type="hidden" value={tokenHash} />

          {state.message && (
            <div
              className="rounded-2xl border border-[#f1c5bf] bg-[#fff3f1] px-4 py-3 text-sm leading-6 text-[#9e342a]"
              role="alert"
            >
              {state.message}
            </div>
          )}

          <button className="button button-primary h-13 w-full" disabled={pending} type="submit">
            {pending ? (
              <>
                <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
                Confirming
              </>
            ) : (
              <>
                <CheckCircle2 size={18} aria-hidden="true" />
                Confirm and continue
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-[#f1c5bf] bg-[#fff3f1] px-4 py-3 text-sm leading-6 text-[#9e342a]">
          This confirmation link is incomplete. Request a fresh email below.
        </div>
      )}

      <p className="mt-7 text-center text-sm text-[#777a82]">
        Link expired?{" "}
        <Link
          className="font-semibold text-[#202124] underline decoration-[#b8bac0] underline-offset-4"
          href="/resend-confirmation"
        >
          Request another
        </Link>
      </p>
    </div>
  );
}
