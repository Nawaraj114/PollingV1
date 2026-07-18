import { ArrowLeft, Vote } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CreatePollForm } from "@/components/create-poll-form";
import { requireViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create Poll" };

export default async function NewPollPage() {
  await requireViewer();

  return (
    <main className="mx-auto max-w-4xl px-5 py-9 sm:px-8 sm:py-12">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#6f727a] hover:text-[#202124]" href="/polls">
        <ArrowLeft size={16} aria-hidden="true" /> Back to polls
      </Link>
      <div className="mt-6">
        <div className="eyebrow">
          <Vote size={14} className="text-[#f0a938]" aria-hidden="true" /> Phase 5 polling
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Create a poll</h1>
        <p className="mt-3 max-w-2xl text-lg leading-8 text-[#74777f]">
          Ask one clear question, choose how voting works, and optionally set an automatic closing time.
        </p>
      </div>
      <CreatePollForm />
    </main>
  );
}
