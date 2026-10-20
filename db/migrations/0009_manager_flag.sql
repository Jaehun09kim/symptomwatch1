-- Onboarding M1: separate "manages the clinic" from the job role.
-- Staff management, the audit log and clinic settings are gated by a per-membership
-- manager flag read server-side (never from a GUC or the client). Existing clinic
-- admins keep management. Policies are dropped and recreated under the same names:
-- permissive policies OR together, so adding new ones beside the old would keep
-- the old access.

ALTER TABLE memberships ADD COLUMN can_manage boolean NOT NULL DEFAULT false;
UPDATE memberships SET can_manage = true WHERE role = 'clinic_admin';

CREATE FUNCTION app.current_can_manage() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE((
    SELECT m.can_manage FROM public.memberships m
    WHERE m.clinic_id = app.current_clinic_id()
      AND m.user_id = app.current_user_id() AND m.status = 'active'
  ), false)
$$;
REVOKE ALL ON FUNCTION app.current_can_manage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_can_manage() TO sw_app;

DROP POLICY clinics_update ON clinics;
CREATE POLICY clinics_update ON clinics FOR UPDATE TO sw_app
  USING (id = app.current_clinic_id() AND app.is_active_member(id) AND app.current_can_manage())
  WITH CHECK (id = app.current_clinic_id() AND app.is_active_member(id) AND app.current_can_manage());

DO $$
DECLARE
  table_name text;
  manage text := 'clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id) AND app.current_can_manage()';
BEGIN
  FOREACH table_name IN ARRAY ARRAY['memberships', 'invitations'] LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', table_name || '_insert', table_name);
    EXECUTE format('DROP POLICY %I ON public.%I', table_name || '_update', table_name);
    EXECUTE format('DROP POLICY %I ON public.%I', table_name || '_delete', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO sw_app WITH CHECK (%s)', table_name || '_insert', table_name, manage);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO sw_app USING (%s) WITH CHECK (%s)', table_name || '_update', table_name, manage, manage);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO sw_app USING (%s)', table_name || '_delete', table_name, manage);
  END LOOP;
END
$$;

DROP POLICY audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT TO sw_app
  USING (clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id) AND app.current_can_manage());

-- Defense in depth: nobody changes their own job role or manager flag on the tenant path.
CREATE FUNCTION app.protect_membership_self() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user = 'sw_app' AND OLD.user_id = app.current_user_id()
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.can_manage IS DISTINCT FROM OLD.can_manage) THEN
    RAISE EXCEPTION 'You can''t change your own access. Ask another manager.';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION app.protect_membership_self() FROM PUBLIC;
CREATE TRIGGER memberships_protect_self BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION app.protect_membership_self();

DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION app.current_can_manage() FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON FUNCTION app.protect_membership_self() FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;
