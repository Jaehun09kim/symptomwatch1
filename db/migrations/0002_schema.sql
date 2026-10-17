CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text,
  auth_subject text UNIQUE,
  is_placeholder boolean NOT NULL DEFAULT false,
  seed_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_sandbox boolean NOT NULL DEFAULT false,
  owner_user_id uuid REFERENCES users(id),
  expires_at timestamptz,
  seed_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  active_clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE outbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email citext NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('invitation', 'password_reset')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email citext NOT NULL,
  clinic_name text NOT NULL,
  role text NOT NULL,
  clinic_size text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('clinic_admin', 'physician', 'staff')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  seed_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, id),
  UNIQUE (clinic_id, user_id),
  UNIQUE (clinic_id, seed_key)
);

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  email citext NOT NULL,
  role text NOT NULL CHECK (role IN ('clinic_admin', 'physician', 'staff')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  UNIQUE (clinic_id, id),
  FOREIGN KEY (clinic_id, invited_by) REFERENCES memberships(clinic_id, user_id)
);

CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  demo_mrn text NOT NULL CHECK (demo_mrn ~ '^DEMO-[0-9]{5}$'),
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  sex text NOT NULL CHECK (sex IN ('female', 'male')),
  phone text NOT NULL CHECK (phone ~ '^(\+1[- .]?)?(\([2-9][0-9]{2}\)[- .]?|[2-9][0-9]{2}[- .]?)?555[- .]?01[0-9]{2}$'),
  primary_physician_id uuid,
  care_status text NOT NULL DEFAULT 'active' CHECK (care_status IN ('active', 'transferred_out')),
  is_synthetic boolean NOT NULL DEFAULT true CHECK (is_synthetic = true),
  seed_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, id),
  UNIQUE (clinic_id, demo_mrn),
  UNIQUE (clinic_id, seed_key),
  FOREIGN KEY (clinic_id, primary_physician_id) REFERENCES memberships(clinic_id, user_id)
);

CREATE TABLE encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  encounter_type text NOT NULL CHECK (encounter_type IN ('office_visit', 'telehealth', 'annual_exam', 'urgent_visit')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
  provider_id uuid,
  chief_complaint text NOT NULL DEFAULT '',
  assessment text NOT NULL DEFAULT '',
  plan text NOT NULL DEFAULT '',
  follow_up_kind text NOT NULL DEFAULT 'none' CHECK (follow_up_kind IN ('interval', 'as_needed', 'none')),
  follow_up_interval_days integer CHECK (follow_up_interval_days > 0),
  seed_key text,
  UNIQUE (clinic_id, id),
  UNIQUE (clinic_id, seed_key),
  CHECK (follow_up_kind <> 'interval' OR follow_up_interval_days IS NOT NULL),
  FOREIGN KEY (clinic_id, patient_id) REFERENCES patients(clinic_id, id) ON DELETE CASCADE,
  FOREIGN KEY (clinic_id, provider_id) REFERENCES memberships(clinic_id, user_id)
);

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  scheduled_for timestamptz NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('follow_up', 'lab_draw', 'annual', 'new_concern', 'specialist')),
  status text NOT NULL CHECK (status IN ('scheduled', 'confirmed', 'completed', 'no_show', 'cancelled_by_patient', 'cancelled_by_clinic', 'rescheduled')),
  status_reason text,
  origin_encounter_id uuid,
  completed_encounter_id uuid,
  seed_key text,
  UNIQUE (clinic_id, id),
  UNIQUE (clinic_id, seed_key),
  FOREIGN KEY (clinic_id, patient_id) REFERENCES patients(clinic_id, id) ON DELETE CASCADE,
  FOREIGN KEY (clinic_id, origin_encounter_id) REFERENCES encounters(clinic_id, id),
  FOREIGN KEY (clinic_id, completed_encounter_id) REFERENCES encounters(clinic_id, id)
);

CREATE TABLE symptom_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  encounter_id uuid NOT NULL,
  symptom_code text NOT NULL,
  label text NOT NULL,
  observed_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'improving', 'resolved', 'chronic_managed')),
  note text,
  seed_key text,
  UNIQUE (clinic_id, id),
  UNIQUE (clinic_id, seed_key),
  FOREIGN KEY (clinic_id, patient_id) REFERENCES patients(clinic_id, id) ON DELETE CASCADE,
  FOREIGN KEY (clinic_id, encounter_id) REFERENCES encounters(clinic_id, id) ON DELETE CASCADE
);

CREATE TABLE lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  encounter_id uuid,
  test_name text NOT NULL,
  ordered_at timestamptz NOT NULL,
  expected_within_days integer NOT NULL CHECK (expected_within_days >= 0),
  status text NOT NULL CHECK (status IN ('ordered', 'collected', 'resulted', 'cancelled')),
  collected_at timestamptz,
  resulted_at timestamptz,
  result_summary text,
  status_reason text,
  symptom_code text,
  seed_key text,
  UNIQUE (clinic_id, id),
  UNIQUE (clinic_id, seed_key),
  FOREIGN KEY (clinic_id, patient_id) REFERENCES patients(clinic_id, id) ON DELETE CASCADE,
  FOREIGN KEY (clinic_id, encounter_id) REFERENCES encounters(clinic_id, id)
);

CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  encounter_id uuid,
  specialty text NOT NULL,
  reason text NOT NULL,
  referred_at timestamptz NOT NULL,
  expected_within_days integer NOT NULL CHECK (expected_within_days >= 0),
  status text NOT NULL CHECK (status IN ('sent', 'scheduled', 'seen', 'records_received', 'declined', 'cancelled')),
  specialist_appointment_at timestamptz,
  records_received_at timestamptz,
  outcome_summary text,
  status_reason text,
  symptom_code text,
  seed_key text,
  UNIQUE (clinic_id, id),
  UNIQUE (clinic_id, seed_key),
  FOREIGN KEY (clinic_id, patient_id) REFERENCES patients(clinic_id, id) ON DELETE CASCADE,
  FOREIGN KEY (clinic_id, encounter_id) REFERENCES encounters(clinic_id, id)
);

CREATE TABLE detection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('rules', 'llm')),
  rules_version text NOT NULL,
  as_of timestamptz NOT NULL,
  started_by uuid,
  patients_evaluated integer NOT NULL CHECK (patients_evaluated >= 0),
  findings_count integer NOT NULL CHECK (findings_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, id),
  FOREIGN KEY (clinic_id, started_by) REFERENCES memberships(clinic_id, user_id)
);

CREATE TABLE detection_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  rule_id text NOT NULL CHECK (rule_id IN ('overdue-follow-up', 'lab-result-missing', 'referral-outcome-missing', 'persistent-symptom-unresolved')),
  rule_version text NOT NULL,
  fingerprint text NOT NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('encounter', 'lab_order', 'referral', 'symptom')),
  subject_id text NOT NULL,
  title text NOT NULL,
  rationale text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence) = 'array'),
  missing_info jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(missing_info) = 'array'),
  evidence_hash text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'dismissed', 'resolved_by_data')),
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  UNIQUE (clinic_id, id),
  UNIQUE (clinic_id, fingerprint),
  FOREIGN KEY (clinic_id, patient_id) REFERENCES patients(clinic_id, id) ON DELETE CASCADE,
  FOREIGN KEY (clinic_id, reviewed_by) REFERENCES memberships(clinic_id, user_id)
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid,
  category text NOT NULL CHECK (category IN ('call_patient', 'confirm_appointment', 'request_records', 'lab_follow_up', 'admin_other', 'clinical_review')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'needs_review')),
  assignee_id uuid,
  created_by uuid NOT NULL,
  due_date timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  outcome text,
  completed_at timestamptz,
  source_flag_id uuid,
  seed_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, id),
  UNIQUE (clinic_id, seed_key),
  FOREIGN KEY (clinic_id, patient_id) REFERENCES patients(clinic_id, id) ON DELETE CASCADE,
  FOREIGN KEY (clinic_id, assignee_id) REFERENCES memberships(clinic_id, user_id),
  FOREIGN KEY (clinic_id, created_by) REFERENCES memberships(clinic_id, user_id),
  FOREIGN KEY (clinic_id, source_flag_id) REFERENCES detection_flags(clinic_id, id)
);
CREATE UNIQUE INDEX tasks_one_open_per_flag ON tasks(clinic_id, source_flag_id)
  WHERE source_flag_id IS NOT NULL AND status <> 'completed';

CREATE TABLE flag_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  flag_id uuid NOT NULL,
  user_id uuid NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('accurate', 'false_positive', 'already_addressed', 'not_useful')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, id),
  FOREIGN KEY (clinic_id, flag_id) REFERENCES detection_flags(clinic_id, id) ON DELETE CASCADE,
  FOREIGN KEY (clinic_id, user_id) REFERENCES memberships(clinic_id, user_id)
);

CREATE TABLE flag_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  flag_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('created', 'updated', 'confirmed', 'dismissed', 'reopened', 'reopened_evidence_changed', 'resolved_by_data', 'feedback')),
  actor_user_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, id),
  FOREIGN KEY (clinic_id, flag_id) REFERENCES detection_flags(clinic_id, id) ON DELETE CASCADE,
  FOREIGN KEY (clinic_id, actor_user_id) REFERENCES memberships(clinic_id, user_id)
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Keep the audit history when a sandbox is purged; resets never delete it.
  clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id),
  effective_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, id)
);

CREATE INDEX patients_clinic_name_idx ON patients(clinic_id, last_name, first_name);
CREATE INDEX encounters_patient_date_idx ON encounters(clinic_id, patient_id, occurred_at);
CREATE INDEX appointments_patient_date_idx ON appointments(clinic_id, patient_id, scheduled_for);
CREATE INDEX symptom_observations_patient_date_idx ON symptom_observations(clinic_id, patient_id, observed_at);
CREATE INDEX lab_orders_patient_idx ON lab_orders(clinic_id, patient_id);
CREATE INDEX referrals_patient_idx ON referrals(clinic_id, patient_id);
CREATE INDEX tasks_clinic_status_due_idx ON tasks(clinic_id, status, due_date);
CREATE INDEX detection_flags_patient_idx ON detection_flags(clinic_id, patient_id);
CREATE INDEX flag_events_flag_date_idx ON flag_events(clinic_id, flag_id, created_at);
CREATE INDEX audit_logs_clinic_date_idx ON audit_logs(clinic_id, created_at);
CREATE INDEX clinics_sandbox_expiry_idx ON clinics(expires_at) WHERE is_sandbox;
