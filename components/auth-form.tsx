"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import {
  login,
  type AuthState,
} from "@/lib/auth/actions";

const initialAuthState: AuthState = {};

type AuthFormProps = {
  errorMessage?: string;
  nextPath?: string;
};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;

  return (
    <p className="mt-1.5 text-sm text-[#c43f32]" role="alert">
      {errors[0]}
    </p>
  );
}

export function AuthForm({ errorMessage, nextPath }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(login, initialAuthState);

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <p className="text-sm font-semibold text-[#1473e6]">Welcome back</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-[#202124]">
          Sign in to FriendCircle
        </h1>
        <p className="mt-3 leading-7 text-[#74777f]">
          Pick up where your group left off.
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
          <FieldError errors={state.errors?.email} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-[#3d3f44]" htmlFor="password">
              Password
            </label>
          </div>
          <input
            autoComplete="current-password"
            className="field"
            id="password"
            minLength={8}
            name="password"
            placeholder="••••••••"
            required
            type="password"
          />
          <FieldError errors={state.errors?.password} />
        </div>

        {nextPath && <input name="next" type="hidden" value={nextPath} />}

        {(state.message || errorMessage) && (
          <div
            className="flex items-start gap-2.5 rounded-2xl border border-[#f1c5bf] bg-[#fff3f1] px-4 py-3 text-sm leading-6 text-[#9e342a]"
            role="status"
          >
            <span>{state.message ?? errorMessage}</span>
          </div>
        )}

        <button className="button button-primary h-13 w-full" disabled={pending} type="submit">
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
              Please wait
            </>
          ) : (
            <>
              Sign in
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[#777a82]">
        Confirmation link expired?{" "}
        <Link
          className="font-semibold text-[#202124] underline decoration-[#b8bac0] underline-offset-4"
          href="/resend-confirmation"
        >
          Send a new one
        </Link>
      </p>

      <p className="mt-7 text-center text-sm text-[#777a82]">
        Need access?{" "}
        <Link className="font-semibold text-[#202124] underline decoration-[#b8bac0] underline-offset-4" href="/signup">
          See how invitations work
        </Link>
      </p>
    </div>
  );
}
