"use client";

import { CalendarPlus, FlaskConical, ListPlus, Pencil, Send } from "lucide-react";
import {
  createTaskAction,
  scheduleAppointmentAction,
  updateAppointmentAction,
  updateLabAction,
  updateReferralAction,
  updateTaskAction,
} from "@/app/app/actions";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import {
  appointmentPurposeLabel,
  appointmentStatusLabel,
  roleLabel,
  taskCategoryLabel,
  taskStatusLabel,
  type MemberRole,
  type TaskCategory,
  type TaskStatus,
} from "@/lib/labels";
import { ActionDialog } from "./action-dialog";

export interface AssigneeOption {
  userId: string;
  displayName: string;
  role: MemberRole;
}

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const NO_PHI_HINT = "Fictional, administrative notes only — no real names, numbers, or clinical documents.";

function AssigneeSelect({ assignees, category, defaultValue, error }: {
  assignees: AssigneeOption[];
  category?: TaskCategory;
  defaultValue?: string | null;
  error?: string;
}) {
  const allowed = category === "clinical_review" ? assignees.filter((person) => person.role === "physician") : assignees;
  return (
    <SelectField label="Assigned to" name="assigneeId" defaultValue={defaultValue ?? ""} error={error}>
      <option value="">Unassigned</option>
      {allowed.map((person) => (
        <option key={person.userId} value={person.userId}>{person.displayName} · {roleLabel[person.role]}</option>
      ))}
    </SelectField>
  );
}

export function CreateTaskDialog({
  assignees,
  patients,
  categories,
  defaultPatientId,
  triggerVariant = "default",
}: {
  assignees: AssigneeOption[];
  patients: Array<{ id: string; label: string }>;
  categories: TaskCategory[];
  defaultPatientId?: string;
  triggerVariant?: "default" | "outline";
}) {
  return (
    <ActionDialog
      action={createTaskAction}
      trigger={<><ListPlus aria-hidden /> New task</>}
      triggerVariant={triggerVariant}
      triggerSize="default"
      title="Create follow-up task"
      description="Tasks are internal to your clinic. The prototype never contacts patients."
      submitLabel="Create task"
    >
      {(errors) => (
        <>
          <TextField label="Title" name="title" required maxLength={160} error={errors.title} placeholder="e.g. Request cardiology consult note" />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Type" name="category" defaultValue={categories[0]} error={errors.category}>
              {categories.map((category) => <option key={category} value={category}>{taskCategoryLabel[category]}</option>)}
            </SelectField>
            <TextField label="Due date" name="dueDate" type="date" defaultValue={inDays(3)} required error={errors.dueDate} />
          </div>
          <SelectField label="Patient (optional)" name="patientId" defaultValue={defaultPatientId ?? ""} error={errors.patientId}>
            <option value="">No specific patient</option>
            {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.label}</option>)}
          </SelectField>
          <AssigneeSelect assignees={assignees} error={errors.assigneeId} />
          <p className="-mt-2 text-xs text-slate-500">Clinical review tasks can only be assigned to physicians.</p>
          <TextAreaField label="Details (optional)" name="description" rows={3} maxLength={1000} hint={NO_PHI_HINT} error={errors.description} />
        </>
      )}
    </ActionDialog>
  );
}

