import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, FlaskConical, ListChecks, Send } from "lucide-react";
import { StatusBadge } from "@/components/app/primitives/badges";
import { FlagCard } from "@/components/app/primitives/flag-card";
import { formatTimelineDate } from "@/components/app/primitives/timeline-item";
import { ageFrom } from "@/components/app/patients/patients-panel";
import { PatientTimeline } from "@/components/app/patients/patient-timeline";
import { FlagReviewActions } from "@/components/app/review/flag-review";
import {
  CreateTaskDialog,
  ScheduleAppointmentDialog,
  UpdateAppointmentDialog,
  UpdateLabDialog,
  UpdateReferralDialog,
  UpdateTaskDialog,
} from "@/components/app/record-dialogs";
import { requirePermission } from "@/lib/auth/current";
import { can } from "@/lib/authz/permissions";
import {
  appointmentPurposeLabel,
  appointmentStatusLabel,
  labStatusLabel,
  referralStatusLabel,
  ruleShortLabel,
  taskCategoryLabel,
  type TaskCategory,
} from "@/lib/labels";
import { listMembers } from "@/lib/services/members";
import { ServiceError } from "@/lib/services/errors";
import { getPatientRecord } from "@/lib/services/patients";
import { anchorFor, buildTimeline } from "@/lib/timeline";

export const metadata: Metadata = { title: "Patient timeline" };

