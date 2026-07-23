import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  avatarUrl: string | null;
  email: string;
  fullName: string;
  id: string;
};

function claimString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

const getClaims = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return error ? null : (data?.claims ?? null);
});

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const claims = await getClaims();

  if (!claims?.sub) {
    return null;
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path, full_name")
    .eq("id", claims.sub)
    .maybeSingle();

  const metadata =
    claims.user_metadata && typeof claims.user_metadata === "object"
      ? (claims.user_metadata as Record<string, unknown>)
      : {};
  const email = claimString(claims.email) ?? "Member";
  const { data: avatar } = profile?.avatar_path
    ? await supabase.storage
        .from("avatars")
        .createSignedUrl(profile.avatar_path, 60 * 60)
    : { data: null };

  return {
    avatarUrl: avatar?.signedUrl ?? null,
    email,
    fullName:
      profile?.full_name ??
      claimString(metadata.full_name) ??
      email.split("@")[0] ??
      "Friend",
    id: claims.sub,
  };
});

export const getViewerId = cache(async () => {
  const claims = await getClaims();
  return claims?.sub ?? null;
});

export async function requireViewer() {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/login");
  }

  return viewer;
}

export async function requireViewerId() {
  const viewerId = await getViewerId();

  if (!viewerId) {
    redirect("/login");
  }

  return viewerId;
}
