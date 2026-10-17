"use server";

import { rateLimiter, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { submitDemoRequest } from "@/lib/services/public-demo-requests";

export interface DemoRequestState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
}

export async function requestDemoAction(_previous: DemoRequestState, form: FormData): Promise<DemoRequestState> {
  // Honeypot: real users never fill the hidden "website" field.
  if (String(form.get("website") ?? "")) return { status: "success", message: SUCCESS };

  const limit = rateLimiter().check(`demo-request:${await getClientIp()}`, RATE_LIMITS.demoRequest);
  if (!limit.allowed) return { status: "error", message: "Too many requests. Please try again later." };

  try {
    const result = await submitDemoRequest({
      name: form.get("name"),
      email: form.get("email"),
      clinicName: form.get("clinicName"),
      role: form.get("role"),
      clinicSize: form.get("clinicSize"),
      message: form.get("message") ?? "",
      noPatientInfo: form.get("noPatientInfo") === "on",
    });
    if (result.ok) return { status: "success", message: SUCCESS };
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: result.fieldErrors };
  } catch (error) {
    console.error("demo request failed", error);
    return { status: "error", message: "Something went wrong saving your request. Please try again." };
  }
}

const SUCCESS =
  "Thanks — your request was saved. This prototype does not send email; the SymptomWatch team reviews requests manually.";
