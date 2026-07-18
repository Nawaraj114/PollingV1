import {
  ArrowRight,
  CheckCircle2,
  ReceiptText,
  ShieldCheck,
  Users,
  Vote,
} from "lucide-react";
import Link from "next/link";

import { AppLogo } from "@/components/app-logo";

const features = [
  {
    icon: ReceiptText,
    title: "Bills everyone can trust",
    description: "Agree on every split, track every step, and settle clearly.",
  },
  {
    icon: Vote,
    title: "Decisions without the noise",
    description: "Turn drawn-out group debates into quick, visible votes.",
  },
  {
    icon: Users,
    title: "Private to your circle",
    description: "A focused space built for the people you actually know.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f5f7] text-[#17181b]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <header className="flex h-20 items-center justify-between">
          <AppLogo />
          <nav className="flex items-center gap-2" aria-label="Account navigation">
            <Link className="button button-ghost hidden sm:inline-flex" href="/login">
              Sign in
            </Link>
            <Link className="button button-dark" href="/login">
              Member sign in
            </Link>
          </nav>
        </header>

        <section className="grid min-h-[calc(100vh-5rem)] items-center gap-16 py-14 lg:grid-cols-[1.03fr_0.97fr] lg:py-20">
          <div className="relative z-10 max-w-2xl">
            <div className="eyebrow">
              <span className="h-2 w-2 rounded-full bg-[#1473e6]" />
              Built for your people
            </div>
            <h1 className="mt-7 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[5.4rem]">
              Plans, payments,
              <span className="block text-[#1473e6]">and your circle.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#666a73] sm:text-xl">
              FriendCircle gives a close group one calm place to decide, split,
              and confirm without losing the details across different apps.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link className="button button-primary h-13 px-6" href="/login">
                Enter your circle
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="button button-light h-13 px-6" href="/signup">
                How access works
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-[#666a73]">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck size={17} className="text-[#1473e6]" /> Private by design
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={17} className="text-[#1473e6]" /> Clear audit trail
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px] lg:mr-0">
            <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-[#1473e6]/20 blur-3xl" />
            <div className="absolute -right-12 bottom-8 h-52 w-52 rounded-full bg-[#ffcf70]/25 blur-3xl" />
            <div className="relative rotate-[1.5deg] rounded-[2.25rem] bg-[#202124] p-3 shadow-[0_35px_90px_rgba(20,24,32,0.24)]">
              <div className="rounded-[1.65rem] bg-[#f8f8f8] p-5 sm:p-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#92959d]">
                      Tonight&apos;s plan
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                      Dinner after the movie?
                    </h2>
                  </div>
                  <div className="flex -space-x-2" aria-label="Four friends participating">
                    {["NK", "AS", "RP", "+1"].map((initials, index) => (
                      <span
                        className="grid h-9 w-9 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white"
                        style={{ backgroundColor: ["#1473e6", "#e56b4a", "#5b58a6", "#34363a"][index] }}
                        key={initials}
                      >
                        {initials}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border-2 border-[#1473e6] bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Yes, let&apos;s go</span>
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1473e6] text-xs font-bold text-white">3</span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e9eef7]">
                      <div className="h-full w-3/4 rounded-full bg-[#1473e6]" />
                    </div>
                  </div>
                  <div className="rounded-3xl border border-[#dedfe3] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Another day</span>
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#ececef] text-xs font-bold">1</span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#ececef]">
                      <div className="h-full w-1/4 rounded-full bg-[#9b9da4]" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-3xl bg-[#202124] p-5 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-white/55">Your share</p>
                      <p className="mt-1 text-3xl font-semibold tracking-[-0.04em]">₹ 350.00</p>
                    </div>
                    <span className="rounded-full bg-[#183d68] px-3 py-1 text-xs font-semibold text-[#72b7ff]">
                      Awaiting you
                    </span>
                  </div>
                  <button className="mt-5 w-full rounded-2xl bg-[#1473e6] px-4 py-3 text-sm font-semibold" type="button">
                    Review and confirm
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 pb-16 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article className="rounded-3xl border border-black/7 bg-white p-6" key={title}>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#edf5ff] text-[#1473e6]">
                <Icon size={21} aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-lg font-semibold tracking-[-0.025em]">{title}</h2>
              <p className="mt-2 leading-7 text-[#72757d]">{description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
