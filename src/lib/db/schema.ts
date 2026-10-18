import { sql } from "drizzle-orm";
import {
  boolean, check, customType, date, foreignKey, index, integer, jsonb,
  pgTable, text, timestamp, unique, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import type { EvidenceRef, MissingInfo } from "@/lib/detection/types";

const citext = customType<{ data: string }>({ dataType: () => "citext" });
const id = () => uuid("id").defaultRandom().primaryKey();
const time = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const createdAt = () => time("created_at").notNull().defaultNow();
const clinicId = () => uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" });
const roles = ["clinic_admin", "physician", "staff"] as const;

export const users = pgTable("users", {
  id: id(),
  email: citext("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  authSubject: text("auth_subject").unique(),
  isPlaceholder: boolean("is_placeholder").notNull().default(false),
  seedKey: text("seed_key"),
  createdAt: createdAt(),
});

export const clinics = pgTable("clinics", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isSandbox: boolean("is_sandbox").notNull().default(false),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  expiresAt: time("expires_at"),
  seedKey: text("seed_key"),
  createdAt: createdAt(),
}, (t) => [index("clinics_sandbox_expiry_idx").on(t.expiresAt).where(sql`${t.isSandbox}`)]).enableRLS();

export const sessions = pgTable("sessions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  originalUserId: uuid("original_user_id").references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  activeClinicId: uuid("active_clinic_id").references(() => clinics.id, { onDelete: "cascade" }),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
  lastSeenAt: time("last_seen_at").notNull().defaultNow(),
  expiresAt: time("expires_at").notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: time("expires_at").notNull(),
  usedAt: time("used_at"),
});

