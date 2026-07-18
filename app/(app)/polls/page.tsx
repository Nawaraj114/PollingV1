import {
  ArrowRight,
  CalendarClock,
  CirclePlus,
  ListChecks,
  Radio,
  UserRound,
  Vote,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Polls" };

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(timestamp));
}

export default async function PollsPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: polls, error } = await supabase
    .from("poll_overview")
    .select("allows_multiple, created_at, created_by, expires_at, id, is_open, question, status")
    .order("created_at", { ascending: false });
  const pollIds = (polls ?? []).map(({ id }) => id);
  const [{ data: options }, { data: votes }, { data: profiles }] = await Promise.all([
    pollIds.length
      ? supabase
          .from("poll_options")
          .select("id, label, poll_id, position")
          .in("poll_id", pollIds)
          .order("position")
      : Promise.resolve({ data: [] }),
    pollIds.length
      ? supabase
          .from("poll_votes")
          .select("poll_id, poll_option_id, voter_id")
          .in("poll_id", pollIds)
      : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("full_name, id"),
  ]);
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">
            <Vote size={14} className="text-[#f0a938]" aria-hidden="true" />
            Live circle decisions
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Polls</h1>
          <p className="mt-3 max-w-xl text-lg leading-8 text-[#74777f]">
            Make a decision together and watch the result update as friends vote.
          </p>
        </div>
        <Link className="button button-primary h-12 px-5" href="/polls/new">
          <CirclePlus size={18} aria-hidden="true" /> Create poll
        </Link>
      </section>

      {error && (
        <div className="mt-8 rounded-2xl border border-[#f1c5bf] bg-[#fff3f1] px-5 py-4 text-sm text-[#9e342a]">
          Polls could not be loaded. Confirm that the Phase 5 migration has been applied.
        </div>
      )}

      {!error && !(polls ?? []).length && (
        <section className="mt-10 rounded-[2rem] border border-dashed border-[#cfd1d6] bg-white px-6 py-14 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#fff4dc] text-[#a66a10]">
            <Vote size={25} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em]">No polls yet</h2>
          <p className="mx-auto mt-2 max-w-md leading-7 text-[#7d8088]">
            Start with the next decision your group needs to make.
          </p>
          <Link className="button button-dark mt-6" href="/polls/new">Create the first poll</Link>
        </section>
      )}

      <section className="mt-9 grid gap-4" aria-label="Polls">
        {(polls ?? []).map((poll) => {
          const pollOptions = (options ?? []).filter(({ poll_id }) => poll_id === poll.id);
          const pollVotes = (votes ?? []).filter(({ poll_id }) => poll_id === poll.id);
          const voterCount = new Set(pollVotes.map(({ voter_id }) => voter_id)).size;
          const viewerVoted = pollVotes.some(({ voter_id }) => voter_id === viewer.id);
          const closed = !poll.is_open;
          const expired = poll.status === "open" && !poll.is_open;
          const leadingOption = pollOptions
            .map((option) => ({
              ...option,
              votes: pollVotes.filter(({ poll_option_id }) => poll_option_id === option.id).length,
            }))
            .sort((left, right) => right.votes - left.votes)[0];

          return (
            <Link
              className="group grid gap-5 rounded-[1.6rem] border border-black/7 bg-white p-5 shadow-[0_9px_30px_rgba(34,37,43,0.035)] hover:-translate-y-0.5 hover:shadow-[0_15px_38px_rgba(34,37,43,0.08)] sm:grid-cols-[1fr_auto] sm:items-center sm:p-6"
              href={`/polls/${poll.id}`}
              key={poll.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${closed ? "bg-[#f1f2f3] text-[#70737a]" : "bg-[#eaf8ee] text-[#2f7042]"}`}>
                    {closed ? "Closed" : "Open"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4dc] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#92600f]">
                    {poll.allows_multiple ? <ListChecks size={12} aria-hidden="true" /> : <Radio size={12} aria-hidden="true" />}
                    {poll.allows_multiple ? "Multiple choice" : "Single choice"}
                  </span>
                  {viewerVoted && (
                    <span className="rounded-full bg-[#edf5ff] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#1767bf]">You voted</span>
                  )}
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-[-0.035em]">{poll.question}</h2>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#81848c]">
                  <span className="inline-flex items-center gap-1.5"><UserRound size={14} aria-hidden="true" /> By {poll.created_by === viewer.id ? "you" : profileById.get(poll.created_by) ?? "Circle member"}</span>
                  {poll.expires_at && (
                    <span className="inline-flex items-center gap-1.5"><CalendarClock size={14} aria-hidden="true" /> {expired ? "Expired" : "Closes"} {formatTimestamp(poll.expires_at)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-5 sm:justify-end">
                <div className="text-left sm:text-right">
                  <p className="text-xs font-medium text-[#92959d]">{voterCount} voter{voterCount === 1 ? "" : "s"}</p>
                  <p className="mt-1 max-w-48 truncate text-sm font-semibold text-[#555861]">
                    {leadingOption && pollVotes.length > 0 ? `Leading: ${leadingOption.label}` : `${pollOptions.length} options`}
                  </p>
                </div>
                <ArrowRight className="text-[#a6a8ae] group-hover:translate-x-1 group-hover:text-[#202124]" size={19} aria-hidden="true" />
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
