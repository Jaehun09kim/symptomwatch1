"use client";

import { useState } from "react";
import { recordTaskOutcomeAction } from "@/app/app/actions";
import { ActionDialog } from "@/components/app/action-dialog";
import { SelectField, TextAreaField } from "@/components/forms/fields";
import { taskStatusLabel, type TaskCategory } from "@/lib/labels";
import { taskOutcomeChoices } from "@/lib/task-outcomes";

export function TaskOutcomeDialog({ task }: { task: { id: string; title: string; patientName: string | null; category: TaskCategory } }) {
  return (
    <ActionDialog action={recordTaskOutcomeAction} trigger="Record outcome" triggerVariant="default" triggerSize="default"
      triggerLabel={`Record outcome for ${task.patientName ?? "the team"}: ${task.title}`} title="Record follow-up outcome" description={task.title} submitLabel="Save outcome">
      {(errors) => <OutcomeFields task={task} errors={errors} />}
    </ActionDialog>
  );
}

function OutcomeFields({ task, errors }: { task: { id: string; category: TaskCategory }; errors: Record<string, string | undefined> }) {
  const [choice, setChoice] = useState("");
  const options = taskOutcomeChoices(task.category);
  const selected = options.find((option) => option.value === choice);
  return (
    <>
      <input type="hidden" name="taskId" value={task.id} />
      <SelectField label="Outcome" name="outcomeChoice" required value={choice} onChange={(event) => setChoice(event.target.value)} error={errors.outcomeChoice}>
        <option value="" disabled>Choose an outcome</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </SelectField>
      <TextAreaField label="Note (optional)" name="outcomeNote" rows={2} maxLength={900} error={errors.outcomeNote} hint="Fictional administrative details only. Record work your team has done; no message is sent." />
      <p aria-live="polite" className="text-sm text-body">{selected ? `Task will be marked ${taskStatusLabel[selected.status].toLowerCase()}.` : "Choose what happened to update the task status."}</p>
    </>
  );
}
