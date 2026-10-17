import { z } from "zod";

export const DEMO_REQUEST_ROLES = ["Physician", "Practice manager", "Front desk", "Other"] as const;
export const CLINIC_SIZES = ["1 physician", "2–3 physicians", "4–5 physicians", "6+ physicians"] as const;

export const demoRequestSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.email("Enter a valid work email").trim().max(200),
  clinicName: z.string().trim().min(2, "Enter your clinic's name").max(150),
  role: z.enum(DEMO_REQUEST_ROLES, { error: "Choose your role" }),
  clinicSize: z.enum(CLINIC_SIZES, { error: "Choose a clinic size" }),
  message: z.string().trim().max(1000, "Keep the message under 1,000 characters").optional().default(""),
  noPatientInfo: z.literal(true, { error: "Please confirm you won't include patient information" }),
});

export type DemoRequestInput = z.infer<typeof demoRequestSchema>;
