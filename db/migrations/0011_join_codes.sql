-- Onboarding M2: join codes, join requests, email verification, clinical-access grants.
-- Managers create 90-second role codes on the tenant path. Applicants have no
-- membership yet, so join transactions and verifications are system-path only
-- (no sw_app grants). Codes and tokens are stored only as keyed hashes.

ALTER TABLE users ADD COLUMN email_verified_at timestamptz;

ALTER TABLE outbox_messages DROP CONSTRAINT outbox_messages_kind_check;
ALTER TABLE outbox_messages ADD CONSTRAINT outbox_messages_kind_check
  CHECK (kind IN ('invitation', 'password_reset', 'email_verification'));

CREATE TABLE join_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('clinic_admin', 'physician', 'staff')),
  approval_mode text NOT NULL DEFAULT 'approve' CHECK (approval_mode IN ('approve', 'instant')),
  code_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 seconds'),
  revoked_at timestamptz,
  UNIQUE (clinic_id, id),
  FOREIGN KEY (clinic_id, created_by) REFERENCES memberships(clinic_id, user_id)
);
CREATE INDEX join_codes_clinic_idx ON join_codes(clinic_id, created_at);

CREATE TABLE join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_role text NOT NULL CHECK (requested_role IN ('clinic_admin', 'physician', 'staff')),
  join_code_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn')),
  decided_by uuid REFERENCES users(id),
  decided_role text CHECK (decided_role IN ('clinic_admin', 'physician', 'staff')),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, id),
  FOREIGN KEY (clinic_id, join_code_id) REFERENCES join_codes(clinic_id, id)
);
CREATE UNIQUE INDEX join_requests_one_pending ON join_requests(clinic_id, user_id) WHERE status = 'pending';

CREATE TABLE join_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  join_code_id uuid NOT NULL,
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('clinic_admin', 'physician', 'staff')),
  approval_mode text NOT NULL CHECK (approval_mode IN ('approve', 'instant')),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  FOREIGN KEY (clinic_id, join_code_id) REFERENCES join_codes(clinic_id, id)
);

CREATE TABLE email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  join_transaction_id uuid REFERENCES join_transactions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE clinical_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('clinic_admin', 'physician', 'staff')),
  granted_by uuid REFERENCES users(id),
  via text NOT NULL CHECK (via IN ('role_change', 'join')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clinical_access_grants_clinic_idx ON clinical_access_grants(clinic_id, created_at);

-- Row-level security.
DO $$
DECLARE
  table_name text;
  base text := 'clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id)';
  manage text := 'clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id) AND app.current_can_manage()';
BEGIN
  FOREACH table_name IN ARRAY ARRAY['join_codes', 'join_requests', 'join_transactions', 'email_verifications', 'clinical_access_grants'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;

  EXECUTE format('CREATE POLICY join_codes_select ON join_codes FOR SELECT TO sw_app USING (%s)', manage);
  EXECUTE format('CREATE POLICY join_codes_insert ON join_codes FOR INSERT TO sw_app WITH CHECK (%s AND created_by = app.current_user_id())', manage);
  EXECUTE format('CREATE POLICY join_codes_update ON join_codes FOR UPDATE TO sw_app USING (%s) WITH CHECK (%s)', manage, manage);
  EXECUTE format('CREATE POLICY join_codes_delete ON join_codes FOR DELETE TO sw_app USING (%s AND false)', base);

  EXECUTE format('CREATE POLICY join_requests_select ON join_requests FOR SELECT TO sw_app USING (%s)', manage);
  EXECUTE format('CREATE POLICY join_requests_insert ON join_requests FOR INSERT TO sw_app WITH CHECK (%s AND false)', base);
  EXECUTE format('CREATE POLICY join_requests_update ON join_requests FOR UPDATE TO sw_app USING (%s) WITH CHECK (%s)', manage, manage);
  EXECUTE format('CREATE POLICY join_requests_delete ON join_requests FOR DELETE TO sw_app USING (%s AND false)', base);

  EXECUTE format('CREATE POLICY clinical_access_grants_select ON clinical_access_grants FOR SELECT TO sw_app USING (%s)', base);
  EXECUTE format('CREATE POLICY clinical_access_grants_insert ON clinical_access_grants FOR INSERT TO sw_app WITH CHECK (%s)', manage);
  EXECUTE format('CREATE POLICY clinical_access_grants_update ON clinical_access_grants FOR UPDATE TO sw_app USING (%s AND false) WITH CHECK (%s AND false)', base, base);
  EXECUTE format('CREATE POLICY clinical_access_grants_delete ON clinical_access_grants FOR DELETE TO sw_app USING (%s AND false)', base);
END
$$;

-- Managers may see who asked to join their clinic (name, email, verified) — not other users.
DROP POLICY users_select ON users;
CREATE POLICY users_select ON public.users FOR SELECT TO sw_app USING (
  app.is_active_member(app.current_clinic_id())
  AND (
    EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = users.id AND m.clinic_id = app.current_clinic_id())
    OR (app.current_can_manage() AND EXISTS (
      SELECT 1 FROM public.join_requests jr WHERE jr.user_id = users.id AND jr.clinic_id = app.current_clinic_id()))
  )
);

GRANT SELECT, INSERT ON join_codes TO sw_app;
GRANT UPDATE (revoked_at) ON join_codes TO sw_app;
GRANT SELECT ON join_requests TO sw_app;
GRANT UPDATE (status, decided_by, decided_role, decided_at) ON join_requests TO sw_app;
GRANT SELECT, INSERT ON clinical_access_grants TO sw_app;
GRANT SELECT (email_verified_at) ON users TO sw_app;
-- join_transactions and email_verifications: no sw_app grants (system path only).

DO $$
DECLARE
  api_role text;
  table_name text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      FOREACH table_name IN ARRAY ARRAY['join_codes', 'join_requests', 'join_transactions', 'email_verifications', 'clinical_access_grants'] LOOP
        EXECUTE format('REVOKE ALL ON public.%I FROM %I', table_name, api_role);
      END LOOP;
    END IF;
  END LOOP;
  IF NOT (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
    FOREACH table_name IN ARRAY ARRAY['join_codes', 'join_requests', 'join_transactions', 'email_verifications', 'clinical_access_grants'] LOOP
      EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', table_name);
    END LOOP;
  END IF;
END
$$;
