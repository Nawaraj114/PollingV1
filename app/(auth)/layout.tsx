import { ShieldCheck } from "lucide-react";

import { AppLogo } from "@/components/app-logo";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[0.92fr_1.08fr]">
      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-14">
        <AppLogo />
        <div className="flex flex-1 items-center justify-center py-14">{children}</div>
        <p className="flex items-center gap-2 text-xs text-[#8a8d95]">
          <ShieldCheck size={14} aria-hidden="true" />
          Secure sessions powered by Supabase Auth
        </p>
      </section>

      <aside className="relative hidden overflow-hidden bg-[#202124] p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#1473e6]/35 blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 h-72 w-72 rounded-full bg-[#ffbf4a]/10 blur-3xl" />
        <span className="relative inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/65">
          Small group. Strong trust.
        </span>
        <div className="relative max-w-xl">
          <blockquote className="text-4xl font-medium leading-[1.12] tracking-[-0.045em]">
            “No more asking who voted, who paid, or whether the numbers changed.”
          </blockquote>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              ["01", "Decide"],
              ["02", "Confirm"],
              ["03", "Settle"],
            ].map(([step, label]) => (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4" key={step}>
                <span className="text-xs text-white/40">{step}</span>
                <p className="mt-2 font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-sm text-white/45">Private space for 10–15 friends</p>
      </aside>
    </main>
  );
}
