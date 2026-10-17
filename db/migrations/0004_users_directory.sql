-- Tenant code may read the names of people who belong to the current clinic
-- (assignees, audit actors) — and nothing else about users.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY users_select ON public.users FOR SELECT TO sw_app USING (
  app.is_active_member(app.current_clinic_id())
  AND EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = users.id AND m.clinic_id = app.current_clinic_id()
  )
);
CREATE POLICY users_insert ON public.users FOR INSERT TO sw_app WITH CHECK (false);
CREATE POLICY users_update ON public.users FOR UPDATE TO sw_app USING (false) WITH CHECK (false);
CREATE POLICY users_delete ON public.users FOR DELETE TO sw_app USING (false);

-- Column-level grant: never password_hash or auth_subject.
GRANT SELECT (id, email, display_name, is_placeholder) ON public.users TO sw_app;
