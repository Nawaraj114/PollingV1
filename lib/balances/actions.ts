"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type BalancePaymentState = {
  message?: string;
  status?: "error" | "success";
};

const selectedPaymentsSchema = z
  .array(z.uuid())
  .min(1)
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length);

export async function markBalanceAllocationsPaid(
  _previousState: BalancePaymentState,
  formData: FormData,
): Promise<BalancePaymentState> {
  const parsed = selectedPaymentsSchema.safeParse(
    formData.getAll("participantIds"),
  );

  if (!parsed.success) {
    return {
      message: "Select between 1 and 50 unique unpaid bills.",
      status: "error",
    };
  }

  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: allocations, error: authorizationError } = await supabase
    .from("bill_participants")
    .select("bill_id, id")
    .in("id", parsed.data)
    .eq("participant_id", viewer.id)
    .eq("auth_status", "authenticated")
    .eq("payment_status", "unpaid");

  if (authorizationError || allocations?.length !== parsed.data.length) {
    return {
      message:
        "One or more selected bills are no longer eligible. Refresh and try again.",
      status: "error",
    };
  }

  const { data: changedRows, error } = await supabase.rpc(
    "mark_bill_participants_paid",
    { p_participant_ids: parsed.data },
  );

  if (error || changedRows !== parsed.data.length) {
    return {
      message:
        "The selected payments could not be marked. No bills were changed.",
      status: "error",
    };
  }

  revalidatePath("/balances");
  revalidatePath("/bills");
  allocations.forEach(({ bill_id }) => revalidatePath(`/bills/${bill_id}`));
  revalidatePath("/dashboard");

  return {
    message: `${changedRows} ${changedRows === 1 ? "payment" : "payments"} marked as sent.`,
    status: "success",
  };
}
