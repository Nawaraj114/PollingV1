import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Bills" };

export default function BillsPage() {
  return (
    <ModulePlaceholder
      description="Transparent bill creation, per-person splits, authentication, and settlement history will be built across the billing phases."
      icon={ReceiptText}
      phase="Phases 2–4"
      title="Billing is next"
    />
  );
}