export function UpdateTaskDialog({ task, assignees }: {
  task: { id: string; title: string; patientName?: string | null; status: TaskStatus; category: TaskCategory; assigneeId: string | null; outcome: string | null; dueDate: string };
  assignees: AssigneeOption[];
}) {
  return (
    <ActionDialog
      action={updateTaskAction}
      trigger={<><Pencil aria-hidden /> Update follow-up</>}
      triggerLabel={`Update follow-up for ${task.patientName ?? "the team"}: ${task.title}`}
      triggerSize="default"
      title="Update task"
      description={task.title}
      submitLabel="Save changes"
    >
      {(errors) => (
        <>
          <input type="hidden" name="taskId" value={task.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Status" name="status" defaultValue={task.status} error={errors.status}>
              {(Object.keys(taskStatusLabel) as TaskStatus[]).map((status) => <option key={status} value={status}>{taskStatusLabel[status]}</option>)}
            </SelectField>
            <TextField label="Due date" name="dueDate" type="date" defaultValue={task.dueDate.slice(0, 10)} error={errors.dueDate} />
          </div>
          <AssigneeSelect assignees={assignees} category={task.category} defaultValue={task.assigneeId} error={errors.assigneeId} />
          <TextAreaField
            label="Outcome"
            name="outcome"
            rows={3}
            maxLength={1000}
            defaultValue={task.outcome ?? ""}
            error={errors.outcome}
            hint="Required to mark the task completed. Describe what staff did (simulated) — no patient identifiers."
          />
        </>
      )}
    </ActionDialog>
  );
}

export function UpdateReferralDialog({ referral }: { referral: { id: string; specialty: string; status: string } }) {
  return (
    <ActionDialog
      action={updateReferralAction}
      trigger={<><Send aria-hidden /> Update status</>}
      triggerSize="xs"
      title={`Update ${referral.specialty} referral`}
      description="Record scheduling or that the specialist's records arrived. This closes the loop for the review queue."
      submitLabel="Save"
    >
      {(errors) => (
        <>
          <input type="hidden" name="referralId" value={referral.id} />
          <SelectField label="New status" name="status" defaultValue="records_received" error={errors.status}>
            <option value="scheduled">Specialist appointment scheduled</option>
            <option value="seen">Patient reports visit completed</option>
            <option value="records_received">Records received</option>
            <option value="declined">Declined by patient</option>
            <option value="cancelled">Cancelled</option>
          </SelectField>
          <TextField label="Date (appointment or records received)" name="date" type="date" defaultValue={today()} error={errors.date} />
          <TextField label="Note (optional)" name="reason" maxLength={300} error={errors.reason} hint={NO_PHI_HINT} />
        </>
      )}
    </ActionDialog>
  );
}

export function UpdateAppointmentDialog({ appointment }: { appointment: { id: string; status: keyof typeof appointmentStatusLabel; purpose: keyof typeof appointmentPurposeLabel } }) {
  return (
    <ActionDialog
      action={updateAppointmentAction}
      trigger={<><Pencil aria-hidden /> Update</>}
      triggerSize="xs"
      title={`Update ${appointmentPurposeLabel[appointment.purpose].toLowerCase()} appointment`}
      submitLabel="Save"
    >
      {(errors) => (
        <>
          <input type="hidden" name="appointmentId" value={appointment.id} />
          <SelectField label="Status" name="status" defaultValue={appointment.status} error={errors.status}>
            {(Object.keys(appointmentStatusLabel) as Array<keyof typeof appointmentStatusLabel>).map((status) => (
              <option key={status} value={status}>{appointmentStatusLabel[status]}</option>
            ))}
          </SelectField>
          <TextField label="Reason (optional)" name="reason" maxLength={300} error={errors.reason} hint={NO_PHI_HINT} />
        </>
      )}
    </ActionDialog>
  );
}

export function ScheduleAppointmentDialog({ patientId }: { patientId: string }) {
  return (
    <ActionDialog
      action={scheduleAppointmentAction}
      trigger={<><CalendarPlus aria-hidden /> Add appointment</>}
      triggerSize="sm"
      title="Add an appointment"
      description="Records a booking made by phone or in person. No reminder is sent."
      submitLabel="Add appointment"
    >
      {(errors) => (
        <>
          <input type="hidden" name="patientId" value={patientId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Purpose" name="purpose" defaultValue="follow_up" error={errors.purpose}>
              {(Object.keys(appointmentPurposeLabel) as Array<keyof typeof appointmentPurposeLabel>).map((purpose) => (
                <option key={purpose} value={purpose}>{appointmentPurposeLabel[purpose]}</option>
              ))}
            </SelectField>
            <TextField label="Date" name="date" type="date" defaultValue={inDays(14)} required error={errors.date} />
          </div>
          <SelectField label="Status" name="status" defaultValue="scheduled" error={errors.status}>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed with patient</option>
          </SelectField>
          <TextField label="Note (optional)" name="reason" maxLength={300} error={errors.reason} hint={NO_PHI_HINT} />
        </>
      )}
    </ActionDialog>
  );
}

export function UpdateLabDialog({ lab }: { lab: { id: string; testName: string } }) {
  return (
    <ActionDialog
      action={updateLabAction}
      trigger={<><FlaskConical aria-hidden /> Update</>}
      triggerSize="xs"
      title={`Update lab order — ${lab.testName}`}
      description="Physicians only. Use fictional result notes."
      submitLabel="Save"
    >
      {(errors) => (
        <>
          <input type="hidden" name="labId" value={lab.id} />
          <SelectField label="New status" name="status" defaultValue="resulted" error={errors.status}>
            <option value="collected">Specimen collected</option>
            <option value="resulted">Resulted</option>
            <option value="cancelled">Cancelled</option>
          </SelectField>
          <TextField label="Date" name="date" type="date" defaultValue={today()} error={errors.date} />
          <TextField label="Result note or cancellation reason" name="summary" maxLength={300} error={errors.summary} hint="Required for resulted or cancelled. Fictional only." />
        </>
      )}
    </ActionDialog>
  );
}
