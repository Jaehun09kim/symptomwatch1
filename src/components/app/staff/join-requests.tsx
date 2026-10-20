"use client";

import { useActionState } from "react";
import { BadgeCheck, CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { decideJoinRequestAction, type ActionResult } from "@/app/app/actions";
import { controlClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { roleLabel, type MemberRole } from "@/lib/labels";
import type { JoinRequestRow } from "@/lib/services/join-codes";
import { cn } from "@/lib/utils";

const ROLES: MemberRole[] = ["physician", "staff", "clinic_admin"];

function RequestRow({ request }: { request: JoinRequestRow }) {
  // Toast from inside the action: a decided request leaves the list on refresh, so this row
  // may unmount before an effect could announce the result.
  const [, action, pending] = useActionState(async (previous: ActionResult | null, form: FormData) => {
    const result = await decideJoinRequestAction(previous, form);
    if (result.ok) toast.success(result.message ?? "Saved.");
    else toast.error(result.message ?? "Couldn't save.");
    return result;
  }, null);
  return (
    <li className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-navy">{request.displayName}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
          <span className="truncate">{request.email}</span>
          {request.emailVerified
            ? <span className="inline-flex items-center gap-1 text-teal-strong"><BadgeCheck className="size-3.5" aria-hidden />Email confirmed</span>
            : <span className="inline-flex items-center gap-1 text-attention"><CircleAlert className="size-3.5" aria-hidden />Email not confirmed</span>}
          <span>· asked to join as {roleLabel[request.requestedRole]}</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">Confirm it&rsquo;s really them, in person or by phone, before approving.</p>
      </div>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="requestId" value={request.id} />
        <label className="sr-only" htmlFor={`role-${request.id}`}>Role for {request.displayName}</label>
        <select id={`role-${request.id}`} name="role" defaultValue={request.requestedRole} className={cn(controlClass, "h-9 w-auto pr-8 text-sm")}>
          {ROLES.map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}
        </select>
        <Button type="submit" size="sm" name="decision" value="approve" disabled={pending}>Approve {request.displayName}</Button>
        <Button type="submit" size="sm" variant="outline" name="decision" value="decline" disabled={pending}>Decline</Button>
      </form>
    </li>
  );
}

export function JoinRequests({ requests }: { requests: JoinRequestRow[] }) {
  return (
    <section aria-labelledby="join-requests-heading" className="rounded-lg border border-border bg-card shadow-soft">
      <h2 id="join-requests-heading" className="border-b border-border p-4 text-base font-semibold">Join requests ({requests.length})</h2>
      {requests.length === 0
        ? <p className="p-4 text-sm text-slate-600">No one is waiting to join. People who use an &ldquo;I approve each person&rdquo; code appear here.</p>
        : <ul className="divide-y divide-border">{requests.map((request) => <RequestRow key={request.id} request={request} />)}</ul>}
    </section>
  );
}
