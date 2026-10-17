import { demoRequests } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle } from "@/lib/db/types";
import { checkFreeText, describePhiFailure } from "@/lib/validation/phi-guard";
import { demoRequestSchema } from "@/lib/validation/demo-request";

export type DemoRequestResult =
  | { ok: true }
  | { ok: false; fieldErrors: Partial<Record<string, string>>; formError?: string };

/** Public, unauthenticated: stores a demo request. Nothing is emailed. */
export async function submitDemoRequest(raw: unknown, database?: DatabaseHandle): Promise<DemoRequestResult> {
  const parsed = demoRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }
  const input = parsed.data;
  const fieldErrors: Record<string, string> = {};
  for (const [field, label, value] of [
    ["name", "Name", input.name],
    ["clinicName", "Clinic name", input.clinicName],
    ["message", "Message", input.message],
  ] as const) {
    const check = checkFreeText(value);
    if (!check.ok) fieldErrors[field] = describePhiFailure(label, check);
  }
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  await withSystem(async (tx) => {
    await tx.insert(demoRequests).values({
      name: input.name,
      email: input.email,
      clinicName: input.clinicName,
      role: input.role,
      clinicSize: input.clinicSize,
      message: input.message || null,
    });
  }, database);
  return { ok: true };
}
