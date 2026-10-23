/*
# Governor / Delegate / Reporter roles and project creation fix

1. Why
- Creating a project failed: the rule deciding who may SEE a project looked the project up again
  by id, and a row that is being inserted is not yet visible to that lookup, so the app could not
  read back its own new project. The read rule now checks the row's own columns.
- The two roles admin / user are replaced by three roles.

2. Roles (profiles.role)
- `governor`: super admin. Sees and fully controls every shared project, can create and delete
  projects, manages people, project access and accounts. Existing admins become governors.
- `delegate`: project manager. Can create shared projects and fully run the projects they created
  (tasks, assignments, workflow, archive) but cannot delete projects. Sees other projects only
  when a governor grants access.
- `reporter`: read only on projects a governor allocates. Cannot create projects. Existing basic
  accounts become reporters (they could not create projects before either).
- Every account still keeps its private "My space".

3. Access levels (project_access)
- `manage`: governor on shared projects, owner of a personal space.
- `lead`: a delegate on a shared project they created. Same as manage except deleting the project.
- `read` / `write` / `write_delete`: granted by a governor through project_members. Reporters are
  always limited to `read`, whatever was granted.

4. Security changes
- New helpers `my_role()` and `is_governor()` (SECURITY DEFINER, authenticated only). `is_admin()`
  is removed and all rules use `is_governor()`.
- projects: SELECT rewritten on row columns; INSERT allowed for governors and delegates; UPDATE for
  manage/lead; DELETE governor only (never personal spaces).
- statuses, tasks, comments: every former 'manage' check also accepts 'lead'.
- project_members: managed by governors only.
- New accounts: role comes from app metadata set by a governor (user-immutable); self sign-ups
  become reporters; the very first account becomes governor.
- `admin_update_user` accepts the three roles and never removes the last active governor.
*/

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
UPDATE profiles SET role = 'governor' WHERE role = 'admin';
UPDATE profiles SET role = 'reporter' WHERE role = 'user';
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'reporter';
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('governor', 'delegate', 'reporter'));

CREATE OR REPLACE FUNCTION public.my_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND NOT disabled
$$;

CREATE OR REPLACE FUNCTION public.is_governor() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.my_role() = 'governor', false)
$$;

