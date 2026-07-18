import {
  ArrowLeft,
  CalendarClock,
  ListChecks,
  Radio,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PollVotingPanel } from "@/components/poll-voting-panel";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Poll Details" };

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(timestamp));
}

export default async function PollDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: poll, error } = await supabase
    .from("poll_overview")
    .select("allows_multiple, closed_at, created_at, created_by, expires_at, id, is_open, question, status")
    .eq("id", id)
    .maybeSingle();

  if (error || !poll) notFound();

  const [{ data: options }, { data: votes }, { data: profiles }] = await Promise.all([
    supabase
      .from("poll_options")
      .select("id, label, position")
      .eq("poll_id", poll.id)
      .order("position"),
    supabase
      .from("poll_votes")
      .select("created_at, id, poll_option_id, voter_id")
      .eq("poll_id", poll.id)
      .order("created_at"),
    supabase.from("profiles").select("full_name, id"),
  ]);
  const profileNames = Object.fromEntries(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name]),
  );
  const expired = poll.status === "open" && !poll.is_open;
  const closed = !poll.is_open;

  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-8 sm:py-12">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#6f727a] hover:text-[#202124]" href="/polls">
        <ArrowLeft size={16} aria-hidden="true" /> Back to polls
      </Link>

      <section className="mt-6 overflow-hidden rounded-[2rem] bg-[#202124] text-white shadow-[0_24px_70px_rgba(25,27,31,0.18)]">
        <div className="p-6 sm:p-9">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${closed ? "bg-white/10 text-white/65" : "bg-[#395c2f] text-[#b9efab]"}`}>
              {closed ? "Closed" : "Open for voting"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6a4a13] px-3 py-1.5 text-xs font-semibold text-[#ffd78e]">
              {poll.allows_multiple ? <ListChecks size={13} aria-hidden="true" /> : <Radio size={13} aria-hidden="true" />}
              {poll.allows_multiple ? "Multiple choice" : "Single choice"}
            </span>
          </div>
          <h1 className="mt-6 max-w-3xl text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">{poll.question}</h1>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/55">
            <span className="inline-flex items-center gap-1.5"><UserRound size={15} aria-hidden="true" /> Created by {poll.created_by === viewer.id ? "you" : profileNames[poll.created_by] ?? "Circle member"}</span>
            {poll.expires_at && (
              <span className="inline-flex items-center gap-1.5"><CalendarClock size={15} aria-hidden="true" /> {expired ? "Expired" : "Closes"} {formatTimestamp(poll.expires_at)}</span>
            )}
          </div>
        </div>
      </section>

      <PollVotingPanel
        allowsMultiple={poll.allows_multiple}
        createdBy={poll.created_by}
        expiresAt={poll.expires_at}
        initialStatus={poll.status}
        initialIsOpen={poll.is_open}
        initialVotes={votes ?? []}
        options={options ?? []}
        pollId={poll.id}
        profileNames={profileNames}
        viewerId={viewer.id}
      />
    </main>
  );
}
