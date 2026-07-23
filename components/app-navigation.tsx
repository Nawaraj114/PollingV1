"use client";

import {
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Scale,
  UserRound,
  Vote,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/lib/auth/actions";
import { AppLogo } from "./app-logo";
import { MemberAvatar } from "./member-avatar";

const navigation = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/bills", icon: ReceiptText, label: "Bills" },
  { href: "/balances", icon: Scale, label: "Balances" },
  { href: "/polls", icon: Vote, label: "Polls" },
  { href: "/account", icon: UserRound, label: "Account" },
];

export function AppNavigation({
  viewerAvatarUrl,
  viewerName,
}: {
  viewerAvatarUrl: string | null;
  viewerName: string;
}) {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-black/6 bg-[#f4f5f7]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-19 max-w-7xl items-center justify-between px-5 sm:px-8">
          <AppLogo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {navigation.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                    active ? "bg-[#202124] text-white" : "text-[#686b73] hover:bg-white hover:text-[#202124]"
                  }`}
                  href={href}
                  key={href}
                  prefetch
                >
                  <Icon size={17} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <Link aria-label="Open account settings" href="/account">
              <MemberAvatar avatarUrl={viewerAvatarUrl} name={viewerName} />
            </Link>
            <form action={signOut}>
              <button className="grid h-10 w-10 place-items-center rounded-full text-[#73767d] hover:bg-white hover:text-[#202124]" title="Sign out" type="submit">
                <LogOut size={18} aria-hidden="true" />
                <span className="sr-only">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-around rounded-[1.4rem] border border-white/10 bg-[#202124]/95 p-2 shadow-2xl backdrop-blur md:hidden" aria-label="Mobile navigation">
        {navigation.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`flex min-w-13 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold ${active ? "bg-[#1473e6] text-white" : "text-white/55"}`}
              href={href}
              key={href}
              prefetch
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
