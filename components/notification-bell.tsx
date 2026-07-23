"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { parseNotificationFeed } from "@/lib/notifications/feed";
import { createClient } from "@/lib/supabase/client";

const notificationTables = [
  "bills",
  "bill_participants",
  "polls",
  "poll_votes",
] as const;

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase.channel("action-notification-badge");
    const refreshCount = async () => {
      const { data } = await supabase.rpc("get_action_notifications");
      setCount(parseNotificationFeed(data).length);
      if (pathname === "/notifications") router.refresh();
    };
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refreshCount(), 250);
    };

    notificationTables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") scheduleRefresh();
    });
    const expiryTimer = window.setInterval(
      () => void refreshCount(),
      60_000,
    );

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      window.clearInterval(expiryTimer);
      void supabase.removeChannel(channel);
    };
  }, [pathname, router]);

  return (
    <Link
      aria-label={`Notifications${count > 0 ? `, ${count} action${count === 1 ? "" : "s"} needed` : ""}`}
      className={`relative grid h-10 w-10 place-items-center rounded-full ${
        pathname === "/notifications"
          ? "bg-[#202124] text-white"
          : "text-[#73767d] hover:bg-white hover:text-[#202124]"
      }`}
      href="/notifications"
      prefetch
      title="Notifications"
    >
      <Bell size={19} aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-[#f4f5f7] bg-[#e05243] px-1 text-[9px] font-bold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
