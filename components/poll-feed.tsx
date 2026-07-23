"use client";

import {
  BadgeCheck,
  CalendarClock,
  CircleStop,
  ListChecks,
  LoaderCircle,
  Radio,
  UserRound,
} from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  castVote,
  closePoll,
  type PollActionState,
} from "@/lib/polls/actions";
import { createClient } from "@/lib/supabase/client";

type FeedPoll = {
  allows_multiple: boolean;
  created_by: string;
  expires_at: string | null;
  id: string;
  is_open: boolean;
  question: string;
  status: "closed" | "open";
};

type FeedOption = {
  id: string;
  label: string;
  poll_id: string;
  position: number;
};

type FeedVote = {
  created_at: string;
  id: string;
  poll_id: string;
  poll_option_id: string;
  voter_id: string;
};

const initialState: PollActionState = {};

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(timestamp));
}

function ActionMessage({ state }: { state: PollActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={`mt-3 rounded-xl px-3 py-2 text-sm ${
        state.status === "success"
          ? "bg-[#eefaf1] text-[#27663a]"
          : "bg-[#fff3f1] text-[#9e342a]"
      }`}
      role="status"
    >
      {state.message}
    </p>
  );
}

function InlinePollCard({
  closedByRealtime,
  options,
  poll,
  profileNames,
  viewerId,
  votes,
}: {
  closedByRealtime: boolean;
  options: FeedOption[];
  poll: FeedPoll;
  profileNames: Record<string, string>;
  viewerId: string;
  votes: FeedVote[];
}) {
  const [voteState, voteAction, voting] = useActionState(castVote, initialState);
  const [closeState, closeAction, closing] = useActionState(closePoll, initialState);
  const [selected, setSelected] = useState<string[]>([]);
  const [expired, setExpired] = useState(!poll.is_open && poll.status === "open");

  useEffect(() => {
    const updateExpiry = () => {
      setExpired(Boolean(poll.expires_at && new Date(poll.expires_at).getTime() <= Date.now()));
    };
    const timer = window.setInterval(updateExpiry, 1000);
    return () => window.clearInterval(timer);
  }, [poll.expires_at]);

  const closed = poll.status === "closed" || closedByRealtime || expired;
  const viewerVotes = votes.filter(({ voter_id }) => voter_id === viewerId);
  const hasVoted = viewerVotes.length > 0;
  const voterCount = new Set(votes.map(({ voter_id }) => voter_id)).size;

  function toggleOption(optionId: string) {
    if (poll.allows_multiple) {
      setSelected((current) =>
        current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId],
      );
    } else {
      setSelected([optionId]);
    }
  }

  return (
    <article className="rounded-[1.7rem] border border-black/7 bg-white p-5 shadow-[0_9px_30px_rgba(34,37,43,0.035)] sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${closed ? "bg-[#f1f2f3] text-[#70737a]" : "bg-[#eaf8ee] text-[#2f7042]"}`}>
          {closed ? "Closed" : "Vote now"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4dc] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#92600f]">
          {poll.allows_multiple ? <ListChecks size={12} aria-hidden="true" /> : <Radio size={12} aria-hidden="true" />}
          {poll.allows_multiple ? "Choose one or more" : "Choose one"}
        </span>
        {hasVoted && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#edf5ff] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#1767bf]">
            <BadgeCheck size={11} aria-hidden="true" /> You voted
          </span>
        )}
      </div>

      <h2 className="mt-4 text-xl font-semibold tracking-[-0.035em] sm:text-2xl">{poll.question}</h2>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#858890]">
        <span className="inline-flex items-center gap-1.5"><UserRound size={13} aria-hidden="true" /> By {poll.created_by === viewerId ? "you" : profileNames[poll.created_by] ?? "Circle member"}</span>
        {poll.expires_at && (
          <span className="inline-flex items-center gap-1.5"><CalendarClock size={13} aria-hidden="true" /> {expired ? "Expired" : "Closes"} {formatTimestamp(poll.expires_at)}</span>
        )}
      </div>

      {!closed && !hasVoted && (
        <form action={voteAction} className="mt-5" noValidate>
          <input name="pollId" type="hidden" value={poll.id} />
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((option) => (
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors ${selected.includes(option.id) ? "border-[#e8b654] bg-[#fffaf0]" : "border-[#e3e4e7] hover:border-[#cfd1d6]"}`}
                key={option.id}
              >
                <input
                  checked={selected.includes(option.id)}
                  className="accent-[#d58e1d]"
                  name="optionIds"
                  onChange={() => toggleOption(option.id)}
                  type={poll.allows_multiple ? "checkbox" : "radio"}
                  value={option.id}
                />
                <span className="font-medium">{option.label}</span>
              </label>
            ))}
          </div>
          {voteState.errors?.optionIds?.[0] && (
            <p className="mt-2 text-sm text-[#c43f32]" role="alert">{voteState.errors.optionIds[0]}</p>
          )}
          <button className="button button-primary mt-4 w-full sm:w-auto" disabled={voting || selected.length === 0} type="submit">
            {voting ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <BadgeCheck size={17} aria-hidden="true" />}
            {voting ? "Recording vote" : "Submit vote"}
          </button>
          <ActionMessage state={voteState} />
        </form>
      )}

      {(hasVoted || closed) && (
        <div className="mt-5 grid gap-3">
          {options.map((option) => {
            const optionVotes = votes.filter(({ poll_option_id }) => poll_option_id === option.id);
            const percentage = voterCount > 0 ? Math.round((optionVotes.length / voterCount) * 100) : 0;
            const selectedByViewer = viewerVotes.some(({ poll_option_id }) => poll_option_id === option.id);
            return (
              <div className="rounded-2xl bg-[#f7f7f8] p-3.5" key={option.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold">
                    <span className="truncate">{option.label}</span>
                    {selectedByViewer && <BadgeCheck className="shrink-0 text-[#1473e6]" size={14} aria-label="Your selection" />}
                  </span>
                  <span className="shrink-0">{percentage}% · {optionVotes.length}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e4e5e8]">
                  <div className="h-full rounded-full bg-[#f0a938] transition-[width] duration-500" style={{ width: `${percentage}%` }} />
                </div>
                {optionVotes.length > 0 && (
                  <p className="mt-2 truncate text-xs text-[#92959d]">
                    {optionVotes.map(({ voter_id }) => profileNames[voter_id] ?? "Circle member").join(", ")}
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-xs text-[#858890]">{voterCount} voter{voterCount === 1 ? "" : "s"} · results update live</p>
        </div>
      )}

      {closed && !hasVoted && (
        <p className="mt-4 rounded-xl bg-[#f1f2f3] px-3 py-2 text-sm text-[#74777f]">Voting has ended for this poll.</p>
      )}

      {poll.created_by === viewerId && !closed && (
        <div className="mt-5 border-t border-[#ececef] pt-4">
          <form action={closeAction}>
            <input name="pollId" type="hidden" value={poll.id} />
            <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#777a82] hover:text-[#b74436]" disabled={closing} type="submit">
              {closing ? <LoaderCircle className="animate-spin" size={15} aria-hidden="true" /> : <CircleStop size={15} aria-hidden="true" />}
              {closing ? "Closing poll" : "Close poll"}
            </button>
          </form>
          <ActionMessage state={closeState} />
        </div>
      )}
    </article>
  );
}

export function PollFeed({
  initialVotes,
  options,
  polls,
  profileNames,
  viewerId,
}: {
  initialVotes: FeedVote[];
  options: FeedOption[];
  polls: FeedPoll[];
  profileNames: Record<string, string>;
  viewerId: string;
}) {
  const router = useRouter();
  const [realtimeVotes, setRealtimeVotes] = useState<FeedVote[]>([]);
  const [closedPollIds, setClosedPollIds] = useState<string[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("poll-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "poll_votes" },
        (payload) => {
          const vote = payload.new as FeedVote;
          setRealtimeVotes((current) =>
            current.some(({ id }) => id === vote.id) ? current : [...current, vote],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "polls" },
        (payload) => {
          const poll = payload.new as { id?: string; status?: string };
          if (poll.id && poll.status === "closed") {
            setClosedPollIds((current) => current.includes(poll.id!) ? current : [...current, poll.id!]);
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setLive(true);
          router.refresh();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const votes = useMemo(() => {
    const merged = new Map(initialVotes.map((vote) => [vote.id, vote]));
    realtimeVotes.forEach((vote) => merged.set(vote.id, vote));
    return [...merged.values()];
  }, [initialVotes, realtimeVotes]);

  return (
    <section className="mt-9" aria-label="Polls">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-[#858890]">Choose and vote without leaving this page.</p>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${live ? "bg-[#eaf8ee] text-[#2f7042]" : "bg-[#f1f2f3] text-[#777a82]"}`}>
          <span className={`h-2 w-2 rounded-full ${live ? "bg-[#42a768]" : "bg-[#a5a7ad]"}`} />
          {live ? "Live" : "Connecting"}
        </span>
      </div>
      <div className="grid gap-4">
        {polls.map((poll) => (
          <InlinePollCard
            closedByRealtime={closedPollIds.includes(poll.id)}
            key={poll.id}
            options={options.filter(({ poll_id }) => poll_id === poll.id)}
            poll={poll}
            profileNames={profileNames}
            viewerId={viewerId}
            votes={votes.filter(({ poll_id }) => poll_id === poll.id)}
          />
        ))}
      </div>
    </section>
  );
}
