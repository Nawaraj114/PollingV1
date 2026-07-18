import {
  CirclePlus,
  Vote,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PollFeed } from "@/components/poll-feed";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Polls" };

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
          .select("created_at, id, poll_id, poll_option_id, voter_id")
          .in("poll_id", pollIds)
      : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("full_name, id"),
  ]);
  const profileNames = Object.fromEntries(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name]),
  );

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

      {!error && (polls ?? []).length > 0 && (
        <PollFeed
          initialVotes={votes ?? []}
          options={options ?? []}
          polls={polls ?? []}
          profileNames={profileNames}
          viewerId={viewer.id}
        />
      )}
    </main>
  );
}