CREATE OR REPLACE FUNCTION public.project_access(p_project uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN me.id IS NULL THEN NULL
    WHEN pr.is_personal THEN CASE WHEN pr.owner_id = me.id THEN 'manage' END
    WHEN me.role = 'governor' THEN 'manage'
    WHEN me.role = 'delegate' AND pr.created_by = me.id THEN 'lead'
    WHEN me.role = 'reporter' THEN
      (SELECT 'read' FROM project_members pm WHERE pm.project_id = pr.id AND pm.user_id = me.id)
    ELSE (SELECT pm.access FROM project_members pm WHERE pm.project_id = pr.id AND pm.user_id = me.id)
  END
  FROM projects pr
  LEFT JOIN profiles me ON me.id = auth.uid() AND NOT me.disabled
  WHERE pr.id = p_project
$$;

CREATE OR REPLACE FUNCTION public.can_see_profile(p_target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_target = auth.uid() OR public.is_governor() OR EXISTS (
    SELECT 1 FROM projects pr
    WHERE public.project_access(pr.id) IS NOT NULL
      AND (
        pr.owner_id = p_target
        OR (NOT pr.is_personal AND pr.created_by = p_target)
        OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = pr.id AND pm.user_id = p_target)
        OR (NOT pr.is_personal AND EXISTS (SELECT 1 FROM profiles t WHERE t.id = p_target AND t.role = 'governor' AND NOT t.disabled))
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.my_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_governor() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.project_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_see_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_governor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_profile(uuid) TO authenticated;

-- projects
DROP POLICY IF EXISTS "select_accessible_projects" ON projects;
CREATE POLICY "select_accessible_projects" ON projects FOR SELECT TO authenticated
  USING (
    public.my_role() IS NOT NULL AND (
      (is_personal AND owner_id = auth.uid())
      OR (NOT is_personal AND (
        public.my_role() = 'governor'
        OR (public.my_role() = 'delegate' AND created_by = auth.uid())
        OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = projects.id AND pm.user_id = auth.uid())
      ))
    )
  );
DROP POLICY IF EXISTS "admins_insert_shared_projects" ON projects;
DROP POLICY IF EXISTS "leads_insert_shared_projects" ON projects;
CREATE POLICY "leads_insert_shared_projects" ON projects FOR INSERT TO authenticated
  WITH CHECK (public.my_role() IN ('governor', 'delegate') AND NOT is_personal AND owner_id IS NULL AND created_by = auth.uid());
DROP POLICY IF EXISTS "managers_update_projects" ON projects;
CREATE POLICY "managers_update_projects" ON projects FOR UPDATE TO authenticated
  USING (public.project_access(id) IN ('manage', 'lead')) WITH CHECK (public.project_access(id) IN ('manage', 'lead'));
DROP POLICY IF EXISTS "managers_delete_shared_projects" ON projects;
DROP POLICY IF EXISTS "governors_delete_shared_projects" ON projects;
CREATE POLICY "governors_delete_shared_projects" ON projects FOR DELETE TO authenticated
  USING (NOT is_personal AND public.is_governor());

-- project_members
DROP POLICY IF EXISTS "select_project_members" ON project_members;
CREATE POLICY "select_project_members" ON project_members FOR SELECT TO authenticated
  USING (public.is_governor() OR public.project_access(project_id) IS NOT NULL);
DROP POLICY IF EXISTS "admins_insert_project_members" ON project_members;
DROP POLICY IF EXISTS "governors_insert_project_members" ON project_members;
CREATE POLICY "governors_insert_project_members" ON project_members FOR INSERT TO authenticated
  WITH CHECK (public.is_governor() AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND NOT p.is_personal));
DROP POLICY IF EXISTS "admins_update_project_members" ON project_members;
DROP POLICY IF EXISTS "governors_update_project_members" ON project_members;
CREATE POLICY "governors_update_project_members" ON project_members FOR UPDATE TO authenticated
  USING (public.is_governor()) WITH CHECK (public.is_governor());
DROP POLICY IF EXISTS "admins_delete_project_members" ON project_members;
DROP POLICY IF EXISTS "governors_delete_project_members" ON project_members;
CREATE POLICY "governors_delete_project_members" ON project_members FOR DELETE TO authenticated
  USING (public.is_governor());

-- statuses
DROP POLICY IF EXISTS "managers_insert_statuses" ON statuses;
CREATE POLICY "managers_insert_statuses" ON statuses FOR INSERT TO authenticated
  WITH CHECK (public.project_access(project_id) IN ('manage', 'lead'));
DROP POLICY IF EXISTS "managers_update_statuses" ON statuses;
CREATE POLICY "managers_update_statuses" ON statuses FOR UPDATE TO authenticated
  USING (public.project_access(project_id) IN ('manage', 'lead')) WITH CHECK (public.project_access(project_id) IN ('manage', 'lead'));
DROP POLICY IF EXISTS "managers_delete_statuses" ON statuses;
CREATE POLICY "managers_delete_statuses" ON statuses FOR DELETE TO authenticated
  USING (public.project_access(project_id) IN ('manage', 'lead'));

-- tasks
DROP POLICY IF EXISTS "writers_insert_tasks" ON tasks;
CREATE POLICY "writers_insert_tasks" ON tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.project_access(project_id) IN ('write', 'write_delete', 'lead', 'manage')
    AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM statuses s WHERE s.id = status_id AND s.project_id = tasks.project_id)
  );
DROP POLICY IF EXISTS "writers_update_tasks" ON tasks;
CREATE POLICY "writers_update_tasks" ON tasks FOR UPDATE TO authenticated
  USING (public.project_access(project_id) IN ('write', 'write_delete', 'lead', 'manage'))
  WITH CHECK (
    public.project_access(project_id) IN ('write', 'write_delete', 'lead', 'manage')
    AND EXISTS (SELECT 1 FROM statuses s WHERE s.id = status_id AND s.project_id = tasks.project_id)
  );
DROP POLICY IF EXISTS "allowed_delete_tasks" ON tasks;
CREATE POLICY "allowed_delete_tasks" ON tasks FOR DELETE TO authenticated
  USING (
    public.project_access(project_id) IN ('manage', 'lead')
    OR (public.project_access(project_id) = 'write_delete' AND created_by = auth.uid())
  );

