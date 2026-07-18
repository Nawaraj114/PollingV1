import { z } from "zod";

const email = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(254, "Email is too long.");

export const resendConfirmationSchema = z.object({ email });

const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.");

export const loginSchema = z.object({
  email,
  password,
  next: z.string().optional(),
});
