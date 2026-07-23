"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type PasskeyActionState = {
  message?: string;
  status?: "error" | "success";
};

const removePasskeySchema = z.object({
  credentialId: z.string().uuid(),
});

export async function removePasskey(
  _previousState: PasskeyActionState,
  formData: FormData,
): Promise<PasskeyActionState> {
  const parsed = removePasskeySchema.safeParse({
    credentialId: formData.get("credentialId"),
  });
  if (!parsed.success) return { message: "The passkey reference is invalid.", status: "error" };

  const viewer = await requireViewer();
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("webauthn_credentials")
    .delete({ count: "exact" })
    .eq("id", parsed.data.credentialId)
    .eq("user_id", viewer.id);

  if (error || count !== 1) {
    return { message: "The passkey could not be removed.", status: "error" };
  }

  revalidatePath("/account");
  return { message: "Passkey removed from FriendCircle.", status: "success" };
}
