CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sw_app') THEN
    CREATE ROLE sw_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;
ALTER ROLE sw_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

-- The connection owner alone can enter the restricted application role.
DO $$
BEGIN
  EXECUTE format('GRANT sw_app TO %I', current_user);
END
$$;

CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app, public TO sw_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE
SET search_path = pg_catalog, public
AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE FUNCTION app.current_clinic_id() RETURNS uuid
LANGUAGE sql STABLE
SET search_path = pg_catalog, public
AS $$ SELECT nullif(current_setting('app.clinic_id', true), '')::uuid $$;

REVOKE ALL ON FUNCTION app.current_user_id(), app.current_clinic_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_user_id(), app.current_clinic_id() TO sw_app;
