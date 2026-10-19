/**
 * Builds the patient timeline from a role-filtered record set. Every event is
 * labeled with its provenance: charted fact (documented), expected-but-absent
 * record (not_documented), or engine inference (rule_inferred).
 */
import type { Provenance } from "@/components/app/primitives/badges";
import type { TimelineItemProps, TimelineKind } from "@/components/app/primitives/timeline-item";
import {
  appointmentPurposeLabel,
  appointmentStatusLabel,
  encounterTypeLabel,
  labStatusLabel,
  referralStatusLabel,
  ruleShortLabel,
  symptomStatusLabel,
  taskCategoryLabel,
  taskStatusLabel,
} from "@/lib/labels";
import type { PatientRecord } from "@/lib/services/patients";

export type TimelineFilter = "visit" | "appointment" | "lab" | "referral" | "task" | "flag";

export interface TimelineDetail {
  label: string;
  value: string;
}

export interface TimelineEvent {
  /** DOM anchor; flag evidence links point here. */
  anchor: string;
  kind: TimelineKind;
  filter: TimelineFilter;
  date: string;
  title: string;
  meta?: string;
  provenance: Provenance;
  outcome?: TimelineItemProps["outcome"];
  details: TimelineDetail[];
  /** Events dated after "now" (scheduled appointments). */
  upcoming: boolean;
  /** Extra anchors that resolve to this event (e.g. symptom observations recorded at a visit). */
  aliases?: string[];
}

/** Anchor convention shared with flag evidence (`kind` + record id). */
export const anchorFor = (kind: string, id: string) => `ev-${kind}-${id}`;

const DAY = 86_400_000;
const plusDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * DAY).toISOString();
const MISSED = new Set(["no_show", "cancelled_by_patient", "cancelled_by_clinic", "rescheduled"]);

export function appointmentOutcome(status: keyof typeof appointmentStatusLabel): NonNullable<TimelineEvent["outcome"]> {
  return { label: appointmentStatusLabel[status], tone: status === "completed" ? "complete" : MISSED.has(status) ? "attention" : "neutral" };
}

function followUpText(kind: string, days: number | null): string {
  if (kind === "interval" && days) return days % 30 === 0 ? `Return in ${days / 30} month${days === 30 ? "" : "s"} requested` : `Return in ${days} days requested`;
  if (kind === "as_needed") return "Return as needed";
  return "No structured follow-up recorded";
}

/** Where the missing record was expected, for the "Not documented" placeholder. */
function expectedDate(flag: PatientRecord["flags"][number], record: PatientRecord): string {
  const basis = flag.evidence.find((item) => item.role === "basis");
  switch (flag.ruleId) {
    case "overdue-follow-up": {
      const encounter = record.encounters.find((item) => item.id === flag.subjectId);
      return encounter?.followUpIntervalDays ? plusDays(encounter.occurredAt, encounter.followUpIntervalDays) : basis?.date ?? flag.firstDetectedAt;
    }
    case "lab-result-missing": {
      const lab = record.labs.find((item) => item.id === flag.subjectId);
      return lab ? plusDays(lab.orderedAt, lab.expectedWithinDays) : basis?.date ?? flag.firstDetectedAt;
    }
    case "referral-outcome-missing": {
      const referral = record.referrals.find((item) => item.id === flag.subjectId);
      if (!referral) return basis?.date ?? flag.firstDetectedAt;
      return referral.specialistAppointmentAt ?? plusDays(referral.referredAt, referral.expectedWithinDays);
    }
    default: {
      const dates = flag.evidence.map((item) => item.date).sort();
      return dates.at(-1) ?? flag.firstDetectedAt;
    }
  }
}

