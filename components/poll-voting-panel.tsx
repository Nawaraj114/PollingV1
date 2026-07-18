"use client";

import {
  BadgeCheck,
  CalendarClock,
  Check,
  CircleStop,
  LoaderCircle,
  UsersRound,
} from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";

import {
  castVote,
  closePoll,
  type PollActionState,
} from "@/lib/polls/actions";
import { createClient } from "@/lib/supabase/client";

type PollOption = {
  id: string;
  label: string;
  position: number;
};

type PollVote = {
  created_at: string;
  id: string;
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

export function PollVotingPanel({
  allowsMultiple,
  createdBy,
  expiresAt,
  initialStatus,
  initialVotes,
  options,
  pollId,
  profileNames,
  initialIsOpen,
  viewerId,
}: {
  allowsMultiple: boolean;
  createdBy: string;
  expiresAt: string | null;
  initialStatus: "closed" | "open";
  initialVotes: PollVote[];
  options: PollOption[];
  pollId: string;
  profileNames: Record<string, string>;
  initialIsOpen: boolean;
  viewerId: string;
}) {
  const [voteState, voteAction, voting] = useActionState(castVote, initialState);
  const [closeState, closeAction, closing] = useActionState(closePoll, initialState);
  const [realtimeVotes, setRealtimeVotes] = useState<PollVote[]>([]);
  const [realtimeClosed, setRealtimeClosed] = useState(false);
  const [expired, setExpired] = useState(!initialIsOpen && initialStatus === "open");
  const [selected, setSelected] = useState<string[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live">("connecting");

  useEffect(() => {
    const updateExpiry = () => {
      setExpired(Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now()));
    };
    const timer = window.setInterval(updateExpiry, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`poll-${pollId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `poll_id=eq.${pollId}`,
          schema: "public",
          table: "poll_votes",
        },
        (payload) => {
          const nextVote = payload.new as PollVote;
          setRealtimeVotes((current) =>
            current.some(({ id }) => id === nextVote.id)
              ? current
              : [...current, nextVote],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          filter: `id=eq.${pollId}`,
          schema: "public",
          table: "polls",
        },
        (payload) => {
          const nextPoll = payload.new as { status?: "closed" | "open" };
          if (nextPoll.status === "closed") setRealtimeClosed(true);
        },
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED") setRealtimeStatus("live");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pollId]);

  const votes = useMemo(() => {
    const merged = new Map(initialVotes.map((vote) => [vote.id, vote]));
    realtimeVotes.forEach((vote) => merged.set(vote.id, vote));
    return [...merged.values()];
  }, [initialVotes, realtimeVotes]);
  const closed = initialStatus === "closed" || realtimeClosed || expired;
  const viewerVotes = votes.filter(({ voter_id }) => voter_id === viewerId);
  const hasVoted = viewerVotes.length > 0;
  const voterCount = useMemo(
    () => new Set(votes.map(({ voter_id }) => voter_id)).size,
    [votes],
  );

  function toggleOption(optionId: string) {
    if (allowsMultiple) {
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
    <>
      <section className="mt-7 rounded-[1.7rem] border border-black/7 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#f0a938]">Live result</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
              {voterCount} voter{voterCount === 1 ? "" : "s"}
            </h2>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${realtimeStatus === "live" ? "bg-[#eaf8ee] text-[#2f7042]" : "bg-[#f1f2f3] text-[#777a82]"}`}>
            <span className={`h-2 w-2 rounded-full ${realtimeStatus === "live" ? "bg-[#42a768]" : "bg-[#a5a7ad]"}`} />
            {realtimeStatus === "live" ? "Live updates" : "Connecting"}
          </span>
        </div>

        <div className="mt-6 grid gap-4">
          {options.map((option) => {
            const optionVotes = votes.filter(({ poll_option_id }) => poll_option_id === option.id);
            const percentage = voterCount > 0
              ? Math.round((optionVotes.length / voterCount) * 100)
              : 0;
            const selectedByViewer = viewerVotes.some(
              ({ poll_option_id }) => poll_option_id === option.id,
            );

            return (
              <div className="rounded-2xl border border-[#e7e8ea] p-4" key={option.id}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold">{option.label}</span>
                    {selectedByViewer && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#edf5ff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#1767bf]">
                        <Check size={10} strokeWidth={3} aria-hidden="true" /> Your vote
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{percentage}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edeef0]">
                  <div className="h-full rounded-full bg-[#f0a938] transition-[width] duration-500" style={{ width: `${percentage}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#92959d]">
                  <span>{optionVotes.length} selection{optionVotes.length === 1 ? "" : "s"}</span>
                  {optionVotes.length > 0 && (
                    <span className="max-w-full truncate">
                      {optionVotes.map(({ voter_id }) => profileNames[voter_id] ?? "Circle member").join(", ")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {!closed && !hasVoted && (
        <section className="mt-7 rounded-[1.7rem] border border-[#efd39a] bg-white p-5 shadow-[0_10px_35px_rgba(240,169,56,0.08)] sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#fff4dc] text-[#a66a10]">
              <BadgeCheck size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold">Cast your vote</h2>
              <p className="mt-1 text-sm leading-6 text-[#74777f]">
                {allowsMultiple
                  ? "Choose one or more options. Your complete ballot can be submitted only once."
                  : "Choose one option. Your vote can be submitted only once."}
              </p>
            </div>
          </div>

          <form action={voteAction} className="mt-5" noValidate>
            <input name="pollId" type="hidden" value={pollId} />
            <div className="grid gap-2">
              {options.map((option) => (
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${selected.includes(option.id) ? "border-[#e8b654] bg-[#fffaf0]" : "border-[#e3e4e7]"}`}
                  key={option.id}
                >
                  <input
                    checked={selected.includes(option.id)}
                    className="accent-[#d58e1d]"
                    name="optionIds"
                    onChange={() => toggleOption(option.id)}
                    type={allowsMultiple ? "checkbox" : "radio"}
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
              {voting ? "Recording vote" : "Submit final vote"}
            </button>
            <ActionMessage state={voteState} />
          </form>
        </section>
      )}

      {(closed || hasVoted) && (
        <section className="mt-7 flex items-start gap-3 rounded-[1.5rem] border border-[#b9dfc5] bg-[#eefaf1] p-5 text-[#27663a]">
          {closed ? <CircleStop className="mt-0.5 shrink-0" size={20} aria-hidden="true" /> : <BadgeCheck className="mt-0.5 shrink-0" size={20} aria-hidden="true" />}
          <div>
            <h2 className="font-semibold">{closed ? "Voting is closed" : "Your vote is recorded"}</h2>
            <p className="mt-1 text-sm leading-6 text-[#4a7657]">
              {expired && expiresAt
                ? `This poll automatically closed at ${formatTimestamp(expiresAt)}.`
                : closed
                  ? "These are the final results."
                  : "The live result will continue updating as other circle members vote."}
            </p>
          </div>
        </section>
      )}

      {createdBy === viewerId && !closed && (
        <section className="mt-7 rounded-[1.5rem] border border-[#e2e3e6] bg-white p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <UsersRound className="mt-0.5 shrink-0 text-[#73767e]" size={20} aria-hidden="true" />
              <div>
                <h2 className="font-semibold">Creator controls</h2>
                <p className="mt-1 text-sm text-[#858890]">Close voting early when the group has decided.</p>
              </div>
            </div>
            <form action={closeAction}>
              <input name="pollId" type="hidden" value={pollId} />
              <button className="button button-light" disabled={closing} type="submit">
                {closing ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <CircleStop size={17} aria-hidden="true" />}
                {closing ? "Closing" : "Close poll"}
              </button>
            </form>
          </div>
          <ActionMessage state={closeState} />
        </section>
      )}

      {expiresAt && !closed && (
        <p className="mt-5 flex items-center justify-center gap-2 text-sm text-[#858890]">
          <CalendarClock size={15} aria-hidden="true" /> Voting closes {formatTimestamp(expiresAt)}
        </p>
      )}
    </>
  );
}
