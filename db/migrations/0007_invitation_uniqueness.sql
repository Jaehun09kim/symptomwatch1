-- At most one outstanding invitation per clinic and address, so concurrent
-- invitations can't leave a second, higher-privilege link usable.
CREATE UNIQUE INDEX invitations_one_outstanding ON invitations (clinic_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
