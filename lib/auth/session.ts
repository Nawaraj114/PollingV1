import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  email: string;
  fullName: string;
  id: string;
};

function claimString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", claims.sub)
    .maybeSingle();

  const metadata =
    claims.user_metadata && typeof claims.user_metadata === "object"
      ? (claims.user_metadata as Record<string, unknown>)
      : {};
  const email = claimString(claims.email) ?? "Member";

  return {
    email,
    fullName:
      profile?.full_name ??
      claimString(metadata.full_name) ??
      email.split("@")[0] ??
      "Friend",
    id: claims.sub,
  };
});

export async function requireViewer() {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/login");
  }

  return viewer;
}
