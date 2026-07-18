import { ArrowLeft, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CreateBillForm } from "@/components/create-bill-form";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create Bill" };

function todayInNepal() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Kathmandu",
    year: "numeric",
  }).format(new Date());
}

export default async function NewBillPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const [{ data: categories }, { data: profiles }] = await Promise.all([
    supabase.from("bill_categories").select("id, name").order("name"),
    supabase
      .from("profiles")
      .select("avatar_path, full_name, id")
      .neq("id", viewer.id)
      .order("full_name"),
  ]);

  const members = await Promise.all(
    (profiles ?? []).map(async (profile) => {
      const { data } = profile.avatar_path
        ? await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 60 * 60)
        : { data: null };

      return {
        avatarUrl: data?.signedUrl ?? null,
        fullName: profile.full_name,
        id: profile.id,
      };
    }),
  );

  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-8 sm:py-12">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#6f727a] hover:text-[#202124]" href="/bills">
        <ArrowLeft size={16} aria-hidden="true" /> Back to bills
      </Link>
      <div className="mt-6 flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#202124] text-white">
          <ReceiptText size={22} aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#1473e6]">Phase 2 · Billing core</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Create a trusted split</h1>
          <p className="mt-2 leading-7 text-[#74777f]">Record what you paid and assign the full total across your friends.</p>
        </div>
      </div>

      <div className="mt-8">
        <CreateBillForm
          categories={categories ?? []}
          defaultDate={todayInNepal()}
          members={members}
        />
      </div>
    </main>
  );
}

