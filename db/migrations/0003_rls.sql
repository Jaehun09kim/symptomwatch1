CREATE FUNCTION app.current_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT m.role FROM public.memberships m
  WHERE m.clinic_id = app.current_clinic_id()
    AND m.user_id = app.current_user_id() AND m.status = 'active'
$$;

CREATE FUNCTION app.is_active_member(clinic uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.clinic_id = clinic AND m.user_id = app.current_user_id() AND m.status = 'active'
  )
$$;

REVOKE ALL ON FUNCTION app.current_role(), app.is_active_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_role(), app.is_active_member(uuid) TO sw_app;

-- RLS cannot compare OLD and NEW. This invoker trigger protects review fields
-- while allowing admins to refresh detection evidence on an already reviewed flag.
CREATE FUNCTION app.protect_flag_review() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user = 'sw_app' AND app.current_role() IS DISTINCT FROM 'physician' THEN
    IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      OR NEW.review_note IS DISTINCT FROM OLD.review_note
      OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('confirmed', 'dismissed')) THEN
      RAISE EXCEPTION 'Only physicians may review detection flags' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION app.protect_flag_review() FROM PUBLIC;
CREATE TRIGGER detection_flags_protect_review BEFORE UPDATE ON detection_flags
  FOR EACH ROW EXECUTE FUNCTION app.protect_flag_review();

-- Each command gets exactly one permissive policy with the complete predicate.
-- Denied commands retain an explicit false policy and receive no SQL grant.
DO $$
DECLARE
  table_name text;
  base text;
  clinical text := 'app.current_role() IN (''clinic_admin'', ''physician'')';
  admin text := 'app.current_role() = ''clinic_admin''';
  physician text := 'app.current_role() = ''physician''';
  read_condition text;
  insert_condition text;
  update_condition text;
  delete_condition text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'clinics', 'memberships', 'invitations', 'patients', 'encounters',
    'appointments', 'symptom_observations', 'lab_orders', 'referrals',
    'tasks', 'detection_runs', 'detection_flags', 'flag_feedback', 'flag_events', 'audit_logs'
  ] LOOP
    base := CASE WHEN table_name = 'clinics'
      THEN 'id = app.current_clinic_id() AND app.is_active_member(id)'
      ELSE 'clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id)' END;
    read_condition := base;
    insert_condition := base || ' AND false';
    update_condition := base || ' AND false';
    delete_condition := base || ' AND false';

    CASE table_name
      WHEN 'clinics' THEN
        update_condition := base || ' AND ' || admin;
      WHEN 'memberships', 'invitations' THEN
        insert_condition := base || ' AND ' || admin;
        update_condition := base || ' AND ' || admin;
        delete_condition := base || ' AND ' || admin;
      WHEN 'encounters', 'symptom_observations' THEN
        read_condition := base || ' AND ' || clinical;
      WHEN 'appointments' THEN
        insert_condition := base;
        update_condition := base;
      WHEN 'referrals' THEN
        update_condition := base;
      WHEN 'lab_orders' THEN
        read_condition := base || ' AND ' || clinical;
        update_condition := base || ' AND ' || physician;
      WHEN 'tasks' THEN
        read_condition := base || ' AND (category <> ''clinical_review'' OR ' || clinical || ')';
        insert_condition := base || ' AND (category <> ''clinical_review'' OR ' || physician || ')';
        update_condition := insert_condition;
      WHEN 'detection_runs' THEN
        read_condition := base || ' AND ' || clinical;
        insert_condition := read_condition;
      WHEN 'detection_flags' THEN
        read_condition := base || ' AND ' || clinical;
        insert_condition := read_condition || ' AND (' || physician ||
          ' OR (status IN (''open'', ''resolved_by_data'') AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_note IS NULL))';
        update_condition := read_condition;
      WHEN 'flag_feedback' THEN
        read_condition := base || ' AND ' || clinical;
        insert_condition := base || ' AND ' || physician;
      WHEN 'flag_events' THEN
        read_condition := base || ' AND ' || clinical;
        insert_condition := read_condition || ' AND (event_type NOT IN (''confirmed'', ''dismissed'', ''feedback'') OR ' || physician || ')';
      WHEN 'audit_logs' THEN
        read_condition := base || ' AND ' || admin;
        insert_condition := base;
      ELSE NULL;
    END CASE;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO sw_app USING (%s)', table_name || '_select', table_name, read_condition);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO sw_app WITH CHECK (%s)', table_name || '_insert', table_name, insert_condition);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO sw_app USING (%s) WITH CHECK (%s)', table_name || '_update', table_name, update_condition, update_condition);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO sw_app USING (%s)', table_name || '_delete', table_name, delete_condition);
  END LOOP;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, sw_app;
GRANT SELECT ON clinics, memberships, invitations, patients, encounters, appointments,
  symptom_observations, lab_orders, referrals, tasks, detection_runs, detection_flags,
  flag_feedback, flag_events, audit_logs TO sw_app;
GRANT UPDATE (name) ON clinics TO sw_app;
GRANT INSERT, UPDATE, DELETE ON memberships, invitations TO sw_app;
GRANT INSERT ON appointments, tasks, detection_runs, detection_flags, flag_feedback, flag_events, audit_logs TO sw_app;
GRANT UPDATE (scheduled_for, purpose, status, status_reason, origin_encounter_id, completed_encounter_id) ON appointments TO sw_app;
GRANT UPDATE (status, specialist_appointment_at, records_received_at, status_reason) ON referrals TO sw_app;
GRANT UPDATE (status, collected_at, resulted_at, result_summary, status_reason) ON lab_orders TO sw_app;
GRANT UPDATE (patient_id, category, title, description, status, assignee_id, due_date, outcome, completed_at, source_flag_id, updated_at) ON tasks TO sw_app;
GRANT UPDATE (rule_version, title, rationale, evidence, missing_info, evidence_hash, status, last_detected_at, reviewed_by, reviewed_at, review_note) ON detection_flags TO sw_app;

-- Supabase's Data API roles must not inherit its default grants on these tables.
-- Role-existence guards keep these identical migrations portable to PGlite.
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON SCHEMA app FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM %I', api_role);
      EXECUTE format('REVOKE sw_app FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;
