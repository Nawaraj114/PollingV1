import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Clock3 } from "lucide-react";
import Link from "next/link";

type ModulePlaceholderProps = {
  description: string;
  icon: LucideIcon;
  phase: string;
  title: string;
};

export function ModulePlaceholder({ description, icon: Icon, phase, title }: ModulePlaceholderProps) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-4.75rem)] max-w-3xl place-items-center px-5 py-14 text-center sm:px-8">
      <div>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-[1.4rem] bg-[#e6f1ff] text-[#1473e6]">
          <Icon size={28} aria-hidden="true" />
        </span>
        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-black/7 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#858890]">
          <Clock3 size={13} aria-hidden="true" />
          Planned for {phase}
        </div>
        <h1 className="mt-5 text-5xl font-semibold tracking-[-0.055em]">{title}</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-[#73767e]">{description}</p>
        <Link className="button button-dark mt-8" href="/dashboard">
          <ArrowLeft size={17} aria-hidden="true" />
          Back to home
        </Link>
      </div>
    </main>
  );
}
