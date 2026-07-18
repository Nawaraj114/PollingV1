import { ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";

import { AccountForm } from "@/components/account-form";
import { MemberAvatar } from "@/components/member-avatar";
import { PasskeyManager } from "@/components/passkey-manager";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("avatar_path, full_name, id")
    .order("full_name");
  const { data: passkeys } = await supabase
    .from("webauthn_credentials")
    .select("backed_up, created_at, device_label, id, last_used_at, rp_id")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false });
  const paths = (profiles ?? [])
    .map((profile) => profile.avatar_path)
    .filter((path): path is string => Boolean(path));
  const { data: signedAvatars } = paths.length
    ? await supabase.storage.from("avatars").createSignedUrls(paths, 60 * 60)
    : { data: [] };
  const avatarUrls = new Map(
    (signedAvatars ?? []).map((avatar) => [avatar.path, avatar.signedUrl]),
  );
  const members = (profiles ?? []).map((profile) => ({
    ...profile,
    avatarUrl: profile.avatar_path
      ? (avatarUrls.get(profile.avatar_path) ?? null)
      : null,
  }));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">
            <ShieldCheck size={14} className="text-[#1473e6]" aria-hidden="true" />
            Private member profile
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            Your account
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-[#74777f]">
            Keep the name and photo your friends will recognize in bills and polls.
          </p>
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="rounded-[1.7rem] border border-black/7 bg-white p-6 shadow-[0_10px_35px_rgba(34,37,43,0.04)] sm:p-8">
          <h2 className="text-xl font-semibold tracking-[-0.03em]">Profile details</h2>
          <p className="mt-2 text-sm leading-6 text-[#7a7d85]">
            Only you can change these profile fields.
          </p>
          <div className="mt-7">
            <AccountForm
              avatarUrl={viewer.avatarUrl}
              email={viewer.email}
              fullName={viewer.fullName}
            />
          </div>
        </section>

        <section className="rounded-[1.7rem] border border-black/7 bg-white p-6 shadow-[0_10px_35px_rgba(34,37,43,0.04)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em]">Circle members</h2>
              <p className="mt-2 text-sm leading-6 text-[#7a7d85]">
                Every signed-in member can see this directory.
              </p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#edf5ff] text-[#1473e6]">
              <Users size={20} aria-hidden="true" />
            </span>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-[#f1c5bf] bg-[#fff3f1] px-4 py-3 text-sm leading-6 text-[#9e342a]">
              The member directory could not be loaded.
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-black/6">
              {members.map((member) => (
                <li className="flex items-center gap-3 py-3.5" key={member.id}>
                  <MemberAvatar
                    avatarUrl={member.avatarUrl}
                    name={member.full_name}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#303238]">
                      {member.full_name}
                    </p>
                    <p className="text-xs text-[#92959d]">
                      {member.id === viewer.id ? "You" : "Circle member"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <PasskeyManager passkeys={passkeys ?? []} />
    </main>
  );
}
