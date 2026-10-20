-- Onboarding M1 review fixes (Codex): enforce the membership invariants in the
-- database, not only in services.
--  * The tenant path can no longer delete memberships (disable instead). This also
--    closes "delete my row and re-insert it as physician + manager" in one statement,
--    which bypassed the UPDATE-only self-change trigger from 0009.
--  * Tenant inserts can't add yourself and can't grant management.
--  * Tenant updates can't change whose membership a row is, can't change your own
--    role / manager flag / status, and can't leave a clinic without an active human
--    (non-placeholder) manager. Removals serialize per clinic.

DROP POLICY memberships_delete ON memberships;
CREATE POLICY memberships_delete ON memberships FOR DELETE TO sw_app
  USING (clinic_id = app.current_clinic_id() AND false);
REVOKE DELETE ON memberships FROM sw_app;

-- True when removing `losing_user`'s management would leave no active human manager.
-- VOLATILE so the count runs on a fresh snapshot after the per-clinic lock is taken.
CREATE FUNCTION app.would_orphan_clinic(clinic uuid, losing_user uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT NOT (SELECT u.is_placeholder FROM public.users u WHERE u.id = losing_user)
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships m JOIN public.users u ON u.id = m.user_id
      WHERE m.clinic_id = clinic AND m.user_id <> losing_user
        AND m.status = 'active' AND m.can_manage AND NOT u.is_placeholder
    )
$$;
REVOKE ALL ON FUNCTION app.would_orphan_clinic(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.would_orphan_clinic(uuid, uuid) TO sw_app;

-- SECURITY INVOKER on purpose: `current_user` must still be the caller's role.
CREATE FUNCTION app.guard_membership_change() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user <> 'sw_app' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id = app.current_user_id() THEN
      RAISE EXCEPTION 'You can''t change your own access. Ask another manager.';
    END IF;
    IF NEW.can_manage THEN
      RAISE EXCEPTION 'New members start without manager access.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'A membership can''t be moved to another person or clinic.';
  END IF;
  IF OLD.user_id = app.current_user_id()
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.can_manage IS DISTINCT FROM OLD.can_manage OR NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'You can''t change your own access. Ask another manager.';
  END IF;
  IF OLD.can_manage AND OLD.status = 'active' AND NOT (NEW.can_manage AND NEW.status = 'active') THEN
    PERFORM pg_advisory_xact_lock(hashtext('memberships:' || OLD.clinic_id::text));
    IF app.would_orphan_clinic(OLD.clinic_id, OLD.user_id) THEN
      RAISE EXCEPTION 'A clinic needs at least one active manager.';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION app.guard_membership_change() FROM PUBLIC;

DROP TRIGGER memberships_protect_self ON memberships;
CREATE TRIGGER memberships_guard BEFORE INSERT OR UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION app.guard_membership_change();

DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION app.would_orphan_clinic(uuid, uuid) FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON FUNCTION app.guard_membership_change() FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;
