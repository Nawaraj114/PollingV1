import { LockKeyhole, LogIn } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Invitation required" };

export default function SignupPage() {
  return (
    <div className="w-full max-w-md">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#edf5ff] text-[#1473e6]">
        <LockKeyhole size={24} aria-hidden="true" />
      </span>
      <p className="mt-7 text-sm font-semibold text-[#1473e6]">Private circle</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-[#202124]">
        An invitation is required
      </h1>
      <p className="mt-4 leading-7 text-[#74777f]">
        FriendCircle is limited to people the circle administrator has added. Public account creation is disabled.
      </p>
      <div className="mt-7 rounded-2xl border border-[#d8e7f8] bg-[#f4f9ff] px-4 py-4 text-sm leading-6 text-[#365b82]">
        Ask the administrator to add your email through Supabase. Once your account exists, return here and sign in.
      </div>
      <Link className="button button-primary mt-7 h-12 w-full" href="/login">
        <LogIn size={18} aria-hidden="true" />
        Go to sign in
      </Link>
    </div>
  );
}
