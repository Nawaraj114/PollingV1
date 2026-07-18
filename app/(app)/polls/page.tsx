import { Vote } from "lucide-react";
import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Polls" };

export default function PollsPage() {
  return (
    <ModulePlaceholder
      description="Single- and multiple-choice polls with clear expiry rules and live results will arrive after the billing workflow is proven."
      icon={Vote}
      phase="Phase 5"
      title="Polling is planned"
    />
  );
}
