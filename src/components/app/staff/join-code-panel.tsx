"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { cancelJoinCodeAction, createJoinCodeAction } from "@/app/app/actions";
import { controlClass, SubmitButton } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { roleLabel, type MemberRole } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Countdown } from "./countdown";
import { useToastResult } from "./staff-controls";

const ROLES: MemberRole[] = ["physician", "staff", "clinic_admin"];

/**
 * Generate a 90-second role code. The code is shown once, large, with a live
 * countdown; the colleague enters it on "Join with a code" while it's ticking.
 */
export function JoinCodePanel() {
  const [created, createAction, creating] = useActionState(createJoinCodeAction, null);
  const [cancelled, cancelAction] = useActionState(cancelJoinCodeAction, null);
  const [expiredId, setExpiredId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useToastResult(created && !created.ok ? created : null);
  useToastResult(cancelled);

  const code = created?.ok ? created.joinCode : undefined;
  // Cancellation belongs to the code it was for, not to whatever code is shown next.
  const isCancelled = Boolean(code && cancelled?.ok && cancelled.cancelledCodeId === code.id);
  const isExpired = Boolean(code && expiredId === code.id);
  const live = code && !isCancelled && !isExpired;

  return (
    <section aria-labelledby="join-code-heading" className="rounded-lg border border-border bg-card shadow-soft">
      <div className="border-b border-border p-4">
        <h2 id="join-code-heading" className="flex items-center gap-2 text-base font-semibold"><KeyRound className="size-4 text-brand" aria-hidden />Invite with a code</h2>
        <p className="mt-1 text-sm text-slate-600">Give the code to a colleague in person or on a call. They enter it on the sign-in page under &ldquo;Join with a code.&rdquo; Codes expire after 90 seconds.</p>
      </div>
      <form action={createAction} className="grid gap-4 p-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] md:items-end">
        <label className="block text-sm font-medium text-navy">
          Role for this code
          <select name="role" defaultValue="physician" className={cn(controlClass, "mt-1.5 h-10")}>
            {ROLES.map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}
          </select>
        </label>
        <fieldset className="text-sm">
          <legend className="font-medium text-navy">When someone uses it</legend>
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-2 text-body">
            <label className="inline-flex min-h-10 items-center gap-2"><input type="radio" name="approvalMode" value="approve" defaultChecked className="size-4 accent-brand" />I approve each person</label>
            <label className="inline-flex min-h-10 items-center gap-2"><input type="radio" name="approvalMode" value="instant" className="size-4 accent-brand" />Let them in right away</label>
          </div>
        </fieldset>
        <SubmitButton size="default" pending={creating} pendingLabel="Generating…">{code ? "Generate new code" : "Generate code"}</SubmitButton>
      </form>

      {code ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-surface/60 p-4">
          <div className="flex flex-wrap items-center gap-5">
            <p data-testid="join-code" aria-label="Join code"
              className={cn("font-mono text-3xl font-semibold tracking-[0.12em] tabular-nums", live ? "text-navy" : "text-slate-400 line-through")}>
              {code.display}
            </p>
            {live ? (
              <Countdown key={code.id} expiresAt={code.expiresAt} onExpire={() => setExpiredId(code.id)} />
            ) : (
              <p role="status" className="text-sm font-medium text-slate-600">{isCancelled ? "Code cancelled." : "Expired. Generate a new code when your colleague is ready."}</p>
            )}
          </div>
          {live ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="min-h-9"
                onClick={async () => { await navigator.clipboard?.writeText(code.display).catch(() => undefined); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy"}
              </Button>
              <form action={cancelAction}>
                <input type="hidden" name="codeId" value={code.id} />
                <Button type="submit" size="sm" variant="ghost" className="min-h-9">Cancel code</Button>
              </form>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
