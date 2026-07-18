"use server";

import { revalidatePath } from "next/cache";

import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { accountSchema } from "./schemas";

const avatarTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const maxAvatarBytes = 2 * 1024 * 1024;

export type AccountState = {
  errors?: Record<string, string[]>;
  message?: string;
  status?: "error" | "success";
};

export async function updateAccount(
  _previousState: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const result = accountSchema.safeParse({
    fullName: formData.get("fullName"),
  });

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
      status: "error",
    };
  }

  const viewer = await requireViewer();
  const supabase = await createClient();
  const avatar = formData.get("avatar");
  const avatarFile = avatar instanceof File && avatar.size > 0 ? avatar : null;
  const removeAvatar = formData.get("removeAvatar") === "on";

  if (avatarFile && removeAvatar) {
    return {
      errors: { avatar: ["Choose a new avatar or remove the current one, not both."] },
      status: "error",
    };
  }

  if (avatarFile && !avatarTypes.has(avatarFile.type)) {
    return {
      errors: { avatar: ["Choose a JPG, PNG, or WebP image."] },
      status: "error",
    };
  }

  if (avatarFile && avatarFile.size > maxAvatarBytes) {
    return {
      errors: { avatar: ["Avatar images must be 2 MB or smaller."] },
      status: "error",
    };
  }

  const { data: currentProfile, error: profileError } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", viewer.id)
    .single();

  if (profileError) {
    return {
      message: "Your profile could not be loaded. Please try again.",
      status: "error",
    };
  }

  let nextAvatarPath = removeAvatar ? null : currentProfile.avatar_path;
  let uploadedAvatarPath: string | null = null;

  if (avatarFile) {
    const extension = avatarTypes.get(avatarFile.type)!;
    uploadedAvatarPath = `${viewer.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(uploadedAvatarPath, avatarFile, {
        cacheControl: "3600",
        contentType: avatarFile.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        message: "The avatar could not be uploaded. Please try another image.",
        status: "error",
      };
    }

    nextAvatarPath = uploadedAvatarPath;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      avatar_path: nextAvatarPath,
      full_name: result.data.fullName,
    })
    .eq("id", viewer.id);

  if (updateError) {
    if (uploadedAvatarPath) {
      await supabase.storage.from("avatars").remove([uploadedAvatarPath]);
    }

    return {
      message: "Your account changes could not be saved. Please try again.",
      status: "error",
    };
  }

  if (
    currentProfile.avatar_path &&
    currentProfile.avatar_path !== nextAvatarPath
  ) {
    await supabase.storage
      .from("avatars")
      .remove([currentProfile.avatar_path]);
  }

  revalidatePath("/account");
  revalidatePath("/dashboard");

  return {
    message: "Your account has been updated.",
    status: "success",
  };
}
