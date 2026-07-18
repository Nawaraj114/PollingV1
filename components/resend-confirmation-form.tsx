"use client";

import { CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import {
  resendConfirmation,
  type AuthState,
} from "@/lib/auth/actions";

const initialAuthState: AuthState = {};

export function ResendConfirmationForm() {
  const [state, formAction, pending] = useActionState(
    resendConfirmation,
    initialAuthState,
  );

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <p className="text-sm font-semibold text-[#1473e6]">Email confirmation</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-[#202124]">
          Request a fresh link
        </h1>
        <p className="mt-3 leading-7 text-[#74777f]">
          Use the same email address you entered when creating your account.
        </p>
      </div>

      <form action={formAction} className="space-y-5" noValidate>
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#3d3f44]" htmlFor="email">
            Email address
          </label>
          <input
            autoComplete="email"
            className="field"
            id="email"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
          {state.errors?.email?.[0] && (
            <p className="mt-1.5 text-sm text-[#c43f32]" role="alert">
              {state.errors.email[0]}
            </p>
          )}
        </div>

        {state.message && (
          <div
            className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-6 ${
              state.status === "success"
                ? "border-[#b9dfc5] bg-[#eefaf1] text-[#27663a]"
                : "border-[#f1c5bf] bg-[#fff3f1] text-[#9e342a]"
            }`}
            role="status"
          >
            {state.status === "success" && (
              <CheckCircle2 className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
            )}
            <span>{state.message}</span>
          </div>
        )}

        <button className="button button-primary h-13 w-full" disabled={pending} type="submit">
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
              Sending
            </>
          ) : (
            <>
              <Mail size={18} aria-hidden="true" />
              Send confirmation email
            </>
          )}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-[#777a82]">
        <Link
          className="font-semibold text-[#202124] underline decoration-[#b8bac0] underline-offset-4"
          href="/login"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