export const outboxMessages = pgTable("outbox_messages", {
  id: id(),
  toEmail: citext("to_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  kind: text("kind", { enum: ["invitation", "password_reset"] }).notNull(),
  createdAt: createdAt(),
}, (t) => [check("outbox_messages_kind_check", sql`${t.kind} IN ('invitation', 'password_reset')`)]);

export const demoRequests = pgTable("demo_requests", {
  id: id(),
  name: text("name").notNull(),
  email: citext("email").notNull(),
  clinicName: text("clinic_name").notNull(),
  role: text("role").notNull(),
  clinicSize: text("clinic_size").notNull(),
  message: text("message"),
  createdAt: createdAt(),
});

export const memberships = pgTable("memberships", {
  id: id(),
  clinicId: clinicId(),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: text("role", { enum: roles }).notNull(),
  status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
  seedKey: text("seed_key"),
  createdAt: createdAt(),
}, (t) => [
  unique().on(t.clinicId, t.id), unique().on(t.clinicId, t.userId), unique().on(t.clinicId, t.seedKey),
  check("memberships_role_check", sql`${t.role} IN ('clinic_admin', 'physician', 'staff')`),
  check("memberships_status_check", sql`${t.status} IN ('active', 'disabled')`),
]).enableRLS();

export const invitations = pgTable("invitations", {
  id: id(),
  clinicId: clinicId(),
  email: citext("email").notNull(),
  role: text("role", { enum: roles }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  invitedBy: uuid("invited_by").notNull(),
  expiresAt: time("expires_at").notNull(),
  acceptedAt: time("accepted_at"),
  revokedAt: time("revoked_at"),
}, (t) => [
  unique().on(t.clinicId, t.id),
  check("invitations_role_check", sql`${t.role} IN ('clinic_admin', 'physician', 'staff')`),
  foreignKey({ columns: [t.clinicId, t.invitedBy], foreignColumns: [memberships.clinicId, memberships.userId] }),
]).enableRLS();

export const patients = pgTable("patients", {
  id: id(),
  clinicId: clinicId(),
  demoMrn: text("demo_mrn").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
  sex: text("sex", { enum: ["female", "male"] }).notNull(),
  phone: text("phone").notNull(),
  primaryPhysicianId: uuid("primary_physician_id"),
  careStatus: text("care_status", { enum: ["active", "transferred_out"] }).notNull().default("active"),
  isSynthetic: boolean("is_synthetic").notNull().default(true),
  seedKey: text("seed_key"),
  createdAt: createdAt(),
}, (t) => [
  unique().on(t.clinicId, t.id), unique().on(t.clinicId, t.demoMrn), unique().on(t.clinicId, t.seedKey),
  check("patients_demo_mrn_check", sql`${t.demoMrn} ~ '^DEMO-[0-9]{5}$'`),
  check("patients_sex_check", sql`${t.sex} IN ('female', 'male')`),
  check("patients_phone_check", sql`${t.phone} ~ ${"^(\\+1[- .]?)?(\\([2-9][0-9]{2}\\)[- .]?|[2-9][0-9]{2}[- .]?)?555[- .]?01[0-9]{2}$"}`),
  check("patients_care_status_check", sql`${t.careStatus} IN ('active', 'transferred_out')`),
  check("patients_is_synthetic_check", sql`${t.isSynthetic} = true`),
  foreignKey({ columns: [t.clinicId, t.primaryPhysicianId], foreignColumns: [memberships.clinicId, memberships.userId] }),
  index("patients_clinic_name_idx").on(t.clinicId, t.lastName, t.firstName),
]).enableRLS();

export const encounters = pgTable("encounters", {
  id: id(),
  clinicId: clinicId(),
  patientId: uuid("patient_id").notNull(),
  occurredAt: time("occurred_at").notNull(),
  encounterType: text("encounter_type", { enum: ["office_visit", "telehealth", "annual_exam", "urgent_visit"] }).notNull(),
  status: text("status", { enum: ["completed", "cancelled"] }).notNull().default("completed"),
  providerId: uuid("provider_id"),
  chiefComplaint: text("chief_complaint").notNull().default(""),
  assessment: text("assessment").notNull().default(""),
  plan: text("plan").notNull().default(""),
  followUpKind: text("follow_up_kind", { enum: ["interval", "as_needed", "none"] }).notNull().default("none"),
  followUpIntervalDays: integer("follow_up_interval_days"),
  seedKey: text("seed_key"),
}, (t) => [
  unique().on(t.clinicId, t.id), unique().on(t.clinicId, t.seedKey),
  check("encounters_encounter_type_check", sql`${t.encounterType} IN ('office_visit', 'telehealth', 'annual_exam', 'urgent_visit')`),
  check("encounters_status_check", sql`${t.status} IN ('completed', 'cancelled')`),
  check("encounters_follow_up_kind_check", sql`${t.followUpKind} IN ('interval', 'as_needed', 'none')`),
  check("encounters_follow_up_interval_days_check", sql`${t.followUpIntervalDays} > 0`),
  check("encounters_check", sql`${t.followUpKind} <> 'interval' OR ${t.followUpIntervalDays} IS NOT NULL`),
  foreignKey({ columns: [t.clinicId, t.patientId], foreignColumns: [patients.clinicId, patients.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.clinicId, t.providerId], foreignColumns: [memberships.clinicId, memberships.userId] }),
  index("encounters_patient_date_idx").on(t.clinicId, t.patientId, t.occurredAt),
]).enableRLS();

export const appointments = pgTable("appointments", {
  id: id(),
  clinicId: clinicId(),
  patientId: uuid("patient_id").notNull(),
  scheduledFor: time("scheduled_for").notNull(),
  purpose: text("purpose", { enum: ["follow_up", "lab_draw", "annual", "new_concern", "specialist"] }).notNull(),
  status: text("status", { enum: ["scheduled", "confirmed", "completed", "no_show", "cancelled_by_patient", "cancelled_by_clinic", "rescheduled"] }).notNull(),
  statusReason: text("status_reason"),
  originEncounterId: uuid("origin_encounter_id"),
  completedEncounterId: uuid("completed_encounter_id"),
  seedKey: text("seed_key"),
}, (t) => [
  unique().on(t.clinicId, t.id), unique().on(t.clinicId, t.seedKey),
  check("appointments_purpose_check", sql`${t.purpose} IN ('follow_up', 'lab_draw', 'annual', 'new_concern', 'specialist')`),
  check("appointments_status_check", sql`${t.status} IN ('scheduled', 'confirmed', 'completed', 'no_show', 'cancelled_by_patient', 'cancelled_by_clinic', 'rescheduled')`),
  foreignKey({ columns: [t.clinicId, t.patientId], foreignColumns: [patients.clinicId, patients.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.clinicId, t.originEncounterId], foreignColumns: [encounters.clinicId, encounters.id] }),
  foreignKey({ columns: [t.clinicId, t.completedEncounterId], foreignColumns: [encounters.clinicId, encounters.id] }),
  index("appointments_patient_date_idx").on(t.clinicId, t.patientId, t.scheduledFor),
]).enableRLS();

export const symptomObservations = pgTable("symptom_observations", {
  id: id(),
  clinicId: clinicId(),
  patientId: uuid("patient_id").notNull(),
  encounterId: uuid("encounter_id").notNull(),
  symptomCode: text("symptom_code").notNull(),
  label: text("label").notNull(),
  observedAt: time("observed_at").notNull(),
  status: text("status", { enum: ["active", "improving", "resolved", "chronic_managed"] }).notNull(),
  note: text("note"),
  seedKey: text("seed_key"),
}, (t) => [
  unique().on(t.clinicId, t.id), unique().on(t.clinicId, t.seedKey),
  check("symptom_observations_status_check", sql`${t.status} IN ('active', 'improving', 'resolved', 'chronic_managed')`),
  foreignKey({ columns: [t.clinicId, t.patientId], foreignColumns: [patients.clinicId, patients.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.clinicId, t.encounterId], foreignColumns: [encounters.clinicId, encounters.id] }).onDelete("cascade"),
  index("symptom_observations_patient_date_idx").on(t.clinicId, t.patientId, t.observedAt),
]).enableRLS();

export const labOrders = pgTable("lab_orders", {
  id: id(),
  clinicId: clinicId(),
  patientId: uuid("patient_id").notNull(),
  encounterId: uuid("encounter_id"),
  testName: text("test_name").notNull(),
  orderedAt: time("ordered_at").notNull(),
  expectedWithinDays: integer("expected_within_days").notNull(),
  status: text("status", { enum: ["ordered", "collected", "resulted", "cancelled"] }).notNull(),
  collectedAt: time("collected_at"),
  resultedAt: time("resulted_at"),
  resultSummary: text("result_summary"),
  statusReason: text("status_reason"),
  symptomCode: text("symptom_code"),
  seedKey: text("seed_key"),
}, (t) => [
  unique().on(t.clinicId, t.id), unique().on(t.clinicId, t.seedKey),
  check("lab_orders_expected_within_days_check", sql`${t.expectedWithinDays} >= 0`),
  check("lab_orders_status_check", sql`${t.status} IN ('ordered', 'collected', 'resulted', 'cancelled')`),
  foreignKey({ columns: [t.clinicId, t.patientId], foreignColumns: [patients.clinicId, patients.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.clinicId, t.encounterId], foreignColumns: [encounters.clinicId, encounters.id] }),
  index("lab_orders_patient_idx").on(t.clinicId, t.patientId),
]).enableRLS();

export const referrals = pgTable("referrals", {
  id: id(),
  clinicId: clinicId(),
  patientId: uuid("patient_id").notNull(),
  encounterId: uuid("encounter_id"),
  specialty: text("specialty").notNull(),
  reason: text("reason").notNull(),
  referredAt: time("referred_at").notNull(),
  expectedWithinDays: integer("expected_within_days").notNull(),
  status: text("status", { enum: ["sent", "scheduled", "seen", "records_received", "declined", "cancelled"] }).notNull(),
  specialistAppointmentAt: time("specialist_appointment_at"),
  recordsReceivedAt: time("records_received_at"),
  outcomeSummary: text("outcome_summary"),
  statusReason: text("status_reason"),
  symptomCode: text("symptom_code"),
  seedKey: text("seed_key"),
}, (t) => [
  unique().on(t.clinicId, t.id), unique().on(t.clinicId, t.seedKey),
  check("referrals_expected_within_days_check", sql`${t.expectedWithinDays} >= 0`),
  check("referrals_status_check", sql`${t.status} IN ('sent', 'scheduled', 'seen', 'records_received', 'declined', 'cancelled')`),
  foreignKey({ columns: [t.clinicId, t.patientId], foreignColumns: [patients.clinicId, patients.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.clinicId, t.encounterId], foreignColumns: [encounters.clinicId, encounters.id] }),
  index("referrals_patient_idx").on(t.clinicId, t.patientId),
]).enableRLS();

export const detectionRuns = pgTable("detection_runs", {
  id: id(),
  clinicId: clinicId(),
  provider: text("provider", { enum: ["rules", "llm"] }).notNull(),
  rulesVersion: text("rules_version").notNull(),
  asOf: time("as_of").notNull(),
  startedBy: uuid("started_by"),
  patientsEvaluated: integer("patients_evaluated").notNull(),
  findingsCount: integer("findings_count").notNull(),
  createdAt: createdAt(),
}, (t) => [
  unique().on(t.clinicId, t.id),
  check("detection_runs_provider_check", sql`${t.provider} IN ('rules', 'llm')`),
  check("detection_runs_patients_evaluated_check", sql`${t.patientsEvaluated} >= 0`),
  check("detection_runs_findings_count_check", sql`${t.findingsCount} >= 0`),
  foreignKey({ columns: [t.clinicId, t.startedBy], foreignColumns: [memberships.clinicId, memberships.userId] }),
]).enableRLS();

export const detectionFlags = pgTable("detection_flags", {
  id: id(),
  clinicId: clinicId(),
  patientId: uuid("patient_id").notNull(),
  ruleId: text("rule_id", { enum: ["overdue-follow-up", "lab-result-missing", "referral-outcome-missing", "persistent-symptom-unresolved"] }).notNull(),
  ruleVersion: text("rule_version").notNull(),
  fingerprint: text("fingerprint").notNull(),
  subjectType: text("subject_type", { enum: ["encounter", "lab_order", "referral", "symptom"] }).notNull(),
  subjectId: text("subject_id").notNull(),
  title: text("title").notNull(),
  rationale: text("rationale").notNull(),
  evidence: jsonb("evidence").$type<EvidenceRef[]>().notNull().default(sql`'[]'::jsonb`),
  missingInfo: jsonb("missing_info").$type<MissingInfo[]>().notNull().default(sql`'[]'::jsonb`),
  evidenceHash: text("evidence_hash").notNull(),
  status: text("status", { enum: ["open", "confirmed", "dismissed", "resolved_by_data", "suppressed"] }).notNull().default("open"),
  firstDetectedAt: time("first_detected_at").notNull().defaultNow(),
  lastDetectedAt: time("last_detected_at").notNull().defaultNow(),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: time("reviewed_at"),
  reviewNote: text("review_note"),
  reviewReason: text("review_reason", { enum: ["expected", "addressed_elsewhere", "not_clinically_relevant", "data_error", "other"] }),
  snoozedUntil: time("snoozed_until"),
  snoozedBy: uuid("snoozed_by"),
  snoozeNote: text("snooze_note"),
}, (t) => [
  unique().on(t.clinicId, t.id), unique().on(t.clinicId, t.fingerprint),
  check("detection_flags_rule_id_check", sql`${t.ruleId} IN ('overdue-follow-up', 'lab-result-missing', 'referral-outcome-missing', 'persistent-symptom-unresolved')`),
  check("detection_flags_subject_type_check", sql`${t.subjectType} IN ('encounter', 'lab_order', 'referral', 'symptom')`),
  check("detection_flags_evidence_check", sql`jsonb_typeof(${t.evidence}) = 'array'`),
  check("detection_flags_missing_info_check", sql`jsonb_typeof(${t.missingInfo}) = 'array'`),
  check("detection_flags_status_check", sql`${t.status} IN ('open', 'confirmed', 'dismissed', 'resolved_by_data', 'suppressed')`),
  check("detection_flags_review_reason_check", sql`${t.reviewReason} IN ('expected', 'addressed_elsewhere', 'not_clinically_relevant', 'data_error', 'other')`),
  foreignKey({ name: "detection_flags_snoozed_by_fkey", columns: [t.clinicId, t.snoozedBy], foreignColumns: [memberships.clinicId, memberships.userId] }),
  index("detection_flags_clinic_status_idx").on(t.clinicId, t.status, t.snoozedUntil),
  foreignKey({ columns: [t.clinicId, t.patientId], foreignColumns: [patients.clinicId, patients.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.clinicId, t.reviewedBy], foreignColumns: [memberships.clinicId, memberships.userId] }),
  index("detection_flags_patient_idx").on(t.clinicId, t.patientId),
]).enableRLS();

export const tasks = pgTable("tasks", {
  id: id(),
  clinicId: clinicId(),
  patientId: uuid("patient_id"),
  category: text("category", { enum: ["call_patient", "confirm_appointment", "request_records", "lab_follow_up", "admin_other", "clinical_review"] }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["pending", "in_progress", "completed", "needs_review"] }).notNull().default("pending"),
  assigneeId: uuid("assignee_id"),
  createdBy: uuid("created_by").notNull(),
  dueDate: time("due_date").notNull().default(sql`now() + interval '7 days'`),
  outcome: text("outcome"),
  completedAt: time("completed_at"),
  sourceFlagId: uuid("source_flag_id"),
  seedKey: text("seed_key"),
  createdAt: createdAt(),
  updatedAt: time("updated_at").notNull().defaultNow(),
}, (t) => [
  unique().on(t.clinicId, t.id), unique().on(t.clinicId, t.seedKey),
  check("tasks_category_check", sql`${t.category} IN ('call_patient', 'confirm_appointment', 'request_records', 'lab_follow_up', 'admin_other', 'clinical_review')`),
  check("tasks_status_check", sql`${t.status} IN ('pending', 'in_progress', 'completed', 'needs_review')`),
  foreignKey({ columns: [t.clinicId, t.patientId], foreignColumns: [patients.clinicId, patients.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.clinicId, t.assigneeId], foreignColumns: [memberships.clinicId, memberships.userId] }),
  foreignKey({ columns: [t.clinicId, t.createdBy], foreignColumns: [memberships.clinicId, memberships.userId] }),
  foreignKey({ columns: [t.clinicId, t.sourceFlagId], foreignColumns: [detectionFlags.clinicId, detectionFlags.id] }),
  uniqueIndex("tasks_one_open_per_flag").on(t.clinicId, t.sourceFlagId).where(sql`${t.sourceFlagId} IS NOT NULL AND ${t.status} <> 'completed'`),
  index("tasks_clinic_status_due_idx").on(t.clinicId, t.status, t.dueDate),
]).enableRLS();

export const flagFeedback = pgTable("flag_feedback", {
  id: id(),
  clinicId: clinicId(),
  flagId: uuid("flag_id").notNull(),
  userId: uuid("user_id").notNull(),
  verdict: text("verdict", { enum: ["accurate", "false_positive", "already_addressed", "not_useful"] }).notNull(),
  comment: text("comment"),
  createdAt: createdAt(),
}, (t) => [
  unique().on(t.clinicId, t.id),
  check("flag_feedback_verdict_check", sql`${t.verdict} IN ('accurate', 'false_positive', 'already_addressed', 'not_useful')`),
  foreignKey({ columns: [t.clinicId, t.flagId], foreignColumns: [detectionFlags.clinicId, detectionFlags.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.clinicId, t.userId], foreignColumns: [memberships.clinicId, memberships.userId] }),
]).enableRLS();

export const flagEvents = pgTable("flag_events", {
  id: id(),
  clinicId: clinicId(),
  flagId: uuid("flag_id").notNull(),
  eventType: text("event_type", { enum: ["created", "updated", "confirmed", "dismissed", "reopened", "reopened_evidence_changed", "resolved_by_data", "feedback", "snoozed", "unsnoozed", "suppressed"] }).notNull(),
  actorUserId: uuid("actor_user_id"),
  note: text("note"),
  createdAt: createdAt(),
}, (t) => [
  unique().on(t.clinicId, t.id),
  check("flag_events_event_type_check", sql`${t.eventType} IN ('created', 'updated', 'confirmed', 'dismissed', 'reopened', 'reopened_evidence_changed', 'resolved_by_data', 'feedback', 'snoozed', 'unsnoozed', 'suppressed')`),
  foreignKey({ columns: [t.clinicId, t.flagId], foreignColumns: [detectionFlags.clinicId, detectionFlags.id] }).onDelete("cascade"),
  foreignKey({ columns: [t.clinicId, t.actorUserId], foreignColumns: [memberships.clinicId, memberships.userId] }),
  index("flag_events_flag_date_idx").on(t.clinicId, t.flagId, t.createdAt),
]).enableRLS();

export const clinicRuleSettings = pgTable("clinic_rule_settings", {
  clinicId: uuid("clinic_id").primaryKey().references(() => clinics.id, { onDelete: "cascade" }),
  overdueGraceDays: integer("overdue_grace_days").notNull().default(14),
  labGraceDays: integer("lab_grace_days").notNull().default(7),
  referralSentGraceDays: integer("referral_sent_grace_days").notNull().default(14),
  referralRecordsDays: integer("referral_records_days").notNull().default(14),
  symptomMinEncounters: integer("symptom_min_encounters").notNull().default(2),
  symptomMinSpanDays: integer("symptom_min_span_days").notNull().default(28),
  disabledRules: text("disabled_rules").array().notNull().default(sql`'{}'`),
  updatedBy: uuid("updated_by"),
  updatedAt: time("updated_at").notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.clinicId, t.updatedBy], foreignColumns: [memberships.clinicId, memberships.userId] }),
]).enableRLS();

export const auditLogs = pgTable("audit_logs", {
  id: id(),
  clinicId: uuid("clinic_id").references(() => clinics.id, { onDelete: "set null" }),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  effectiveUserId: uuid("effective_user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  ipHash: text("ip_hash"),
  createdAt: createdAt(),
}, (t) => [unique().on(t.clinicId, t.id), index("audit_logs_clinic_date_idx").on(t.clinicId, t.createdAt)]).enableRLS();
