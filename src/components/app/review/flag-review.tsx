"use client";

import { useActionState } from "react";
import { CheckCircle2, MessageSquareText, Play, XCircle } from "lucide-react";
import { toast } from "sonner";
import { confirmFlagAction, dismissFlagAction, flagFeedbackAction, runDetectionAction, type ActionResult } from "@/app/app/actions";
import { ActionDialog } from "@/components/app/action-dialog";
import type { AssigneeOption } from "@/components/app/record-dialogs";
import { CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { roleLabel, taskCategoryLabel, type FlagStatus, type TaskCategory } from "@/lib/labels";

const NO_PHI = "Fictional only — no real names, numbers, or clinical documents.";
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

export function FlagReviewActions({ flagId, status, title, assignees }: {
  flagId: string;
  status: FlagStatus;
  title: string;
  assignees: AssigneeOption[];
}) {
  const reviewable = status === "open" || status === "confirmed";
  return (
    <div className="flex flex-wrap gap-2">
      {reviewable ? (
        <ActionDialog
          action={confirmFlagAction}
          trigger={<><CheckCircle2 aria-hidden /> {status === "confirmed" ? "Add task" : "Confirm gap"}</>}
          triggerVariant={status === "confirmed" ? "outline" : "default"}
          title={status === "confirmed" ? "Add a follow-up task" : "Confirm documentation gap"}
          description={title}
          submitLabel={status === "confirmed" ? "Add task" : "Confirm"}
        >
          {(errors) => (
            <>
              <input type="hidden" name="flagId" value={flagId} />
              {status === "open" ? <TextAreaField label="Review note (optional)" name="note" rows={2} maxLength={500} hint={NO_PHI} error={errors.note} /> : null}
              <CheckboxField name="createTask" defaultChecked label="Create a follow-up task for the team" />
              <TextField label="Task title (optional)" name="taskTitle" maxLength={160} placeholder="Defaults to the flag title" error={errors.taskTitle} />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Task type" name="taskCategory" defaultValue="request_records" error={errors.taskCategory}>
                  {(Object.keys(taskCategoryLabel) as TaskCategory[]).map((category) => <option key={category} value={category}>{taskCategoryLabel[category]}</option>)}
                </SelectField>
                <TextField label="Due date" name="dueDate" type="date" defaultValue={inDays(7)} error={errors.dueDate} />
              </div>
              <SelectField label="Assign to" name="assigneeId" defaultValue="" error={errors.assigneeId}>
                <option value="">Unassigned</option>
                {assignees.map((person) => <option key={person.userId} value={person.userId}>{person.displayName} · {roleLabel[person.role]}</option>)}
              </SelectField>
              <p className="text-xs text-slate-500">Confirming records that the documentation gap is real. It doesn&rsquo;t change the care plan or contact the patient.</p>
            </>
          )}
        </ActionDialog>
      ) : null}
      {status !== "dismissed" && status !== "resolved_by_data" ? (
        <ActionDialog
          action={dismissFlagAction}
          trigger={<><XCircle aria-hidden /> Dismiss</>}
          title="Dismiss this flag"
          description="Explain why this isn't a real gap. Dismissed flags stay dismissed unless the underlying record changes."
          submitLabel="Dismiss"
        >
          {(errors) => (
            <>
              <input type="hidden" name="flagId" value={flagId} />
              <TextAreaField label="Reason" name="reason" rows={3} maxLength={500} required hint={NO_PHI} error={errors.reason} placeholder="e.g. Outcome documented in the June visit note" />
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
            <SelectField label="Verdict" name="verdict" defaultValue="accurate" error={errors.verdict}>
              <option value="accurate">Accurate — a real documentation gap</option>
              <option value="false_positive">False positive — not a gap</option>
              <option value="already_addressed">Already addressed elsewhere</option>
              <option value="not_useful">Accurate but not useful</option>
            </SelectField>
            <TextAreaField label="Comment (optional)" name="comment" rows={2} maxLength={500} hint={NO_PHI} error={errors.comment} />
          </>
        )}
      </ActionDialog>
    </div>
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
