import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  BanknoteArrowUp,
  Bell,
  CheckCircle2,
  ShieldCheck,
  Vote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { requireViewer } from "@/lib/auth/session";
import { formatMinorInr } from "@/lib/bills/money";
import {
  parseNotificationFeed,
  type ActionNotification,
  type ActionNotificationKind,
} from "@/lib/notifications/feed";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications" };

type NotificationPresentation = {
  action: string;
  accent: string;
  icon: LucideIcon;
  title: string;
};

const presentation: Record<
  ActionNotificationKind,
  NotificationPresentation
> = {
  allocation_review: {
    action: "Review allocation",
    accent: "bg-[#edf5ff] text-[#1473e6]",
    icon: ShieldCheck,
    title: "Bill needs your review",
  },
  confirm_receipt: {
    action: "Confirm receipt",
    accent: "bg-[#eaf8ee] text-[#34784c]",
    icon: BadgeCheck,
    title: "Payment confirmation needed",
  },
  dispute_resolution: {
    action: "Resolve dispute",
    accent: "bg-[#fff3e5] text-[#a86608]",
    icon: AlertTriangle,
    title: "Disputed split needs correction",
  },
  payment_due: {
    action: "Record payment",
    accent: "bg-[#f0efff] text-[#625cb5]",
    icon: BanknoteArrowUp,
    title: "Accepted payment is due",
  },
  poll_vote: {
    action: "Vote now",
    accent: "bg-[#fff4dc] text-[#a66a10]",
    icon: Vote,
    title: "Open poll needs your vote",
  },
};

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(timestamp));
}

function notificationDescription(notification: ActionNotification) {
  switch (notification.kind) {
    case "allocation_review":
      return `Review and accept or dispute your ${formatMinorInr(notification.amountMinor)} allocation.`;
    case "payment_due":
      return `Your accepted ${formatMinorInr(notification.amountMinor)} allocation is ready to be paid.`;
    case "dispute_resolution":
      return `${notification.actionCount} disputed ${notification.actionCount === 1 ? "allocation needs" : "allocations need"} correction before the bill can move forward.`;
    case "confirm_receipt":
      return `${notification.actionCount} ${notification.actionCount === 1 ? "payment" : "payments"} totalling ${formatMinorInr(notification.amountMinor)} await confirmation.`;
    case "poll_vote":
      return "Cast your ballot while this poll is still open.";
  }
}

export default async function NotificationsPage() {
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_action_notifications");
  const notifications = parseNotificationFeed(data);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">
            <Bell size={14} className="text-[#e05243]" aria-hidden="true" />
            Live action center
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            Notifications
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-[#74777f]">
            Everything that currently needs your attention, without stale
            unread messages.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#666a73] shadow-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${notifications.length ? "bg-[#e05243]" : "bg-[#42a768]"}`}
          />
          {notifications.length} open{" "}
          {notifications.length === 1 ? "action" : "actions"}
        </span>
      </section>

      {error && (
        <div className="mt-8 rounded-2xl border border-[#f1c5bf] bg-[#fff3f1] px-5 py-4 text-sm text-[#9e342a]">
          Notifications could not be loaded. Apply the notifications migration,
          then refresh this page.
        </div>
      )}

      {!error && notifications.length === 0 && (
        <section className="mt-10 rounded-[2rem] border border-dashed border-[#cfd1d6] bg-white px-6 py-14 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#eaf8ee] text-[#34784c]">
            <CheckCircle2 size={27} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em]">
            You&apos;re all caught up
          </h2>
          <p className="mx-auto mt-2 max-w-md leading-7 text-[#7d8088]">
            New actions will appear here automatically when a bill or poll
            needs you.
          </p>
        </section>
      )}

      {!error && notifications.length > 0 && (
        <section className="mt-9 grid gap-4" aria-label="Open actions">
          {notifications.map((notification) => {
            const item = presentation[notification.kind];
            const Icon = item.icon;

            return (
              <Link
                className="group grid gap-4 rounded-[1.7rem] border border-black/7 bg-white p-5 shadow-[0_9px_30px_rgba(34,37,43,0.035)] hover:-translate-y-0.5 hover:shadow-[0_15px_38px_rgba(34,37,43,0.08)] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6"
                href={notification.href}
                key={notification.id}
                prefetch
              >
                <span
                  className={`grid h-12 w-12 place-items-center rounded-2xl ${item.accent}`}
                >
                  <Icon size={21} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#999ca3]">
                    {item.title}
                  </span>
                  <span className="mt-1 block truncate text-lg font-semibold tracking-[-0.025em]">
                    {notification.resourceLabel}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-[#74777f]">
                    {notificationDescription(notification)}
                  </span>
                  <span className="mt-2 block text-xs text-[#9a9da4]">
                    {formatTimestamp(notification.createdAt)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#1473e6]">
                  {item.action}
                  <ArrowUpRight
                    className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    size={17}
                    aria-hidden="true"
                  />
                </span>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
