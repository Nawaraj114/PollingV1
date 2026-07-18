import { z } from "zod";

export const pollOptionsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Every option needs a label.")
      .max(100, "Options must be 100 characters or fewer."),
  )
  .min(2, "Add at least two options.")
  .max(10, "A poll can have at most ten options.")
  .superRefine((options, context) => {
    const normalized = options.map((option) => option.toLocaleLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      context.addIssue({
        code: "custom",
        message: "Every poll option must be unique.",
      });
    }
  });

export const createPollSchema = z.object({
  allowsMultiple: z.enum(["single", "multiple"]),
  expiresAt: z.union([z.string().datetime({ offset: true }), z.literal("")]),
  optionsJson: z.string().min(1),
  question: z
    .string()
    .trim()
    .min(5, "The question must contain at least 5 characters.")
    .max(240, "The question must be 240 characters or fewer."),
});

export const votePollSchema = z.object({
  optionIds: z
    .array(z.string().uuid())
    .min(1, "Choose at least one option.")
    .max(10),
  pollId: z.string().uuid("The poll reference is invalid."),
});

export const closePollSchema = z.object({
  pollId: z.string().uuid("The poll reference is invalid."),
});
