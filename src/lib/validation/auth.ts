import { z } from "zod";

const email = z.email("Enter a valid email address").trim().toLowerCase().max(200);

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(200),
});

export const signUpSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name").max(80),
  email,
  password: z.string().min(10, "Use at least 10 characters").max(200),
  clinicName: z.string().trim().max(80).optional().default(""),
  inviteToken: z.string().max(200).optional().default(""),
  noRealData: z.literal(true, { error: "Please confirm you will only use fictional data" }),
});

export const joinNewAccountSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name").max(80),
  email,
  password: z.string().min(10, "Use at least 10 characters").max(200),
  noRealData: z.literal(true, { error: "Please confirm you will only use fictional data" }),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: z.string().min(10, "Use at least 10 characters").max(200),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, { path: ["confirm"], message: "Passwords don't match" });

export const inviteSchema = z.object({
  email,
  role: z.enum(["clinic_admin", "physician", "staff"]),
});

export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