function RailSection({ title, icon: Icon, count, children, action }: {
  title: string;
  icon: typeof ListChecks;
  count?: number;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-slate-500" aria-hidden /> {title}
          {count !== undefined ? <span className="font-normal text-slate-500">({count})</span> : null}
        </h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-slate-500">{children}</p>;

async function PatientView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, ctx } = await requirePermission("patient.read_demographics");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const record = await getPatientRecord(ctx, id, { audit: true }).catch((error: unknown) => {
    if (error instanceof ServiceError) notFound();
    throw error;
  });
  const members = await listMembers(ctx);
  const assignees = members.filter((member) => member.status === "active").map(({ userId, displayName, role }) => ({ userId, displayName, role }));
  const events = buildTimeline(record);
  const { header } = record;
  const now = new Date();

  const openTasks = record.tasks.filter((task) => task.status !== "completed");
  const activeReferrals = record.referrals.filter((referral) => ["sent", "scheduled", "seen"].includes(referral.status));
  const pendingLabs = record.labs.filter((lab) => lab.status === "ordered" || lab.status === "collected");
  const upcomingAppointments = record.appointments.filter((item) => new Date(item.scheduledFor) > now || ["scheduled", "confirmed"].includes(item.status));
  const reviewFlags = record.flags.filter((flag) => flag.status === "open" || flag.status === "confirmed");
  const categories: TaskCategory[] = (Object.keys(taskCategoryLabel) as TaskCategory[]).filter(
    (category) => category !== "clinical_review" || can(session.role, "task.manage_clinical"),
  );

  return (
    <div className="space-y-6">
      <Link href="/app/patients" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-navy">
        <ArrowLeft className="size-4" aria-hidden /> All patients
      </Link>

      <header className="flex flex-col gap-4 border-y border-border py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{header.firstName} {header.lastName}</h1>
            <span className="text-xs text-muted-foreground">Fictional patient record</span>
            {header.careStatus === "transferred_out" ? (
              <span className="inline-flex h-6 items-center rounded-full border border-slate-300 px-2.5 text-xs font-medium text-slate-600">Care transferred out</span>
            ) : null}
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-body">
            <div className="flex gap-1.5"><dt className="text-slate-500">Demo MRN</dt><dd className="font-mono text-xs">{header.demoMrn}</dd></div>
            <div className="flex gap-1.5"><dt className="text-slate-500">Age</dt><dd className="tabular-nums">{ageFrom(header.dateOfBirth, now)}</dd></div>
            <div className="flex gap-1.5"><dt className="text-slate-500">Sex</dt><dd>{header.sex === "female" ? "Female" : "Male"}</dd></div>
            <div className="flex gap-1.5"><dt className="text-slate-500">Phone</dt><dd className="tabular-nums">{header.phone}</dd></div>
            <div className="flex gap-1.5"><dt className="text-slate-500">Primary physician</dt><dd>{header.physicianName ?? "—"}</dd></div>
          </dl>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ScheduleAppointmentDialog patientId={header.id} />
          <CreateTaskDialog assignees={assignees} patients={[{ id: header.id, label: `${header.lastName}, ${header.firstName} · ${header.demoMrn}` }]} categories={categories} defaultPatientId={header.id} triggerVariant="outline" />
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] [&>*]:min-w-0">
        <PatientTimeline events={events} clinical={record.clinical} />

        <div className="space-y-4">
          {record.clinical ? (
            <RailSection title="Possible gaps for review" icon={ListChecks} count={reviewFlags.length}>
              {reviewFlags.length ? (
                <div className="space-y-0">
                  {reviewFlags.map((flag) => (
                    <FlagCard
                      key={flag.id}
                      compact
                      className="rounded-none border-x-0 border-t-0 bg-transparent px-0 shadow-none"
                      status={flag.status}
                      ruleLabel={ruleShortLabel[flag.ruleId]}
                      ruleVersion={flag.ruleVersion}
                      title={flag.title}
                      rationale={flag.rationale}
                      evidence={flag.evidence.map((item) => ({ label: item.label, date: item.date, href: `#${anchorFor(item.kind, item.id)}` }))}
                      missing={flag.missingInfo}
                      footer={can(session.role, "flag.review") ? <FlagReviewActions flagId={flag.id} status={flag.status} title={flag.title} assignees={assignees} /> : undefined}
                    />
                  ))}
                </div>
              ) : (
                <Empty>No open flags for this patient.</Empty>
              )}
            </RailSection>
          ) : null}

          <RailSection title="Outstanding tasks" icon={ListChecks} count={openTasks.length}>
            {openTasks.length ? (
              <ul className="space-y-0">
                {openTasks.map((task) => (
                  <li key={task.id} className="border-b border-border py-3">
                    <p className="text-sm font-medium text-navy">{task.title}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                      {taskCategoryLabel[task.category]} · due {formatTimelineDate(task.dueDate)}{task.assigneeName ? ` · ${task.assigneeName}` : " · unassigned"}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <StatusBadge status={task.status} />
                      {task.category !== "clinical_review" || can(session.role, "task.manage_clinical") ? (
                        <UpdateTaskDialog task={task} assignees={assignees} />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No open tasks.</Empty>
            )}
          </RailSection>

          <RailSection title="Referrals" icon={Send} count={record.referrals.length}>
            {record.referrals.length ? (
              <ul className="space-y-0">
                {record.referrals.map((referral) => (
                  <li key={referral.id} className="border-b border-border py-3">
                    <p className="text-sm font-medium text-navy">{referral.specialty}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-slate-500">Referred {formatTimelineDate(referral.referredAt)} · {referralStatusLabel[referral.status]}</p>
                    {activeReferrals.includes(referral) && can(session.role, "referral.update_admin_status") ? (
                      <div className="mt-2"><UpdateReferralDialog referral={referral} /></div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No referrals.</Empty>
            )}
          </RailSection>

          <RailSection title="Appointments" icon={CalendarClock} count={upcomingAppointments.length}>
            {upcomingAppointments.length ? (
              <ul className="space-y-0">
                {upcomingAppointments.map((appointment) => (
                  <li key={appointment.id} className="flex items-start justify-between gap-2 border-b border-border py-3">
                    <div>
                      <p className="text-sm font-medium text-navy">{appointmentPurposeLabel[appointment.purpose]}</p>
                      <p className="mt-0.5 text-xs tabular-nums text-slate-500">{formatTimelineDate(appointment.scheduledFor)} · {appointmentStatusLabel[appointment.status]}</p>
                    </div>
                    <UpdateAppointmentDialog appointment={appointment} />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No upcoming appointments on file.</Empty>
            )}
          </RailSection>

          {record.clinical ? (
            <RailSection title="Pending labs" icon={FlaskConical} count={pendingLabs.length}>
              {pendingLabs.length ? (
                <ul className="space-y-0">
                  {pendingLabs.map((lab) => (
                    <li key={lab.id} className="flex items-start justify-between gap-2 border-b border-border py-3">
                      <div>
                        <p className="text-sm font-medium text-navy">{lab.testName}</p>
                        <p className="mt-0.5 text-xs tabular-nums text-slate-500">Ordered {formatTimelineDate(lab.orderedAt)} · {labStatusLabel[lab.status]}</p>
                      </div>
                      {can(session.role, "lab.update_status") ? <UpdateLabDialog lab={lab} /> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No pending lab orders.</Empty>
              )}
            </RailSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PatientPage(props: PageProps<"/app/patients/[id]">) {
  return (
    <Suspense fallback={<div className="space-y-4"><div className="h-28 animate-pulse rounded-xl bg-surface" /><div className="h-96 animate-pulse rounded-xl bg-surface" /></div>}>
      <PatientView params={props.params} />
    </Suspense>
  );
}
