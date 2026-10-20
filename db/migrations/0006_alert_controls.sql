-- v0.2 alert-fatigue controls: snooze, structured dismissal reasons,
-- per-clinic rule settings, and a 'suppressed' status for flags whose rule a
-- clinic has turned off. Review-like fields stay physician-only (trigger below).

ALTER TABLE detection_flags
  ADD COLUMN snoozed_until timestamptz,
  ADD COLUMN snoozed_by uuid,
  ADD COLUMN snooze_note text,
  ADD COLUMN review_reason text CHECK (review_reason IN ('expected', 'addressed_elsewhere', 'not_clinically_relevant', 'data_error', 'other')),
  ADD CONSTRAINT detection_flags_snoozed_by_fkey FOREIGN KEY (clinic_id, snoozed_by) REFERENCES memberships(clinic_id, user_id);

ALTER TABLE detection_flags DROP CONSTRAINT detection_flags_status_check;
ALTER TABLE detection_flags ADD CONSTRAINT detection_flags_status_check
  CHECK (status IN ('open', 'confirmed', 'dismissed', 'resolved_by_data', 'suppressed'));

ALTER TABLE flag_events DROP CONSTRAINT flag_events_event_type_check;
ALTER TABLE flag_events ADD CONSTRAINT flag_events_event_type_check
  CHECK (event_type IN ('created', 'updated', 'confirmed', 'dismissed', 'reopened', 'reopened_evidence_changed',
    'resolved_by_data', 'feedback', 'snoozed', 'unsnoozed', 'suppressed'));

-- Absent row = engine defaults (DEFAULT_RULE_CONFIG). Bounds keep tuning sane.
CREATE TABLE clinic_rule_settings (
  clinic_id uuid PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
  overdue_grace_days integer NOT NULL DEFAULT 14 CHECK (overdue_grace_days BETWEEN 0 AND 60),
  lab_grace_days integer NOT NULL DEFAULT 7 CHECK (lab_grace_days BETWEEN 0 AND 60),
  referral_sent_grace_days integer NOT NULL DEFAULT 14 CHECK (referral_sent_grace_days BETWEEN 0 AND 90),
  referral_records_days integer NOT NULL DEFAULT 14 CHECK (referral_records_days BETWEEN 0 AND 90),
  symptom_min_encounters integer NOT NULL DEFAULT 2 CHECK (symptom_min_encounters BETWEEN 2 AND 6),
  symptom_min_span_days integer NOT NULL DEFAULT 28 CHECK (symptom_min_span_days BETWEEN 0 AND 180),
  disabled_rules text[] NOT NULL DEFAULT '{}' CHECK (disabled_rules <@ ARRAY[
    'overdue-follow-up', 'lab-result-missing', 'referral-outcome-missing', 'persistent-symptom-unresolved']::text[]),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (clinic_id, updated_by) REFERENCES memberships(clinic_id, user_id)
);

-- Non-physicians (admins running detection) may clear a snooze when evidence
-- changes, but may not set one or touch any review field.
CREATE OR REPLACE FUNCTION app.protect_flag_review() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user = 'sw_app' AND app.current_role() IS DISTINCT FROM 'physician' THEN
    IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      OR NEW.review_note IS DISTINCT FROM OLD.review_note
      OR NEW.review_reason IS DISTINCT FROM OLD.review_reason
      OR (NEW.snoozed_until IS NOT NULL AND NEW.snoozed_until IS DISTINCT FROM OLD.snoozed_until)
      OR (NEW.snoozed_by IS NOT NULL AND NEW.snoozed_by IS DISTINCT FROM OLD.snoozed_by)
      OR (NEW.snooze_note IS NOT NULL AND NEW.snooze_note IS DISTINCT FROM OLD.snooze_note)
      OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('confirmed', 'dismissed')) THEN
      RAISE EXCEPTION 'Only physicians may review detection flags' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP POLICY flag_events_insert ON flag_events;
CREATE POLICY flag_events_insert ON flag_events FOR INSERT TO sw_app WITH CHECK (
  clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id)
  AND app.current_role() IN ('clinic_admin', 'physician')
  AND (event_type NOT IN ('confirmed', 'dismissed', 'feedback', 'snoozed') OR app.current_role() = 'physician')
);

ALTER TABLE clinic_rule_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_rule_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_rule_settings_select ON clinic_rule_settings FOR SELECT TO sw_app USING (
  clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id) AND app.current_role() IN ('clinic_admin', 'physician'));
CREATE POLICY clinic_rule_settings_insert ON clinic_rule_settings FOR INSERT TO sw_app WITH CHECK (
  clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id) AND app.current_role() = 'physician');
CREATE POLICY clinic_rule_settings_update ON clinic_rule_settings FOR UPDATE TO sw_app
  USING (clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id) AND app.current_role() = 'physician')
  WITH CHECK (clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id) AND app.current_role() = 'physician');
CREATE POLICY clinic_rule_settings_delete ON clinic_rule_settings FOR DELETE TO sw_app USING (
  clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id) AND false);

GRANT SELECT, INSERT ON clinic_rule_settings TO sw_app;
GRANT UPDATE (overdue_grace_days, lab_grace_days, referral_sent_grace_days, referral_records_days,
  symptom_min_encounters, symptom_min_span_days, disabled_rules, updated_by, updated_at) ON clinic_rule_settings TO sw_app;
GRANT UPDATE (snoozed_until, snoozed_by, snooze_note, review_reason) ON detection_flags TO sw_app;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON clinic_rule_settings FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON clinic_rule_settings FROM authenticated; END IF;
END
$$;

CREATE INDEX detection_flags_clinic_status_idx ON detection_flags(clinic_id, status, snoozed_until);

-- Same hosted-Postgres owner compatibility as 0005, for the new table.
DO $$
BEGIN
  IF NOT (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
    ALTER TABLE public.clinic_rule_settings NO FORCE ROW LEVEL SECURITY;
  END IF;
END
$$;
