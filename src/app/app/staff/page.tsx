import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/primitives/layout";
import { formatTimelineDate } from "@/components/app/primitives/timeline-item";
import { InviteDialog, ResetLinkDialog, RevokeInvitation, RoleSelect, StatusToggle } from "@/components/app/staff/staff-controls";
import { requirePermission } from "@/lib/auth/current";
import { isPast } from "@/lib/dates";
import { roleLabel } from "@/lib/labels";
import { listMembers } from "@/lib/services/members";
import { listInvitations } from "@/lib/services/staff";

export const metadata: Metadata = { title: "Staff" };

async function Staff() {
  const { ctx } = await requirePermission("staff.manage");
  const [members, invitations] = await Promise.all([listMembers(ctx), listInvitations(ctx)]);
  const invitationStatus = (invite: (typeof invitations)[number]) =>
    invite.acceptedAt ? "Accepted" : invite.revokedAt ? "Revoked" : isPast(invite.expiresAt) ? "Expired" : "Pending";

  return (
    <div className="space-y-6">
      <PageHeader title="Staff & access" description="Who can use this clinic workspace, and what each role can see." actions={<InviteDialog />} />
      <section aria-labelledby="members-heading" className="rounded-xl border border-border bg-white shadow-soft">
        <h2 id="members-heading" className="border-b border-border p-4 text-base font-semibold">Members ({members.length})</h2>
        <ul className="divide-y divide-border">
          {members.map((member) => {
            const self = member.userId === ctx.userId;
            return (
              <li key={member.userId} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-navy">
                    {member.displayName}
                    {self ? <span className="ml-2 text-xs font-normal text-slate-500">(you)</span> : null}
                    {member.isPlaceholder ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-slate-600">Fictional colleague</span> : null}
                  </p>
                  <p className="truncate text-sm text-slate-500">{member.email} · {member.status === "active" ? "Active" : "Disabled"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <RoleSelect userId={member.userId} role={member.role} />
                  {!self ? <StatusToggle userId={member.userId} status={member.status} /> : null}
                  {!member.isPlaceholder && !self ? <ResetLinkDialog userId={member.userId} name={member.displayName} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-labelledby="invites-heading" className="rounded-xl border border-border bg-white shadow-soft">
        <h2 id="invites-heading" className="border-b border-border p-4 text-base font-semibold">Invitations</h2>
        {invitations.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No invitations yet. Invite a colleague to try the role-based views together.</p>
        ) : (
          <ul className="divide-y divide-border">
            {invitations.map((invite) => {
              const status = invitationStatus(invite);
              return (
                <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-navy">{invite.email}</p>
                    <p className="text-sm text-slate-500">{roleLabel[invite.role]} · {status}{status === "Pending" ? ` · expires ${formatTimelineDate(invite.expiresAt)}` : ""}</p>
                  </div>
                  {status === "Pending" ? <RevokeInvitation invitationId={invite.id} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="rounded-xl border border-border bg-surface p-4 text-sm text-body">
        <h2 className="font-semibold text-navy">What each role can access</h2>
        <ul className="mt-2 grid gap-2 md:grid-cols-3">
          <li><strong className="text-navy">Physician:</strong> full clinical timeline, review and feedback on flags, clinical review tasks, lab updates.</li>
          <li><strong className="text-navy">Front desk:</strong> demographics, appointments, referral status, administrative tasks. No visit notes, symptoms, labs, or flags.</li>
          <li><strong className="text-navy">Clinic admin:</strong> staff and audit log, read-only clinical view, run detection, reset demo data. Cannot review flags.</li>
        </ul>
      </section>
    </div>
  );
}

export default function StaffPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface" />}>
      <Staff />
    </Suspense>
  );
}
