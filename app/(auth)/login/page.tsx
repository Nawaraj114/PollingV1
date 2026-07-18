import type { Metadata } from "next";

import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : undefined;
  const errorMessage = typeof params.error === "string" ? params.error : undefined;

  return <AuthForm errorMessage={errorMessage} mode="login" nextPath={nextPath} />;
}
