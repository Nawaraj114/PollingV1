"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function BalanceRealtimeRefresh() {
  const router = useRouter();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase.channel("circle-balances");
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 250);
    };

    ["bills", "bill_participants"].forEach((table) => {
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
      title={live ? "Balance changes appear automatically" : "Connecting to live balance updates"}
    >
      <span
        className={`h-2 w-2 rounded-full ${live ? "bg-[#42a768]" : "bg-[#a5a7ad]"}`}
      />
      {live ? "Live balances" : "Connecting"}
    </span>
  );
}
