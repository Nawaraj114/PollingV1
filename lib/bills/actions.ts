"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireViewerId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  BillSplitError,
  calculateBillSplit,
  minorToDecimal,
  parseAmountToMinor,
  type BillParticipantInput,
} from "@/lib/validations/billSplit";
import type { Json } from "@/types/database";
import { createBillSchema, participantFormSchema } from "./schemas";

export type CreateBillState = {
  errors?: Record<string, string[]>;
  message?: string;
  status?: "error";
};

function errorState(message: string): CreateBillState {
  return { message, status: "error" };
}

export async function createBill(
  _previousState: CreateBillState,
  formData: FormData,
): Promise<CreateBillState> {
  const parsed = createBillSchema.safeParse({
    categoryId: formData.get("categoryId") || undefined,
    customCategory: formData.get("customCategory") || undefined,
    description: formData.get("description"),
    incurredOn: formData.get("incurredOn"),
    participantsJson: formData.get("participantsJson"),
    totalAmount: formData.get("totalAmount"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      status: "error",
    };
  }

  if (!parsed.data.categoryId && !parsed.data.customCategory) {
    return errorState("Choose a bill category or enter a custom one.");
  }

  if (parsed.data.categoryId && parsed.data.customCategory) {
    return errorState("Choose an existing category or create a custom one, not both.");
  }

  let rawParticipants: unknown;

  try {
    rawParticipants = JSON.parse(parsed.data.participantsJson);
  } catch {
    return errorState("The participant split could not be read. Please review it and try again.");
  }

  const participantResult = participantFormSchema.safeParse(rawParticipants);

  if (!participantResult.success) {
    return errorState("Choose valid participants and complete every category line item.");
  }

  const viewerId = await requireViewerId();
  const participantIds = participantResult.data.map(({ participantId }) => participantId);

  if (participantIds.includes(viewerId) || new Set(participantIds).size !== participantIds.length) {
    return errorState("Every selected participant must be a different member of your circle.");
  }

  const splitInputs: BillParticipantInput[] = [];

  try {
    for (const participant of participantResult.data) {
      const categoryIds = participant.lineItems.map(({ categoryId }) => categoryId);

      if (
        new Set(categoryIds).size !== categoryIds.length
      ) {
        return errorState("Each breakdown category must be valid and used only once per person.");
      }

      splitInputs.push({
        exactMinor: participant.exactAmount.trim()
          ? parseAmountToMinor(participant.exactAmount)
          : undefined,
        lineItems: participant.lineItems.map(({ amount }) => ({
          amountMinor: parseAmountToMinor(amount),
        })),
        participantId: participant.participantId,
      });
    }

    const totalMinor = parseAmountToMinor(parsed.data.totalAmount);
    const supabase = await createClient();
    const allocations = calculateBillSplit(totalMinor, splitInputs);
    const participantPayload = allocations.map((allocation) => {
      const source = participantResult.data.find(
        ({ participantId }) => participantId === allocation.participantId,
      )!;

      return {
        line_items: source.lineItems.map((lineItem) => ({
          amount: Number(minorToDecimal(parseAmountToMinor(lineItem.amount))),
          category_id: lineItem.categoryId,
        })),
        owed_amount: Number(minorToDecimal(allocation.owedMinor)),
        participant_id: allocation.participantId,
        split_method: allocation.method,
      };
    });

    const { data: billId, error } = await supabase.rpc("create_bill", {
      p_category_id: parsed.data.categoryId ?? null,
      p_custom_category: parsed.data.customCategory ?? null,
      p_description: parsed.data.description,
      p_incurred_on: parsed.data.incurredOn,
      p_participants: participantPayload as Json,
      p_total_amount: Number(minorToDecimal(totalMinor)),
    });

    if (error || !billId) {
      return errorState("The bill could not be saved. Please review the split and try again.");
    }

    revalidatePath("/bills");
    revalidatePath("/dashboard");
    redirect(`/bills?bill=${encodeURIComponent(billId)}`);
  } catch (error) {
    if (error instanceof BillSplitError) {
      return errorState(error.message);
    }

    throw error;
  }
}
