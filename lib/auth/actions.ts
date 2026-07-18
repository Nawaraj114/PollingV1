"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  confirmSignupSchema,
  loginSchema,
  resendConfirmationSchema,
  signupSchema,
} from "./schemas";

export type AuthState = {
  errors?: Record<string, string[]>;
  message?: string;
  status?: "error" | "success";
};

function safeNextPath(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

async function confirmationRedirectUrl() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");

  return origin ? `${origin}/confirm-signup` : undefined;
}

export async function login(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
      status: "error",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  });

  if (error) {
    return {
      message: "Email or password is incorrect.",
      status: "error",
    };
  }

  redirect(safeNextPath(result.data.next));
}

export async function signup(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const result = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
      status: "error",
    };
  }

  const emailRedirectTo = await confirmationRedirectUrl();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
    options: {
      data: { full_name: result.data.fullName },
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
  });

  if (error) {
    return {
      message:
        error.status === 429
          ? "Too many attempts. Wait a moment and try again."
          : error.message,
      status: "error",
    };
  }

  if (data.session) {
    redirect("/dashboard");
  }

  return {
    message: "Check your email to confirm your account. The link is valid for one hour.",
    status: "success",
  };
}

export async function resendConfirmation(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const result = resendConfirmationSchema.safeParse({
    email: formData.get("email"),
  });

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
      status: "error",
    };
  }

  const emailRedirectTo = await confirmationRedirectUrl();
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: result.data.email,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });

  if (error) {
    return {
      message:
        error.status === 429
          ? "The email limit was reached. Wait at least one minute—and up to one hour on the test mail service—then try again."
          : "A new confirmation email could not be sent. Check the address and try again.",
      status: "error",
    };
  }

  return {
    message: "A fresh confirmation email was requested. Check your inbox and spam folder.",
    status: "success",
  };
}

export async function confirmSignup(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const result = confirmSignupSchema.safeParse({
    tokenHash: formData.get("tokenHash"),
  });

  if (!result.success) {
    return {
      message: "This confirmation link is incomplete or invalid.",
      status: "error",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: result.data.tokenHash,
    type: "signup",
  });

  if (error) {
    return {
      message: "This confirmation link is invalid or expired. Request a fresh email below.",
      status: "error",
    };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
