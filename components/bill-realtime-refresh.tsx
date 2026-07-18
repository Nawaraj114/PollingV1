"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const billingTables = [
  "bills",
  "bill_participants",
  "bill_line_items",
  "bill_status_history",
] as const;

export function BillRealtimeRefresh() {
  const router = useRouter();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase.channel("bill-feed");
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 250);
    };

    billingTables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    });

    channel.subscribe((status) => {
      const subscribed = status === "SUBSCRIBED";
      setLive(subscribed);
      if (subscribed) scheduleRefresh();
    });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${live ? "bg-[#eaf8ee] text-[#2f7042]" : "bg-[#f1f2f3] text-[#777a82]"}`}
      title={live ? "Bill changes appear automatically" : "Connecting to live bill updates"}
    >
      <span className={`h-2 w-2 rounded-full ${live ? "bg-[#42a768]" : "bg-[#a5a7ad]"}`} />
      {live ? "Live updates" : "Connecting"}
    </span>
  );
}
