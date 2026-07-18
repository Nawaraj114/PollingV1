"use client";

import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import {
  login,
  signup,
  type AuthState,
} from "@/lib/auth/actions";

const initialAuthState: AuthState = {};

type AuthFormProps = {
  errorMessage?: string;
  mode: "login" | "signup";
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

export function AuthForm({ errorMessage, mode, nextPath }: AuthFormProps) {
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState(action, initialAuthState);
  const isLogin = mode === "login";

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <p className="text-sm font-semibold text-[#1473e6]">
          {isLogin ? "Welcome back" : "Your circle is waiting"}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-[#202124]">
          {isLogin ? "Sign in to FriendCircle" : "Create your account"}
        </h1>
        <p className="mt-3 leading-7 text-[#74777f]">
          {isLogin
            ? "Pick up where your group left off."
            : "Use the email address your friends will recognize."}
        </p>
      </div>

      <form action={formAction} className="space-y-5" noValidate>
        {!isLogin && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#3d3f44]" htmlFor="fullName">
              Full name
            </label>
            <input
              autoComplete="name"
              className="field"
              id="fullName"
              name="fullName"
              placeholder="Nawaraj Poudel"
              required
            />
            <FieldError errors={state.errors?.fullName} />
          </div>
        )}

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
            {!isLogin && <span className="text-xs text-[#92959d]">8 characters minimum</span>}
          </div>
          <input
            autoComplete={isLogin ? "current-password" : "new-password"}
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

        {isLogin && nextPath && <input name="next" type="hidden" value={nextPath} />}

        {(state.message || errorMessage) && (
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
            <span>{state.message ?? errorMessage}</span>
          </div>
        )}

        {state.status === "success" && !isLogin && (
          <p className="text-center text-sm text-[#777a82]">
            No email yet?{" "}
            <Link
              className="font-semibold text-[#202124] underline decoration-[#b8bac0] underline-offset-4"
              href="/resend-confirmation"
            >
              Request a new one
            </Link>
          </p>
        )}

        <button className="button button-primary h-13 w-full" disabled={pending} type="submit">
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
              Please wait
            </>
          ) : (
            <>
              {isLogin ? "Sign in" : "Create account"}
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      {isLogin && (
        <p className="mt-5 text-center text-sm text-[#777a82]">
          Confirmation link expired?{" "}
          <Link
            className="font-semibold text-[#202124] underline decoration-[#b8bac0] underline-offset-4"
            href="/resend-confirmation"
          >
            Send a new one
          </Link>
        </p>
      )}

      <p className="mt-7 text-center text-sm text-[#777a82]">
        {isLogin ? "New to the circle?" : "Already have an account?"}{" "}
        <Link className="font-semibold text-[#202124] underline decoration-[#b8bac0] underline-offset-4" href={isLogin ? "/signup" : "/login"}>
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}
