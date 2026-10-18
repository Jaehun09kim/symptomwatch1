-- v0.2 CSV import of EHR-style report exports (lab orders and referrals).
-- Imports run on the tenant path as a clinic admin or physician; every batch
-- is recorded, and imported rows remember their batch and the source system's
-- order/referral id so re-importing the same export updates instead of duplicating.

CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('lab_orders', 'referrals')),
  filename text NOT NULL CHECK (length(filename) <= 200),
  row_count integer NOT NULL CHECK (row_count >= 0),
  created_count integer NOT NULL CHECK (created_count >= 0),
  updated_count integer NOT NULL CHECK (updated_count >= 0),
  unchanged_count integer NOT NULL CHECK (unchanged_count >= 0),
  error_count integer NOT NULL CHECK (error_count >= 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, id),
  FOREIGN KEY (clinic_id, created_by) REFERENCES memberships(clinic_id, user_id)
);
CREATE INDEX import_batches_clinic_date_idx ON import_batches(clinic_id, created_at);

ALTER TABLE lab_orders
  ADD COLUMN external_ref text CHECK (length(external_ref) <= 64),
  ADD COLUMN import_batch_id uuid,
  ADD CONSTRAINT lab_orders_import_batch_fkey FOREIGN KEY (clinic_id, import_batch_id) REFERENCES import_batches(clinic_id, id);
ALTER TABLE referrals
  ADD COLUMN external_ref text CHECK (length(external_ref) <= 64),
  ADD COLUMN import_batch_id uuid,
  ADD CONSTRAINT referrals_import_batch_fkey FOREIGN KEY (clinic_id, import_batch_id) REFERENCES import_batches(clinic_id, id);
CREATE UNIQUE INDEX lab_orders_external_ref_idx ON lab_orders(clinic_id, external_ref) WHERE external_ref IS NOT NULL;
CREATE UNIQUE INDEX referrals_external_ref_idx ON referrals(clinic_id, external_ref) WHERE external_ref IS NOT NULL;

-- Clinical roles may insert lab orders and referrals (import). Lab-status
-- updates stay physician-only: marking a result received closes a lab gap, so
-- lab imports that update existing orders are a physician action.
DROP POLICY lab_orders_insert ON lab_orders;
CREATE POLICY lab_orders_insert ON lab_orders FOR INSERT TO sw_app WITH CHECK (
  clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id) AND app.current_role() IN ('clinic_admin', 'physician'));
DROP POLICY referrals_insert ON referrals;
CREATE POLICY referrals_insert ON referrals FOR INSERT TO sw_app WITH CHECK (
  clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id) AND app.current_role() IN ('clinic_admin', 'physician'));

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches FORCE ROW LEVEL SECURITY;
CREATE POLICY import_batches_select ON import_batches FOR SELECT TO sw_app USING (
  clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id) AND app.current_role() IN ('clinic_admin', 'physician'));
CREATE POLICY import_batches_insert ON import_batches FOR INSERT TO sw_app WITH CHECK (
  clinic_id = app.current_clinic_id() AND app.is_active_member(clinic_id) AND app.current_role() IN ('clinic_admin', 'physician')
  AND created_by = app.current_user_id());
CREATE POLICY import_batches_update ON import_batches FOR UPDATE TO sw_app
  USING (clinic_id = app.current_clinic_id() AND false) WITH CHECK (clinic_id = app.current_clinic_id() AND false);
CREATE POLICY import_batches_delete ON import_batches FOR DELETE TO sw_app USING (clinic_id = app.current_clinic_id() AND false);

GRANT SELECT, INSERT ON import_batches TO sw_app;
GRANT INSERT ON lab_orders, referrals TO sw_app;
GRANT UPDATE (external_ref) ON lab_orders, referrals TO sw_app;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON import_batches FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON import_batches FROM authenticated; END IF;
  IF NOT (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
    ALTER TABLE public.import_batches NO FORCE ROW LEVEL SECURITY;
  END IF;
END
$$;
