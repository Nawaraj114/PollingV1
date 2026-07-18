import { z } from "zod";

const email = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(254, "Email is too long.");

const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.");

export const loginSchema = z.object({
  email,
  password,
  next: z.string().optional(),
});

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters.")
    .max(80, "Name must be 80 characters or fewer."),
  email,
  password,
});
