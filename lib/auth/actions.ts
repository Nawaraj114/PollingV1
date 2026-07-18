"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loginSchema, signupSchema } from "./schemas";

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

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
    options: {
      data: { full_name: result.data.fullName },
      ...(origin ? { emailRedirectTo: `${origin}/auth/callback` } : {}),
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
    message: "Check your email to confirm your account, then come back to sign in.",
    status: "success",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
