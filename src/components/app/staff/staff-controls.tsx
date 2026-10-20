"use client";

import { startTransition, useActionState, useEffect, useOptimistic } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  changeRoleAction,
  inviteStaffAction,
  issueResetLinkAction,
  revokeInvitationAction,
  setMemberCanManageAction,
  setMemberStatusAction,
  type ActionResult,
} from "@/app/app/actions";
import { ActionDialog } from "@/components/app/action-dialog";
import { controlClass, SelectField, SubmitButton, TextField } from "@/components/forms/fields";
import { roleLabel, type MemberRole } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function useToastResult(state: ActionResult | null) {
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Saved.");
    else toast.error(state.message ?? "Couldn't save.");
  }, [state]);
}

export function InviteDialog() {
  return (
    <ActionDialog
      action={inviteStaffAction}
      trigger={<><UserPlus aria-hidden /> Invite staff</>}
      triggerVariant="default"
      triggerSize="default"
      title="Invite a colleague"
      description="They'll join this demo clinic with the role you choose. No email is sent — you'll get a link to share."
      submitLabel="Create invitation"
      keepOpenOnSuccess
    >
      {(errors) => (
        <>
          <TextField label="Work email" name="email" type="email" required error={errors.email} />
          <SelectField label="Role" name="role" defaultValue="staff" error={errors.role}>
            <option value="staff">Front desk — administrative tasks only</option>
            <option value="physician">Physician — clinical review</option>
            <option value="clinic_admin">Practice admin — office and reporting (grant manager access after they join)</option>
          </SelectField>
        </>
      )}
    </ActionDialog>
  );
}

export function RoleSelect({ userId, role, disabled }: { userId: string; role: MemberRole; disabled?: boolean }) {
  const [state, action] = useActionState(changeRoleAction, null);
  useToastResult(state);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>Role</label>
      <select
        id={`role-${userId}`}
        name="role"
        defaultValue={role}
        disabled={disabled}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className={cn(controlClass, "h-9 w-auto pr-8 text-sm")}
      >
        {(Object.keys(roleLabel) as MemberRole[]).map((value) => <option key={value} value={value}>{roleLabel[value]}</option>)}
      </select>
    </form>
  );
}

/** "Manages the clinic": invite and approve people, change access, read the audit log. Never one's own. */
export function ManageToggle({ userId, name, canManage, disabled }: { userId: string; name: string; canManage: boolean; disabled?: boolean }) {
  const [state, action] = useActionState(setMemberCanManageAction, null);
  // Shows the click at once; reverts on its own if the server refuses the change.
  const [checked, setChecked] = useOptimistic(canManage);
  useToastResult(state);
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <label className={cn("inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-body", disabled ? "opacity-70" : "cursor-pointer hover:bg-surface")}
        title={disabled ? "Ask another manager to change your access." : undefined}>
        <input type="checkbox" name="canManage" value="true" checked={checked} disabled={disabled} aria-label={`${name} manages the clinic`}
          onChange={(event) => {
            const next = event.currentTarget.checked;
            const data = new FormData(event.currentTarget.form!);
            startTransition(() => { setChecked(next); action(data); });
          }} className="size-4 accent-brand" />
        Manages the clinic
      </label>
    </form>
  );
}

export function StatusToggle({ userId, status }: { userId: string; status: "active" | "disabled" }) {
  const [state, action] = useActionState(setMemberStatusAction, null);
  useToastResult(state);
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={status === "active" ? "disabled" : "active"} />
      <SubmitButton size="sm" variant={status === "active" ? "outline" : "secondary"} pendingLabel="…">
        {status === "active" ? "Disable access" : "Re-enable"}
      </SubmitButton>
    </form>
  );
}

export function ResetLinkDialog({ userId, name }: { userId: string; name: string }) {
  return (
    <ActionDialog
      action={issueResetLinkAction}
      trigger={<><KeyRound aria-hidden /> Reset link</>}
      triggerSize="sm"
      title={`Password reset link for ${name}`}
      description="Creates a single-use link that expires in 30 minutes and signs them out everywhere once used."
      submitLabel="Create link"
      keepOpenOnSuccess
    >
      {() => <input type="hidden" name="userId" value={userId} />}
    </ActionDialog>
  );
}

export function RevokeInvitation({ invitationId }: { invitationId: string }) {
  const [state, action] = useActionState(revokeInvitationAction, null);
  useToastResult(state);
  return (
    <form action={action}>
      <input type="hidden" name="invitationId" value={invitationId} />
      <SubmitButton size="sm" variant="outline" pendingLabel="…">Revoke</SubmitButton>
    </form>
  );
}
