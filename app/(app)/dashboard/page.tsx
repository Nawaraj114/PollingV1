import {
  ArrowUpRight,
  Check,
  ReceiptText,
  Sparkles,
  Vote,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home" };

const modules = [
  {
    accent: "bg-[#1473e6]",
    description: "Create transparent splits and follow every confirmation.",
    href: "/bills",
    icon: ReceiptText,
    label: "Billing",
    phase: "Phases 2–4",
  },
  {
    accent: "bg-[#f0a938]",
    description: "Make the next group decision without another long thread.",
    href: "/polls",
    icon: Vote,
    label: "Polling",
    phase: "Phase 5",
  },
];

function Initials({ name, index }: { index: number; name: string }) {
  const colors = ["#1473e6", "#e56b4a", "#625cb5", "#26856d", "#ba6c29"];
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className="grid h-9 w-9 place-items-center rounded-full border-2 border-white text-[10px] font-bold text-white"
      style={{ backgroundColor: colors[index % colors.length] }}
      title={name}
    >
      {initials}
    </span>
  );
}

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("created_at", { ascending: true });

  const firstName = viewer.fullName.split(/\s+/)[0];
  const members = profiles ?? [];

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">
            <Sparkles size={14} className="text-[#1473e6]" aria-hidden="true" />
            Foundation is ready
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            Good to see you, {firstName}.
          </h1>
          <p className="mt-3 max-w-xl text-lg leading-8 text-[#74777f]">
            Your circle has a home. Each module will come alive as we move through the build phases.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-black/7 bg-white px-4 py-3">
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((member, index) => (
              <Initials index={index} key={member.id} name={member.full_name} />
            ))}
            {!members.length && <Initials index={0} name={viewer.fullName} />}
          </div>
          <div>
            <p className="text-sm font-semibold">{members.length || 1} member{members.length === 1 ? "" : "s"}</p>
            <p className="text-xs text-[#92959d]">in your circle</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-8 rounded-2xl border border-[#efc7bd] bg-[#fff4f1] px-5 py-4 text-sm leading-6 text-[#8d3e31]">
          The app is connected, but the profiles migration has not reached this Supabase project yet. Apply the Phase 0 migration before account testing.
        </div>
      )}

      <section className="mt-10 grid gap-5 lg:grid-cols-2" aria-label="FriendCircle modules">
        {modules.map(({ accent, description, href, icon: Icon, label, phase }) => (
          <Link
            className="group rounded-[1.7rem] border border-black/7 bg-white p-6 shadow-[0_10px_35px_rgba(34,37,43,0.04)] hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(34,37,43,0.09)]"
            href={href}
            key={label}
          >
            <div className="flex items-start justify-between">
              <span className={`grid h-12 w-12 place-items-center rounded-2xl text-white ${accent}`}>
                <Icon size={22} aria-hidden="true" />
              </span>
              <ArrowUpRight className="text-[#a3a5ab] group-hover:text-[#202124]" size={20} aria-hidden="true" />
            </div>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.13em] text-[#9a9da4]">{phase}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{label}</h2>
            <p className="mt-3 leading-7 text-[#74777f]">{description}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-[1.7rem] bg-[#202124] p-6 text-white sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Build progress</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Phase 0 · Foundation</h2>
            </div>
            <span className="rounded-full bg-[#163d68] px-3 py-1.5 text-xs font-semibold text-[#75baff]">Ready to test</span>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {["Next.js app shell", "Supabase authentication", "Profile creation trigger"].map((item) => (
              <div className="flex items-center gap-2 rounded-2xl border border-white/9 bg-white/5 px-4 py-3 text-sm" key={item}>
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#1473e6]">
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.7rem] border border-black/7 bg-white p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a9da4]">Signed in as</p>
          <p className="mt-3 truncate text-xl font-semibold tracking-[-0.03em]">{viewer.fullName}</p>
          <p className="mt-1 truncate text-sm text-[#81848c]">{viewer.email}</p>
          <div className="mt-6 flex items-center gap-2 text-sm font-medium text-[#34704a]">
            <span className="h-2 w-2 rounded-full bg-[#42a768]" />
            Supabase session active
          </div>
        </article>
      </section>
    </main>
  );
}
