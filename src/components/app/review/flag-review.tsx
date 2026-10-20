"use client";

import { useActionState, useState } from "react";
import { AlarmClock, AlarmClockOff, CheckCircle2, MessageSquareText, Play, XCircle } from "lucide-react";
import { toast } from "sonner";
import { confirmFlagAction, dismissFlagAction, flagFeedbackAction, runDetectionAction, snoozeFlagAction, unsnoozeFlagAction, type ActionResult } from "@/app/app/actions";
import { ActionDialog } from "@/components/app/action-dialog";
import type { AssigneeOption } from "@/components/app/record-dialogs";
import { SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import type { RuleId } from "@/lib/detection/types";
import { flagTaskDefaults } from "@/lib/flag-task-defaults";
import { dismissReasonLabel, roleLabel, taskCategoryLabel, type DismissReason, type FlagStatus, type TaskCategory } from "@/lib/labels";

const NO_PHI = "Fictional only — no real names, numbers, or clinical documents.";
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

export function FlagReviewActions({ flagId, status, title, ruleId, reviewerId, assignees, snoozed }: {
  ruleId: RuleId;
  reviewerId: string;
  flagId: string;
  status: FlagStatus;
  title: string;
  assignees: AssigneeOption[];
  snoozed: boolean;
}) {
  const reviewable = status === "open" || status === "confirmed";
  return (
    <div role="group" aria-label="Flag actions" className="flex flex-wrap gap-2 [&_button]:min-h-11">
      {reviewable ? (
        <ActionDialog
          action={confirmFlagAction}
          trigger={<><CheckCircle2 aria-hidden /> {status === "confirmed" ? "Add task" : "Confirm gap"}</>}
          triggerVariant={status === "confirmed" ? "outline" : "default"}
          title={status === "confirmed" ? "Add a follow-up task" : "Confirm documentation gap"}
          description={title}
          submitLabel={status === "confirmed" ? "Add task" : "Confirm"}
        >
          {(errors) => <ConfirmFields flagId={flagId} status={status} title={title} ruleId={ruleId} reviewerId={reviewerId} assignees={assignees} errors={errors} />}
        </ActionDialog>
      ) : null}
      {status === "open" && !snoozed ? (
        <ActionDialog
          action={snoozeFlagAction}
          trigger={<><AlarmClock aria-hidden /> Snooze</>}
          title="Snooze this flag"
          description="Hide it from the review queue until a date. It comes back sooner if the record changes."
          submitLabel="Snooze"
        >
          {(errors) => (
            <>
              <input type="hidden" name="flagId" value={flagId} />
              <TextField className="rounded-md bg-card shadow-none" label="Return to the queue on" name="until" type="date" defaultValue={inDays(14)} min={inDays(1)} max={inDays(90)} required hint="Up to 90 days." error={errors.until} />
              <TextAreaField className="rounded-md bg-card shadow-none" label="Why wait? (optional)" name="note" rows={2} maxLength={300} hint={NO_PHI} error={errors.note} placeholder="e.g. Specialist office said the note is coming next week" />
            </>
          )}
        </ActionDialog>
      ) : null}
      {snoozed ? <WakeButton flagId={flagId} /> : null}
      {status === "open" || status === "confirmed" ? (
        <ActionDialog
          action={dismissFlagAction}
          trigger={<><XCircle aria-hidden /> Dismiss</>}
          title="Dismiss this flag"
          description="Dismissed flags stay dismissed unless the underlying record changes. Reasons are counted per rule to tune detection."
          submitLabel="Dismiss"
        >
          {(errors) => (
            <>
              <input type="hidden" name="flagId" value={flagId} />
              <SelectField className="rounded-md bg-card shadow-none" label="Reason" name="reasonCode" defaultValue="expected" error={errors.reasonCode}>
                {(Object.keys(dismissReasonLabel) as DismissReason[]).map((reason) => <option key={reason} value={reason}>{dismissReasonLabel[reason]}</option>)}
              </SelectField>
              <TextAreaField className="rounded-md bg-card shadow-none" label="Note (required for “Other”)" name="reason" rows={2} maxLength={500} hint={NO_PHI} error={errors.reason} placeholder="e.g. Outcome documented in the June visit note" />
            </>
          )}
        </ActionDialog>
      ) : null}
      <ActionDialog
        action={flagFeedbackAction}
        trigger={<><MessageSquareText aria-hidden /> Feedback</>}
        triggerVariant="ghost"
        title="Rate this flag"
        description="Feedback is aggregated per rule to evaluate and improve detection."
        submitLabel="Send feedback"
      >
        {(errors) => (
          <>
            <input type="hidden" name="flagId" value={flagId} />
            <SelectField className="rounded-md bg-card shadow-none" label="Verdict" name="verdict" defaultValue="accurate" error={errors.verdict}>
              <option value="accurate">Accurate — a real documentation gap</option>
              <option value="false_positive">False positive — not a gap</option>
              <option value="already_addressed">Already addressed elsewhere</option>
              <option value="not_useful">Accurate but not useful</option>
            </SelectField>
            <TextAreaField className="rounded-md bg-card shadow-none" label="Comment (optional)" name="comment" rows={2} maxLength={500} hint={NO_PHI} error={errors.comment} />
          </>
        )}
      </ActionDialog>
    </div>
  );
}

function ConfirmFields({ flagId, status, title, ruleId, reviewerId, assignees, errors }: {
  flagId: string; status: FlagStatus; title: string; ruleId: RuleId; reviewerId: string;
  assignees: AssigneeOption[]; errors: Record<string, string | undefined>;
}) {
  const frontDesk = assignees.filter((person) => person.role === "staff");
  const soleFrontDesk = frontDesk.length === 1 ? frontDesk[0].userId : undefined;
  const [defaults] = useState(() => flagTaskDefaults(ruleId, title, reviewerId, new Date(), soleFrontDesk));
  const [createTask, setCreateTask] = useState(true);
  const [category, setCategory] = useState(defaults.category);
  const [assignee, setAssignee] = useState(defaults.assigneeId);
  const [due, setDue] = useState(defaults.dueDate);
  const allowed = category === "clinical_review" ? assignees.filter((person) => person.role === "physician") : assignees;
  const owner = assignees.find((person) => person.userId === assignee)?.displayName ?? "Unassigned — team must claim";
  const date = due ? new Date(`${due}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "choose a date";
  return (
    <>
      <input type="hidden" name="flagId" value={flagId} />
      {status === "open" ? <TextAreaField label="Review note (optional)" name="note" rows={2} maxLength={500} hint={NO_PHI} error={errors.note} /> : null}
      <label className="flex min-h-10 items-center gap-3 text-sm text-body">
        <input type="checkbox" name="createTask" checked={createTask} onChange={(event) => setCreateTask(event.target.checked)} className="size-5 accent-brand" />
        Create a follow-up task for the team
      </label>
      <fieldset disabled={!createTask} className="space-y-4">
        <legend className="sr-only">Follow-up task</legend>
        <TextField label="Task title (optional)" name="taskTitle" maxLength={160} defaultValue={defaults.title} error={errors.taskTitle} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Task type" name="taskCategory" value={category} error={errors.taskCategory} onChange={(event) => {
            const next = event.target.value as TaskCategory;
            setCategory(next);
            if (next === "clinical_review" && assignees.find((person) => person.userId === assignee)?.role !== "physician") setAssignee(reviewerId);
            else if (next !== "clinical_review" && assignee === reviewerId) setAssignee(soleFrontDesk ?? "");
          }}>
            {(Object.keys(taskCategoryLabel) as TaskCategory[]).map((value) => <option key={value} value={value}>{taskCategoryLabel[value]}</option>)}
          </SelectField>
          <TextField label="Due date" name="dueDate" type="date" value={due} onChange={(event) => setDue(event.target.value)} required error={errors.dueDate} />
        </div>
        <SelectField label="Assign to" name="assigneeId" value={assignee} onChange={(event) => setAssignee(event.target.value)} error={errors.assigneeId}
          hint={category === "clinical_review"
            ? "Clinical reviews stay with you by default."
            : soleFrontDesk ? "Front-desk work goes to your front desk by default." : "Starts unassigned for the team to claim. Pick someone to make it theirs."}>
          {allowed.map((person) => <option key={person.userId} value={person.userId}>{person.displayName} · {roleLabel[person.role]}</option>)}
          <option value="">Unassigned — leave for the team to claim</option>
        </SelectField>
        <p className="text-xs text-body">The due date is an editable workflow target, not an assessment of urgency.</p>
      </fieldset>
      <p aria-live="polite" className="rounded-md border border-border bg-surface p-3 text-sm font-medium text-navy">
        {createTask ? `${taskCategoryLabel[category]} · ${owner} · due ${date}` : "Confirm gap only · no follow-up task will be created"}
      </p>
      <p className="text-xs text-body">Confirming records the documentation gap. It doesn&rsquo;t change the care plan or contact the patient.</p>
    </>
  );
}

export function RunDetectionButton() {
  const [, action] = useActionState(async (previous: ActionResult | null) => {
    void previous;
    const result = await runDetectionAction();
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
    return result;
  }, null);
  return (
    <form action={action}>
      <SubmitButton size="default" pendingLabel="Running…"><Play aria-hidden /> Run detection</SubmitButton>
    </form>
  );
}

function WakeButton({ flagId }: { flagId: string }) {
  const [, action] = useActionState(async (previous: ActionResult | null, form: FormData) => {
    void previous;
    const result = await unsnoozeFlagAction(null, form);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
    return result;
  }, null);
  return (
    <form action={action}>
      <input type="hidden" name="flagId" value={flagId} />
      <SubmitButton size="sm" variant="outline" pendingLabel="Waking…"><AlarmClockOff aria-hidden /> Wake now</SubmitButton>
    </form>
  );
}