export function buildTimeline(record: PatientRecord, now = new Date()): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const isFuture = (iso: string) => new Date(iso).getTime() > now.getTime();

  for (const encounter of record.encounters) {
    const symptoms = record.symptoms.filter((item) => item.encounterId === encounter.id);
    events.push({
      anchor: anchorFor("encounter", encounter.id),
      kind: "visit",
      filter: "visit",
      date: encounter.occurredAt,
      title: `${encounterTypeLabel[encounter.encounterType]} — ${encounter.chiefComplaint}`,
      meta: [encounter.providerName, followUpText(encounter.followUpKind, encounter.followUpIntervalDays)].filter(Boolean).join(" · "),
      provenance: "documented",
      upcoming: false,
      aliases: symptoms.map((item) => anchorFor("symptom_observation", item.id)),
      details: [
        ...(symptoms.length ? [{ label: "Reported symptoms", value: symptoms.map((item) => `${item.label} (${symptomStatusLabel[item.status].toLowerCase()})`).join(", ") }] : []),
        { label: "Assessment", value: encounter.assessment },
        { label: "Plan", value: encounter.plan },
      ].filter((detail) => detail.value),
    });
  }

  for (const appointment of record.appointments) {
    const missed = MISSED.has(appointment.status);
    events.push({
      anchor: anchorFor("appointment", appointment.id),
      kind: missed ? "missed_appointment" : "appointment",
      filter: "appointment",
      date: appointment.scheduledFor,
      title: `${appointmentPurposeLabel[appointment.purpose]} appointment`,
      outcome: appointmentOutcome(appointment.status),
      meta: appointment.statusReason ?? undefined,
      provenance: "documented",
      upcoming: (appointment.status === "scheduled" || appointment.status === "confirmed") && isFuture(appointment.scheduledFor),
      details: [],
    });
  }

  for (const lab of record.labs) {
    events.push({
      anchor: anchorFor("lab_order", lab.id),
      kind: "lab",
      filter: "lab",
      date: lab.orderedAt,
      title: `Lab ordered — ${lab.testName}`,
      meta: `Expected within ${lab.expectedWithinDays} day${lab.expectedWithinDays === 1 ? "" : "s"}`,
      outcome: { label: labStatusLabel[lab.status], tone: lab.status === "cancelled" ? "attention" : lab.status === "resulted" ? "complete" : "neutral" },
      provenance: "documented",
      upcoming: false,
      details: lab.status === "cancelled" && lab.statusReason ? [{ label: "Cancellation reason", value: lab.statusReason }] : [],
    });
    if (lab.collectedAt && lab.status === "collected") {
      events.push({
        anchor: anchorFor("lab_collected", lab.id),
        kind: "lab",
        filter: "lab",
        date: lab.collectedAt,
        title: `Specimen collected — ${lab.testName}`,
        provenance: "documented",
        upcoming: false,
        details: [],
      });
    }
    if (lab.resultedAt) {
      events.push({
        anchor: anchorFor("lab_result", lab.id),
        kind: "lab",
        filter: "lab",
        date: lab.resultedAt,
        title: `Lab resulted — ${lab.testName}`,
        provenance: "documented",
        upcoming: false,
        details: lab.resultSummary ? [{ label: "Result note", value: lab.resultSummary }] : [],
      });
    }
  }

  for (const referral of record.referrals) {
    events.push({
      anchor: anchorFor("referral", referral.id),
      kind: "referral",
      filter: "referral",
      date: referral.referredAt,
      title: `Referral to ${referral.specialty}`,
      outcome: { label: referralStatusLabel[referral.status], tone: referral.status === "cancelled" || referral.status === "declined" ? "attention" : referral.status === "records_received" ? "complete" : "neutral" },
      provenance: "documented",
      upcoming: false,
      details: [
        ...(referral.reason ? [{ label: "Reason", value: referral.reason }] : []),
        ...(referral.statusReason ? [{ label: "Status note", value: referral.statusReason }] : []),
      ],
    });
    if (referral.specialistAppointmentAt) {
      events.push({
        anchor: anchorFor("referral_visit", referral.id),
        kind: "appointment",
        filter: "referral",
        date: referral.specialistAppointmentAt,
        title: `${referral.specialty} appointment${referral.status === "seen" ? " — reported completed" : ""}`,
        provenance: "documented",
        upcoming: isFuture(referral.specialistAppointmentAt),
        details: [],
      });
    }
    if (referral.recordsReceivedAt) {
      events.push({
        anchor: anchorFor("referral_records", referral.id),
        kind: "referral",
        filter: "referral",
        date: referral.recordsReceivedAt,
        title: `${referral.specialty} records received`,
        provenance: "documented",
        upcoming: false,
        details: referral.outcomeSummary ? [{ label: "Outcome", value: referral.outcomeSummary }] : [],
      });
    }
  }

  for (const task of record.tasks) {
    events.push({
      anchor: anchorFor("task", task.id),
      kind: "task",
      filter: "task",
      date: task.createdAt,
      title: `Task — ${task.title}`,
      meta: `${taskCategoryLabel[task.category]} · ${taskStatusLabel[task.status]}${task.assigneeName ? ` · ${task.assigneeName}` : ""}`,
      provenance: "documented",
      upcoming: false,
      details: task.outcome ? [{ label: "Outcome", value: task.outcome }] : [],
    });
  }

  for (const flag of record.flags) {
    if (flag.status !== "open" && flag.status !== "confirmed") continue;
    const missing = flag.missingInfo[0];
    events.push({
      anchor: anchorFor("expected", flag.id),
      kind: "expected",
      filter: "flag",
      date: expectedDate(flag, record),
      title: missing?.description ?? "Expected record not documented",
      meta: `Expected by this date · ${ruleShortLabel[flag.ruleId]}`,
      provenance: "not_documented",
      upcoming: false,
      details: [],
    });
    events.push({
      anchor: anchorFor("flag", flag.id),
      kind: "flag",
      filter: "flag",
      date: flag.firstDetectedAt,
      title: flag.title,
      meta: flag.status === "confirmed" ? "Gap confirmed by physician" : "Possible gap — needs clinician review",
      provenance: "rule_inferred",
      upcoming: false,
      details: [],
    });
  }

  return sortTimeline(events, "desc");
}

const KIND_ORDER: Record<TimelineKind, number> = {
  visit: 0, appointment: 1, missed_appointment: 1, lab: 2, referral: 3, task: 4, expected: 5, flag: 6,
};

/** Chronological sort; same-day ties keep a stable clinical order (visit before its orders). */
export function sortTimeline(events: TimelineEvent[], direction: "asc" | "desc"): TimelineEvent[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...events].sort((a, b) => {
    const delta = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (delta !== 0) return delta * sign;
    return (KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) * sign;
  });
}
