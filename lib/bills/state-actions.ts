"use server";

import { revalidatePath } from "next/cache";

import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  BillSplitError,
  minorToDecimal,
  parseAmountToMinor,
} from "@/lib/validations/billSplit";
import type { Json } from "@/types/database";
import {
  acceptAllocationSchema,
  disputeAllocationSchema,
  resubmitAllocationRowsSchema,
  resubmitAllocationsSchema,
} from "./schemas";

export type BillActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  status?: "error" | "success";
};

function errorState(message: string): BillActionState {
  return { message, status: "error" };
}

function refreshBill(billId: string) {
  revalidatePath(`/bills/${billId}`);
  revalidatePath("/bills");
  revalidatePath("/dashboard");
}

export async function acceptAllocation(
  _previousState: BillActionState,
  formData: FormData,
): Promise<BillActionState> {
  const parsed = acceptAllocationSchema.safeParse({
    participantId: formData.get("participantId"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, status: "error" };
  }

  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: allocation } = await supabase
    .from("bill_participants")
    .select("auth_status, bill_id, participant_id")
    .eq("id", parsed.data.participantId)
    .maybeSingle();

  if (
    !allocation ||
    allocation.participant_id !== viewer.id ||
    allocation.auth_status !== "pending"
  ) {
    return errorState("Only your pending allocation can be accepted.");
  }

  const { data: authentication, error: authenticationError } =
    await supabase.auth.signInWithPassword({
      email: viewer.email,
      password: parsed.data.password,
    });

  if (
    authenticationError ||
    !authentication.user ||
    authentication.user.id !== viewer.id
  ) {
    return errorState("The password is incorrect. Your allocation was not accepted.");
  }

  const { error } = await supabase.rpc("authenticate_bill_participant", {
    p_participant_id: parsed.data.participantId,
  });

  if (error) {
    return errorState("The allocation could not be accepted. Refresh and try again.");
  }

  refreshBill(allocation.bill_id);
  return { message: "Allocation accepted and locked.", status: "success" };
}

export async function disputeAllocation(
  _previousState: BillActionState,
  formData: FormData,
): Promise<BillActionState> {
  const parsed = disputeAllocationSchema.safeParse({
    note: formData.get("note"),
    participantId: formData.get("participantId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, status: "error" };
  }

  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: allocation } = await supabase
    .from("bill_participants")
    .select("auth_status, bill_id, participant_id")
    .eq("id", parsed.data.participantId)
    .maybeSingle();

  if (
    !allocation ||
    allocation.participant_id !== viewer.id ||
    allocation.auth_status !== "pending"
  ) {
    return errorState("Only your pending allocation can be disputed.");
  }

  const { error } = await supabase.rpc("dispute_bill_participant", {
    p_note: parsed.data.note,
    p_participant_id: parsed.data.participantId,
  });

  if (error) {
    return errorState("The dispute could not be recorded. Refresh and try again.");
  }

  refreshBill(allocation.bill_id);
  return { message: "Dispute recorded for the biller to resolve.", status: "success" };
}

export async function resubmitAllocations(
  _previousState: BillActionState,
  formData: FormData,
): Promise<BillActionState> {
  const parsed = resubmitAllocationsSchema.safeParse({
    allocationsJson: formData.get("allocationsJson"),
    billId: formData.get("billId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, status: "error" };
  }

  let rawAllocations: unknown;
  try {
    rawAllocations = JSON.parse(parsed.data.allocationsJson);
  } catch {
    return errorState("The corrected allocations could not be read.");
  }

  const rows = resubmitAllocationRowsSchema.safeParse(rawAllocations);
  if (!rows.success) {
    return errorState(
      rows.error.issues[0]?.message ?? "Every unlocked allocation needs a valid amount.",
    );
  }

  const viewer = await requireViewer();
  const supabase = await createClient();
  const [{ data: bill }, { data: unlockedRows }] = await Promise.all([
    supabase
      .from("bills")
      .select("biller_id")
      .eq("id", parsed.data.billId)
      .maybeSingle(),
    supabase
      .from("bill_participants")
      .select("auth_status, id")
      .eq("bill_id", parsed.data.billId)
      .neq("auth_status", "authenticated"),
  ]);

  if (!bill || bill.biller_id !== viewer.id) {
    return errorState("Only the biller can resubmit disputed allocations.");
  }

  const unlockedIds = new Set((unlockedRows ?? []).map(({ id }) => id));
  const submittedIds = rows.data.map(({ participantRowId }) => participantRowId);
  if (
    submittedIds.length !== unlockedIds.size ||
    new Set(submittedIds).size !== submittedIds.length ||
    submittedIds.some((id) => !unlockedIds.has(id))
  ) {
    return errorState("Every unlocked allocation must be included exactly once.");
  }

  try {
    const payload = rows.data.map(({ amount, participantRowId }) => ({
      owed_amount: Number(minorToDecimal(parseAmountToMinor(amount))),
      participant_row_id: participantRowId,
    }));
    const { error } = await supabase.rpc("resubmit_bill_allocations", {
      p_allocations: payload as Json,
      p_bill_id: parsed.data.billId,
    });

    if (error) {
      return errorState(
        "The corrected amounts must be positive and still equal the full bill total.",
      );
    }
  } catch (error) {
    if (error instanceof BillSplitError) {
      return errorState(error.message);
    }
    throw error;
  }

  refreshBill(parsed.data.billId);
  return { message: "Corrected allocations resubmitted for acceptance.", status: "success" };
}
