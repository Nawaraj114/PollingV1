import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const createBillSchema = z.object({
  categoryId: z.string().uuid().optional(),
  customCategory: z
    .string()
    .trim()
    .min(2, "Custom category must contain at least 2 characters.")
    .max(40, "Custom category must be 40 characters or fewer.")
    .optional(),
  description: z
    .string()
    .trim()
    .min(2, "Description must contain at least 2 characters.")
    .max(200, "Description must be 200 characters or fewer."),
  incurredOn: z.string().regex(datePattern, "Choose a valid bill date."),
  participantsJson: z.string().min(1, "Choose at least one participant."),
  totalAmount: z.string().trim().min(1, "Enter the bill total."),
});

export const participantFormSchema = z.array(
  z.object({
    exactAmount: z.string().optional().default(""),
    lineItems: z
      .array(
        z.object({
          amount: z.string(),
          categoryId: z.string().uuid(),
        }),
      )
      .default([]),
    participantId: z.string().uuid(),
  }),
).min(1, "Choose at least one participant.").max(50);