-- checklist_items
DROP POLICY IF EXISTS "writers_insert_checklist" ON checklist_items;
CREATE POLICY "writers_insert_checklist" ON checklist_items FOR INSERT TO authenticated
  WITH CHECK (public.task_access(task_id) IN ('write', 'write_delete', 'lead', 'manage'));
DROP POLICY IF EXISTS "writers_update_checklist" ON checklist_items;
CREATE POLICY "writers_update_checklist" ON checklist_items FOR UPDATE TO authenticated
  USING (public.task_access(task_id) IN ('write', 'write_delete', 'lead', 'manage'))
  WITH CHECK (public.task_access(task_id) IN ('write', 'write_delete', 'lead', 'manage'));
DROP POLICY IF EXISTS "writers_delete_checklist" ON checklist_items;
CREATE POLICY "writers_delete_checklist" ON checklist_items FOR DELETE TO authenticated
  USING (public.task_access(task_id) IN ('write', 'write_delete', 'lead', 'manage'));

-- comments
DROP POLICY IF EXISTS "writers_insert_comments" ON comments;
CREATE POLICY "writers_insert_comments" ON comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.task_access(task_id) IN ('write', 'write_delete', 'lead', 'manage'));
DROP POLICY IF EXISTS "authors_or_managers_delete_comments" ON comments;
CREATE POLICY "authors_or_managers_delete_comments" ON comments FOR DELETE TO authenticated
  USING (
    (author_id = auth.uid() AND public.task_access(task_id) IS NOT NULL)
    OR public.task_access(task_id) IN ('manage', 'lead')
  );

DROP FUNCTION IF EXISTS public.is_admin();

-- New accounts
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_colors text[] := ARRAY['#0d9488', '#0284c7', '#2563eb', '#059669', '#65a30d', '#d97706', '#ea580c', '#e11d48', '#0891b2'];
  v_role text;
  v_name text;
  v_project uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('workday_first_admin'));
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'governor') THEN
    v_role := 'governor';
  ELSE
    v_role := coalesce(NEW.raw_app_meta_data->>'workday_role', 'reporter');
    IF v_role NOT IN ('governor', 'delegate', 'reporter') THEN
      v_role := 'reporter';
    END IF;
  END IF;
  v_name := left(coalesce(nullif(trim(NEW.raw_user_meta_data->>'name'), ''), nullif(split_part(coalesce(NEW.email, ''), '@', 1), ''), 'User'), 80);

  INSERT INTO profiles (id, name, email, color, role)
  VALUES (NEW.id, v_name, lower(coalesce(NEW.email, '')), v_colors[1 + floor(random() * array_length(v_colors, 1))::int], v_role);

  INSERT INTO projects (name, description, color, is_personal, owner_id, created_by)
  VALUES ('My space', 'Your private space. Only you can see it.', '#0d9488', true, NEW.id, NEW.id)
  RETURNING id INTO v_project;

  INSERT INTO statuses (project_id, name, color, position, is_done) VALUES
    (v_project, 'To do', '#64748b', 0, false),
    (v_project, 'In progress', '#0284c7', 1, false),
    (v_project, 'Review', '#d97706', 2, false),
    (v_project, 'Done', '#059669', 3, true);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_user(target_id uuid, new_role text, new_disabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target profiles%ROWTYPE;
BEGIN
  IF NOT public.is_governor() THEN
    RAISE EXCEPTION 'Only governors can change accounts.';
  END IF;
  IF new_role NOT IN ('governor', 'delegate', 'reporter') THEN
    RAISE EXCEPTION 'Unknown role.';
  END IF;
  SELECT * INTO v_target FROM profiles WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This account no longer exists.';
  END IF;
  IF target_id = auth.uid() AND (new_role <> 'governor' OR new_disabled) THEN
    RAISE EXCEPTION 'You cannot remove your own governor role or disable your own account.';
  END IF;
  IF v_target.role = 'governor' AND NOT v_target.disabled AND (new_role <> 'governor' OR new_disabled)
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'governor' AND NOT disabled AND id <> target_id) THEN
    RAISE EXCEPTION 'Workday needs at least one active governor.';
  END IF;
  UPDATE profiles SET role = new_role, disabled = new_disabled WHERE id = target_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_update_user(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, text, boolean) TO authenticated;
