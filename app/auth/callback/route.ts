import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(safeNextPath(url.searchParams.get("next")), url.origin));
    }

    console.error("Supabase confirmation exchange failed", {
      code: error.code,
      status: error.status,
    });
  }

  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set("error", "Your confirmation link is invalid or expired.");
  return NextResponse.redirect(loginUrl);
}
