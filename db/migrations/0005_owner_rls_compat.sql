-- Hosted-Postgres compatibility (e.g. Supabase, where the connection user may
-- not be a superuser). FORCE ROW LEVEL SECURITY only affects the table OWNER;
-- the tenant role sw_app is never the owner, so RLS applies to it either way.
-- If the owner cannot bypass RLS, FORCE would block the trusted system path
-- (sign-in, seeding, detection jobs), so it is relaxed for the owner only.
DO $$
DECLARE
  can_bypass boolean;
  table_name text;
BEGIN
  SELECT rolsuper OR rolbypassrls INTO can_bypass FROM pg_roles WHERE rolname = current_user;
  IF NOT can_bypass THEN
    FOREACH table_name IN ARRAY ARRAY[
      'clinics', 'memberships', 'invitations', 'patients', 'encounters',
      'appointments', 'symptom_observations', 'lab_orders', 'referrals',
      'tasks', 'detection_runs', 'detection_flags', 'flag_feedback', 'flag_events',
      'audit_logs', 'users'
    ] LOOP
      EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', table_name);
    END LOOP;
  END IF;
END
$$;
