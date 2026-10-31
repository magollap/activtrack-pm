-- =====================================================================================
-- ActivTrack: one-time database setup for a Supabase project
--
-- Run this whole file once in Supabase -> SQL Editor -> New query -> Run.
-- It creates every table, security rule and trigger the app needs, turns on live updates,
-- and sets up accounts that signed up before the tables existed (the oldest becomes governor).
-- It is safe to run again: existing tables and data are kept.
--
-- Fixes "Could not find the table 'public.profiles' in the schema cache".
-- Generated from supabase/migrations/*.sql plus the account backfill at the end.
-- =====================================================================================


-- ---------------------------------------------------------------------------------
-- 20261023161643_create_workday_schema.sql
-- ---------------------------------------------------------------------------------
/*
# Workday: users, projects, access levels and tasks

## Plain-English summary
This sets up the online database for Workday's hosted version. People sign up with email and password.
The very first account becomes the administrator; everyone else gets a basic account. Every account
automatically receives a private "My space" project. Admins create shared projects and decide who can
open them and at what level (read only, read & write, or read, write & delete own tasks).

## 1. New tables
- `profiles`: one row per account (id = auth user id). name, email, color, role ('admin' | 'user'),
  disabled (blocked accounts lose all access), auth_source ('local' | 'ldap').
- `projects`: name, description, color, archived_at, is_personal, owner_id (only for personal spaces),
  created_by.
- `project_members`: which user can open which shared project and with what access
  ('read' | 'write' | 'write_delete').
- `statuses`: workflow columns per project (name, color, position, is_done).
- `tasks`: title, description, status, priority, assignee, start/due date, position, completed_at, created_by.
- `checklist_items`: checklist entries per task.
- `comments`: comments per task; author is always the signed-in user.
- `task_history`: change log per task, written only by the database itself.

## 2. Security
- Row level security on every table. All access goes through `project_access()`, which returns
  'manage' for admins on shared projects and for owners of personal spaces, the member's access level
  for shared projects they were added to, and nothing for everyone else (or disabled accounts).
- Personal spaces are private to their owner, admins included.
- Writes are limited to specific columns with column-level grants, so users can never change their
  own role, a task's creator, or a project's owner.
- Only admins create shared projects and manage project access.
- Tasks can be deleted by project managers, or by 'write_delete' members for tasks they created.
- Role and account changes go through `admin_update_user()`, which only admins can use and which never
  removes the last active admin.

## 3. Important notes
1. History is recorded by a trigger so it cannot be forged by clients.
2. The first-admin decision uses a lock so two simultaneous sign-ups cannot both become admin.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  email text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#0d9488' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  disabled boolean NOT NULL DEFAULT false,
  auth_source text NOT NULL DEFAULT 'local' CHECK (auth_source IN ('local', 'ldap')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  color text NOT NULL DEFAULT '#0d9488' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  archived_at timestamptz,
  is_personal boolean NOT NULL DEFAULT false,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_personal_owner CHECK ((is_personal AND owner_id IS NOT NULL) OR (NOT is_personal AND owner_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS projects_one_personal_space ON projects(owner_id) WHERE is_personal;

CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access text NOT NULL DEFAULT 'write' CHECK (access IN ('read', 'write', 'write_delete')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS project_members_user_idx ON project_members(user_id);

CREATE TABLE IF NOT EXISTS statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  color text NOT NULL DEFAULT '#64748b' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  position integer NOT NULL DEFAULT 0,
  is_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS statuses_project_idx ON statuses(project_id);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 10000),
  status_id uuid NOT NULL REFERENCES statuses(id),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  start_date date,
  due_date date,
  position integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_by uuid DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status_id);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON tasks(assignee_id);

CREATE TABLE IF NOT EXISTS checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 300),
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checklist_items_task_idx ON checklist_items(task_id);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id uuid DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_task_idx ON comments(task_id);

CREATE TABLE IF NOT EXISTS task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  field text NOT NULL CHECK (field IN ('title', 'status', 'priority', 'assignee', 'dueDate')),
  from_value text,
  to_value text,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_history_task_idx ON task_history(task_id);

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','projects','project_members','statuses','tasks','checklist_items','comments'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- Access helpers
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND NOT disabled)
$$;

CREATE OR REPLACE FUNCTION public.project_access(p_project uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN me.id IS NULL THEN NULL
    WHEN pr.is_personal THEN CASE WHEN pr.owner_id = me.id THEN 'manage' END
    WHEN me.role = 'admin' THEN 'manage'
    ELSE (SELECT pm.access FROM project_members pm WHERE pm.project_id = pr.id AND pm.user_id = me.id)
  END
  FROM projects pr
  LEFT JOIN profiles me ON me.id = auth.uid() AND NOT me.disabled
  WHERE pr.id = p_project
$$;

CREATE OR REPLACE FUNCTION public.task_access(p_task uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.project_access(t.project_id) FROM tasks t WHERE t.id = p_task
$$;

CREATE OR REPLACE FUNCTION public.can_see_profile(p_target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_target = auth.uid() OR public.is_admin() OR EXISTS (
    SELECT 1 FROM projects pr
    WHERE public.project_access(pr.id) IS NOT NULL
      AND (
        pr.owner_id = p_target
        OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = pr.id AND pm.user_id = p_target)
        OR (NOT pr.is_personal AND EXISTS (SELECT 1 FROM profiles t WHERE t.id = p_target AND t.role = 'admin' AND NOT t.disabled))
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.project_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.task_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_see_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.task_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_profile(uuid) TO authenticated;

-- RLS + grants
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON profiles, projects, project_members, statuses, tasks, checklist_items, comments, task_history FROM anon, authenticated;

GRANT SELECT ON profiles TO authenticated;
GRANT UPDATE (name, color) ON profiles TO authenticated;

GRANT SELECT, DELETE ON projects TO authenticated;
GRANT INSERT (name, description, color) ON projects TO authenticated;
GRANT UPDATE (name, description, color, archived_at) ON projects TO authenticated;

GRANT SELECT, DELETE ON project_members TO authenticated;
GRANT INSERT (project_id, user_id, access) ON project_members TO authenticated;
GRANT UPDATE (access) ON project_members TO authenticated;

GRANT SELECT, DELETE ON statuses TO authenticated;
GRANT INSERT (project_id, name, color, position, is_done) ON statuses TO authenticated;
GRANT UPDATE (name, color, position, is_done) ON statuses TO authenticated;

GRANT SELECT, DELETE ON tasks TO authenticated;
GRANT INSERT (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at) ON tasks TO authenticated;
GRANT UPDATE (title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at) ON tasks TO authenticated;

GRANT SELECT, DELETE ON checklist_items TO authenticated;
GRANT INSERT (task_id, text, done, position) ON checklist_items TO authenticated;
GRANT UPDATE (text, done, position) ON checklist_items TO authenticated;

GRANT SELECT, DELETE ON comments TO authenticated;
GRANT INSERT (task_id, body) ON comments TO authenticated;
GRANT UPDATE (body) ON comments TO authenticated;

GRANT SELECT ON task_history TO authenticated;

-- profiles
DROP POLICY IF EXISTS "select_visible_profiles" ON profiles;
CREATE POLICY "select_visible_profiles" ON profiles FOR SELECT TO authenticated
  USING (public.can_see_profile(id));
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- projects
DROP POLICY IF EXISTS "select_accessible_projects" ON projects;
CREATE POLICY "select_accessible_projects" ON projects FOR SELECT TO authenticated
  USING (public.project_access(id) IS NOT NULL);
DROP POLICY IF EXISTS "admins_insert_shared_projects" ON projects;
CREATE POLICY "admins_insert_shared_projects" ON projects FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND NOT is_personal AND owner_id IS NULL AND created_by = auth.uid());
DROP POLICY IF EXISTS "managers_update_projects" ON projects;
CREATE POLICY "managers_update_projects" ON projects FOR UPDATE TO authenticated
  USING (public.project_access(id) = 'manage') WITH CHECK (public.project_access(id) = 'manage');
DROP POLICY IF EXISTS "managers_delete_shared_projects" ON projects;
CREATE POLICY "managers_delete_shared_projects" ON projects FOR DELETE TO authenticated
  USING (NOT is_personal AND public.project_access(id) = 'manage');

-- project_members
DROP POLICY IF EXISTS "select_project_members" ON project_members;
CREATE POLICY "select_project_members" ON project_members FOR SELECT TO authenticated
  USING (public.is_admin() OR public.project_access(project_id) IS NOT NULL);
DROP POLICY IF EXISTS "admins_insert_project_members" ON project_members;
CREATE POLICY "admins_insert_project_members" ON project_members FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND NOT p.is_personal));
DROP POLICY IF EXISTS "admins_update_project_members" ON project_members;
CREATE POLICY "admins_update_project_members" ON project_members FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admins_delete_project_members" ON project_members;
CREATE POLICY "admins_delete_project_members" ON project_members FOR DELETE TO authenticated
  USING (public.is_admin());

-- statuses
DROP POLICY IF EXISTS "select_project_statuses" ON statuses;
CREATE POLICY "select_project_statuses" ON statuses FOR SELECT TO authenticated
  USING (public.project_access(project_id) IS NOT NULL);
DROP POLICY IF EXISTS "managers_insert_statuses" ON statuses;
CREATE POLICY "managers_insert_statuses" ON statuses FOR INSERT TO authenticated
  WITH CHECK (public.project_access(project_id) = 'manage');
DROP POLICY IF EXISTS "managers_update_statuses" ON statuses;
CREATE POLICY "managers_update_statuses" ON statuses FOR UPDATE TO authenticated
  USING (public.project_access(project_id) = 'manage') WITH CHECK (public.project_access(project_id) = 'manage');
DROP POLICY IF EXISTS "managers_delete_statuses" ON statuses;
CREATE POLICY "managers_delete_statuses" ON statuses FOR DELETE TO authenticated
  USING (public.project_access(project_id) = 'manage');

-- tasks
DROP POLICY IF EXISTS "select_project_tasks" ON tasks;
CREATE POLICY "select_project_tasks" ON tasks FOR SELECT TO authenticated
  USING (public.project_access(project_id) IS NOT NULL);
DROP POLICY IF EXISTS "writers_insert_tasks" ON tasks;
CREATE POLICY "writers_insert_tasks" ON tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.project_access(project_id) IN ('write', 'write_delete', 'manage')
    AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM statuses s WHERE s.id = status_id AND s.project_id = tasks.project_id)
  );
DROP POLICY IF EXISTS "writers_update_tasks" ON tasks;
CREATE POLICY "writers_update_tasks" ON tasks FOR UPDATE TO authenticated
  USING (public.project_access(project_id) IN ('write', 'write_delete', 'manage'))
  WITH CHECK (
    public.project_access(project_id) IN ('write', 'write_delete', 'manage')
    AND EXISTS (SELECT 1 FROM statuses s WHERE s.id = status_id AND s.project_id = tasks.project_id)
  );
DROP POLICY IF EXISTS "allowed_delete_tasks" ON tasks;
CREATE POLICY "allowed_delete_tasks" ON tasks FOR DELETE TO authenticated
  USING (
    public.project_access(project_id) = 'manage'
    OR (public.project_access(project_id) = 'write_delete' AND created_by = auth.uid())
  );

-- checklist_items
DROP POLICY IF EXISTS "select_task_checklist" ON checklist_items;
CREATE POLICY "select_task_checklist" ON checklist_items FOR SELECT TO authenticated
  USING (public.task_access(task_id) IS NOT NULL);
DROP POLICY IF EXISTS "writers_insert_checklist" ON checklist_items;
CREATE POLICY "writers_insert_checklist" ON checklist_items FOR INSERT TO authenticated
  WITH CHECK (public.task_access(task_id) IN ('write', 'write_delete', 'manage'));
DROP POLICY IF EXISTS "writers_update_checklist" ON checklist_items;
CREATE POLICY "writers_update_checklist" ON checklist_items FOR UPDATE TO authenticated
  USING (public.task_access(task_id) IN ('write', 'write_delete', 'manage'))
  WITH CHECK (public.task_access(task_id) IN ('write', 'write_delete', 'manage'));
DROP POLICY IF EXISTS "writers_delete_checklist" ON checklist_items;
CREATE POLICY "writers_delete_checklist" ON checklist_items FOR DELETE TO authenticated
  USING (public.task_access(task_id) IN ('write', 'write_delete', 'manage'));

-- comments
DROP POLICY IF EXISTS "select_task_comments" ON comments;
CREATE POLICY "select_task_comments" ON comments FOR SELECT TO authenticated
  USING (public.task_access(task_id) IS NOT NULL);
DROP POLICY IF EXISTS "writers_insert_comments" ON comments;
CREATE POLICY "writers_insert_comments" ON comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.task_access(task_id) IN ('write', 'write_delete', 'manage'));
DROP POLICY IF EXISTS "authors_update_comments" ON comments;
CREATE POLICY "authors_update_comments" ON comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND public.task_access(task_id) IS NOT NULL)
  WITH CHECK (author_id = auth.uid() AND public.task_access(task_id) IS NOT NULL);
DROP POLICY IF EXISTS "authors_or_managers_delete_comments" ON comments;
CREATE POLICY "authors_or_managers_delete_comments" ON comments FOR DELETE TO authenticated
  USING (
    (author_id = auth.uid() AND public.task_access(task_id) IS NOT NULL)
    OR public.task_access(task_id) = 'manage'
  );

-- task_history (read only for clients)
DROP POLICY IF EXISTS "select_task_history" ON task_history;
CREATE POLICY "select_task_history" ON task_history FOR SELECT TO authenticated
  USING (public.task_access(task_id) IS NOT NULL);

-- History trigger
CREATE OR REPLACE FUNCTION public.log_task_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    INSERT INTO task_history (task_id, field, from_value, to_value, actor_id)
    VALUES (NEW.id, 'title', OLD.title, NEW.title, auth.uid());
  END IF;
  IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    INSERT INTO task_history (task_id, field, from_value, to_value, actor_id)
    VALUES (NEW.id, 'status',
      (SELECT s.name FROM statuses s WHERE s.id = OLD.status_id),
      (SELECT s.name FROM statuses s WHERE s.id = NEW.status_id),
      auth.uid());
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO task_history (task_id, field, from_value, to_value, actor_id)
    VALUES (NEW.id, 'priority', initcap(OLD.priority), initcap(NEW.priority), auth.uid());
  END IF;
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    INSERT INTO task_history (task_id, field, from_value, to_value, actor_id)
    VALUES (NEW.id, 'assignee',
      CASE WHEN OLD.assignee_id IS NULL THEN NULL ELSE coalesce((SELECT p.name FROM profiles p WHERE p.id = OLD.assignee_id), 'Former member') END,
      CASE WHEN NEW.assignee_id IS NULL THEN NULL ELSE coalesce((SELECT p.name FROM profiles p WHERE p.id = NEW.assignee_id), 'Former member') END,
      auth.uid());
  END IF;
  IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    INSERT INTO task_history (task_id, field, from_value, to_value, actor_id)
    VALUES (NEW.id, 'dueDate', to_char(OLD.due_date, 'Mon FMDD, YYYY'), to_char(NEW.due_date, 'Mon FMDD, YYYY'), auth.uid());
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_task_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS log_task_changes ON tasks;
CREATE TRIGGER log_task_changes AFTER UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION public.log_task_changes();

-- New account: profile, first admin, personal space
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_colors text[] := ARRAY['#0d9488', '#0284c7', '#2563eb', '#059669', '#65a30d', '#d97706', '#ea580c', '#e11d48', '#0891b2'];
  v_role text;
  v_name text;
  v_project uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('workday_first_admin'));
  v_role := CASE WHEN EXISTS (SELECT 1 FROM profiles WHERE role = 'admin') THEN 'user' ELSE 'admin' END;
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Admin user management
CREATE OR REPLACE FUNCTION public.admin_update_user(target_id uuid, new_role text, new_disabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change accounts.';
  END IF;
  IF new_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Unknown role.';
  END IF;
  SELECT * INTO v_target FROM profiles WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This account no longer exists.';
  END IF;
  IF target_id = auth.uid() AND (new_role <> 'admin' OR new_disabled) THEN
    RAISE EXCEPTION 'You cannot remove your own admin access or disable your own account.';
  END IF;
  IF v_target.role = 'admin' AND NOT v_target.disabled AND (new_role <> 'admin' OR new_disabled)
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin' AND NOT disabled AND id <> target_id) THEN
    RAISE EXCEPTION 'Workday needs at least one active admin.';
  END IF;
  UPDATE profiles SET role = new_role, disabled = new_disabled WHERE id = target_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_update_user(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, text, boolean) TO authenticated;


-- ---------------------------------------------------------------------------------
-- 20261023214556_governor_delegate_reporter_roles.sql
-- ---------------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------------
-- 20261030120000_enable_realtime.sql
-- ---------------------------------------------------------------------------------
/*
# Live updates (Supabase Realtime)

## Plain-English summary
Lets open browser tabs refresh by themselves when a teammate adds, moves or edits a card, instead of
waiting for the tab to be refocused. The app listens to row changes on these tables and reloads the
screens that show them.

## What it does
- Adds the app's tables to the `supabase_realtime` publication (creating the publication if needed).
- Safe to run more than once: tables already in the publication are skipped.

## Security
- Realtime only delivers rows the signed-in person may SELECT under the existing row level security
  policies, so nobody receives changes from projects they cannot open.
- No tables, columns, grants or policies are changed.
*/

DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH t IN ARRAY ARRAY['projects', 'project_members', 'statuses', 'tasks', 'checklist_items', 'comments', 'profiles'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;


-- ---------------------------------------------------------------------------------
-- 20261030160000_custom_fields_templates.sql
-- ---------------------------------------------------------------------------------
/*
# Custom fields and project templates

## Plain-English summary
- Custom fields: each project can add its own card fields (text, number, date, dropdown, checkbox,
  link), for example "Story points" or "Severity". Values are stored on each card.
- Project templates: save a project's columns, fields and (optionally) cards as a template, and
  start new projects from it. Built-in templates live in the app and need no table.

## 1. Changes
- `tasks.custom_values` (jsonb, default {}): the card's field values, keyed by field id.
- `custom_fields`: project_id, name, type, options (dropdown choices), position, show_on_card.
- `project_templates`: name, description, color, data (statuses, fields, cards), created_by.

## 2. Security
- Custom fields follow the project's access: anyone who can open the project sees them; project
  managers (governors, project leads, owners of a personal space) add, change and remove them.
  Card values change with the same rights as any other card edit.
- Templates hold structure only. Every active account can see them; governors and delegates (the
  people who can create projects) save them; the author or a governor edits or deletes them.
- Column-level grants, as for the other tables, so clients cannot set ids, authors or timestamps.

## 3. Notes
- Safe to run more than once. Also included in supabase/setup.sql.
*/

-- Card values
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS custom_values jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_custom_values_check') THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_custom_values_check
      CHECK (jsonb_typeof(custom_values) = 'object' AND octet_length(custom_values::text) <= 20000);
  END IF;
END $$;
GRANT INSERT (custom_values), UPDATE (custom_values) ON tasks TO authenticated;

-- Field definitions
CREATE TABLE IF NOT EXISTS custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  type text NOT NULL CHECK (type IN ('text', 'number', 'date', 'select', 'checkbox', 'url')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(options) = 'array' AND octet_length(options::text) <= 10000),
  position integer NOT NULL DEFAULT 0,
  show_on_card boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS custom_fields_project_idx ON custom_fields(project_id);

-- Templates
CREATE TABLE IF NOT EXISTS project_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  color text NOT NULL DEFAULT '#0a8c4e' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(data) = 'object' AND octet_length(data::text) <= 200000),
  created_by uuid DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at ON custom_fields;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON custom_fields FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON project_templates;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON project_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON custom_fields, project_templates FROM anon, authenticated;
GRANT SELECT, DELETE ON custom_fields TO authenticated;
GRANT INSERT (project_id, name, type, options, position, show_on_card) ON custom_fields TO authenticated;
GRANT UPDATE (name, options, position, show_on_card) ON custom_fields TO authenticated;
GRANT SELECT, DELETE ON project_templates TO authenticated;
GRANT INSERT (name, description, color, data) ON project_templates TO authenticated;
GRANT UPDATE (name, description, color, data) ON project_templates TO authenticated;

-- custom_fields policies
DROP POLICY IF EXISTS "select_project_fields" ON custom_fields;
CREATE POLICY "select_project_fields" ON custom_fields FOR SELECT TO authenticated
  USING (public.project_access(project_id) IS NOT NULL);
DROP POLICY IF EXISTS "managers_insert_fields" ON custom_fields;
CREATE POLICY "managers_insert_fields" ON custom_fields FOR INSERT TO authenticated
  WITH CHECK (public.project_access(project_id) IN ('manage', 'lead'));
DROP POLICY IF EXISTS "managers_update_fields" ON custom_fields;
CREATE POLICY "managers_update_fields" ON custom_fields FOR UPDATE TO authenticated
  USING (public.project_access(project_id) IN ('manage', 'lead'))
  WITH CHECK (public.project_access(project_id) IN ('manage', 'lead'));
DROP POLICY IF EXISTS "managers_delete_fields" ON custom_fields;
CREATE POLICY "managers_delete_fields" ON custom_fields FOR DELETE TO authenticated
  USING (public.project_access(project_id) IN ('manage', 'lead'));

-- project_templates policies
DROP POLICY IF EXISTS "active_users_select_templates" ON project_templates;
CREATE POLICY "active_users_select_templates" ON project_templates FOR SELECT TO authenticated
  USING (public.my_role() IS NOT NULL);
DROP POLICY IF EXISTS "creators_insert_templates" ON project_templates;
CREATE POLICY "creators_insert_templates" ON project_templates FOR INSERT TO authenticated
  WITH CHECK (public.my_role() IN ('governor', 'delegate') AND created_by = auth.uid());
DROP POLICY IF EXISTS "authors_update_templates" ON project_templates;
CREATE POLICY "authors_update_templates" ON project_templates FOR UPDATE TO authenticated
  USING (public.my_role() IS NOT NULL AND (created_by = auth.uid() OR public.is_governor()))
  WITH CHECK (public.my_role() IS NOT NULL AND (created_by = auth.uid() OR public.is_governor()));
DROP POLICY IF EXISTS "authors_delete_templates" ON project_templates;
CREATE POLICY "authors_delete_templates" ON project_templates FOR DELETE TO authenticated
  USING (public.my_role() IS NOT NULL AND (created_by = auth.uid() OR public.is_governor()));

-- Live updates for the new tables
DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  FOREACH t IN ARRAY ARRAY['custom_fields', 'project_templates'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';


-- ---------------------------------------------------------------------------------
-- 20261031120000_automations_status_time_files.sql
-- ---------------------------------------------------------------------------------
/*
# Automations, project status updates, time tracking and file attachments

## Plain-English summary
- automations: per-project rules such as "when a card moves to Review, assign it to Priya".
- status_updates: On track / At risk / Off track / Complete posts about a project, with a written summary.
- time_entries: time logged on a card, either with the start/stop timer or entered by hand.
- attachments: files attached to cards. The files themselves live in a private Storage bucket
  named "attachments", in folders named after the project and card.

## Security
- automations: anyone who can open the project sees its rules; project managers (governors, project
  leads, owners of a personal space) create, change and delete them.
- status_updates: anyone who can open the project reads them; project managers post them; the author
  or a manager edits or deletes them.
- time_entries: anyone who can open the project sees them; people with write access log their own
  time; you edit or delete your own entries, managers can delete anyone's.
- attachments: anyone who can open the project sees and downloads them; people with write access
  upload; the uploader or a manager deletes. Storage rules check the project from the file's folder.

## Notes
- Safe to run more than once. Also included in supabase/setup.sql.
- Files are limited to 25 MB each by the bucket setting (Supabase Free includes 1 GB of storage).
*/

-- ---------------------------------------------------------------- automations
CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  enabled boolean NOT NULL DEFAULT true,
  trigger jsonb NOT NULL CHECK (jsonb_typeof(trigger) = 'object' AND octet_length(trigger::text) <= 2000),
  actions jsonb NOT NULL CHECK (jsonb_typeof(actions) = 'array' AND octet_length(actions::text) <= 10000),
  created_by uuid DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automations_project_idx ON automations(project_id);

-- ---------------------------------------------------------------- status updates
CREATE TABLE IF NOT EXISTS status_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  health text NOT NULL CHECK (health IN ('on_track', 'at_risk', 'off_track', 'complete')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 10000),
  author_id uuid DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS status_updates_project_idx ON status_updates(project_id, created_at DESC);

-- ---------------------------------------------------------------- time entries
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  -- NULL while the timer is running.
  ended_at timestamptz,
  minutes integer NOT NULL DEFAULT 0 CHECK (minutes BETWEEN 0 AND 100000),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS time_entries_task_idx ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS time_entries_user_idx ON time_entries(user_id);

-- ---------------------------------------------------------------- attachments
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  size bigint NOT NULL DEFAULT 0 CHECK (size BETWEEN 0 AND 26214400),
  mime_type text NOT NULL DEFAULT 'application/octet-stream' CHECK (char_length(mime_type) <= 150),
  path text NOT NULL CHECK (char_length(path) <= 500),
  uploaded_by uuid DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attachments_task_idx ON attachments(task_id);

-- ---------------------------------------------------------------- shared setup
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['automations', 'status_updates', 'time_entries', 'attachments'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, DELETE ON %I TO authenticated', t);
  END LOOP;
END $$;

GRANT INSERT (project_id, name, enabled, trigger, actions) ON automations TO authenticated;
GRANT UPDATE (name, enabled, trigger, actions) ON automations TO authenticated;
GRANT INSERT (project_id, health, title, body) ON status_updates TO authenticated;
GRANT UPDATE (health, title, body) ON status_updates TO authenticated;
GRANT INSERT (task_id, started_at, ended_at, minutes, note) ON time_entries TO authenticated;
GRANT UPDATE (started_at, ended_at, minutes, note) ON time_entries TO authenticated;
GRANT INSERT (task_id, name, size, mime_type, path) ON attachments TO authenticated;

-- automations
DROP POLICY IF EXISTS "select_project_automations" ON automations;
CREATE POLICY "select_project_automations" ON automations FOR SELECT TO authenticated
  USING (public.project_access(project_id) IS NOT NULL);
DROP POLICY IF EXISTS "managers_insert_automations" ON automations;
CREATE POLICY "managers_insert_automations" ON automations FOR INSERT TO authenticated
  WITH CHECK (public.project_access(project_id) IN ('manage', 'lead') AND created_by = auth.uid());
DROP POLICY IF EXISTS "managers_update_automations" ON automations;
CREATE POLICY "managers_update_automations" ON automations FOR UPDATE TO authenticated
  USING (public.project_access(project_id) IN ('manage', 'lead'))
  WITH CHECK (public.project_access(project_id) IN ('manage', 'lead'));
DROP POLICY IF EXISTS "managers_delete_automations" ON automations;
CREATE POLICY "managers_delete_automations" ON automations FOR DELETE TO authenticated
  USING (public.project_access(project_id) IN ('manage', 'lead'));

-- status_updates
DROP POLICY IF EXISTS "select_project_status_updates" ON status_updates;
CREATE POLICY "select_project_status_updates" ON status_updates FOR SELECT TO authenticated
  USING (public.project_access(project_id) IS NOT NULL);
DROP POLICY IF EXISTS "managers_insert_status_updates" ON status_updates;
CREATE POLICY "managers_insert_status_updates" ON status_updates FOR INSERT TO authenticated
  WITH CHECK (public.project_access(project_id) IN ('manage', 'lead') AND author_id = auth.uid());
DROP POLICY IF EXISTS "authors_update_status_updates" ON status_updates;
CREATE POLICY "authors_update_status_updates" ON status_updates FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND public.project_access(project_id) IN ('manage', 'lead'))
  WITH CHECK (author_id = auth.uid() AND public.project_access(project_id) IN ('manage', 'lead'));
DROP POLICY IF EXISTS "authors_or_managers_delete_status_updates" ON status_updates;
CREATE POLICY "authors_or_managers_delete_status_updates" ON status_updates FOR DELETE TO authenticated
  USING (public.project_access(project_id) IN ('manage', 'lead'));

-- time_entries
DROP POLICY IF EXISTS "select_task_time" ON time_entries;
CREATE POLICY "select_task_time" ON time_entries FOR SELECT TO authenticated
  USING (public.task_access(task_id) IS NOT NULL);
DROP POLICY IF EXISTS "writers_insert_own_time" ON time_entries;
CREATE POLICY "writers_insert_own_time" ON time_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.task_access(task_id) IN ('write', 'write_delete', 'lead', 'manage'));
DROP POLICY IF EXISTS "owners_update_time" ON time_entries;
CREATE POLICY "owners_update_time" ON time_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.task_access(task_id) IN ('write', 'write_delete', 'lead', 'manage'))
  WITH CHECK (user_id = auth.uid() AND public.task_access(task_id) IN ('write', 'write_delete', 'lead', 'manage'));
DROP POLICY IF EXISTS "owners_or_managers_delete_time" ON time_entries;
CREATE POLICY "owners_or_managers_delete_time" ON time_entries FOR DELETE TO authenticated
  USING ((user_id = auth.uid() AND public.task_access(task_id) IS NOT NULL) OR public.task_access(task_id) IN ('manage', 'lead'));

-- attachments
DROP POLICY IF EXISTS "select_task_attachments" ON attachments;
CREATE POLICY "select_task_attachments" ON attachments FOR SELECT TO authenticated
  USING (public.task_access(task_id) IS NOT NULL);
DROP POLICY IF EXISTS "writers_insert_attachments" ON attachments;
CREATE POLICY "writers_insert_attachments" ON attachments FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.task_access(task_id) IN ('write', 'write_delete', 'lead', 'manage')
    -- The file must live in this card's own folder: "<project id>/<task id>/...".
    AND path LIKE (SELECT t.project_id::text FROM tasks t WHERE t.id = task_id) || '/' || task_id::text || '/%'
  );
DROP POLICY IF EXISTS "uploaders_or_managers_delete_attachments" ON attachments;
CREATE POLICY "uploaders_or_managers_delete_attachments" ON attachments FOR DELETE TO authenticated
  USING ((uploaded_by = auth.uid() AND public.task_access(task_id) IN ('write', 'write_delete', 'lead', 'manage')) OR public.task_access(task_id) IN ('manage', 'lead'));

-- ---------------------------------------------------------------- file storage
-- Private bucket; objects are stored as "<project id>/<task id>/<random>-<file name>".
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('attachments', 'attachments', false, 26214400)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 26214400;

CREATE OR REPLACE FUNCTION public.attachment_project(p_name text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN split_part(p_name, '/', 1)::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

DROP POLICY IF EXISTS "activtrack_read_attachments" ON storage.objects;
CREATE POLICY "activtrack_read_attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND public.project_access(public.attachment_project(name)) IS NOT NULL);
DROP POLICY IF EXISTS "activtrack_upload_attachments" ON storage.objects;
CREATE POLICY "activtrack_upload_attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND public.project_access(public.attachment_project(name)) IN ('write', 'write_delete', 'lead', 'manage'));
DROP POLICY IF EXISTS "activtrack_delete_attachments" ON storage.objects;
CREATE POLICY "activtrack_delete_attachments" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND public.project_access(public.attachment_project(name)) IN ('write', 'write_delete', 'lead', 'manage'));

-- ---------------------------------------------------------------- live updates
DO $$
DECLARE t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  FOREACH t IN ARRAY ARRAY['automations', 'status_updates', 'time_entries', 'attachments'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';


-- ---------------------------------------------------------------------------------
-- Accounts created before the tables existed get a profile and a private "My space".
-- The oldest such account becomes governor when there is no governor yet.
-- ---------------------------------------------------------------------------------
DO $$
DECLARE
  u record;
  v_role text;
  v_project uuid;
BEGIN
  FOR u IN
    SELECT * FROM auth.users au
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
    ORDER BY au.created_at
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'governor') THEN
      v_role := 'governor';
    ELSE
      v_role := coalesce(u.raw_app_meta_data->>'workday_role', 'reporter');
      IF v_role NOT IN ('governor', 'delegate', 'reporter') THEN
        v_role := 'reporter';
      END IF;
    END IF;

    INSERT INTO public.profiles (id, name, email, color, role)
    VALUES (
      u.id,
      left(coalesce(nullif(trim(u.raw_user_meta_data->>'name'), ''), nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'User'), 80),
      lower(coalesce(u.email, '')),
      '#0a8c4e',
      v_role
    );

    IF NOT EXISTS (SELECT 1 FROM public.projects WHERE is_personal AND owner_id = u.id) THEN
      INSERT INTO public.projects (name, description, color, is_personal, owner_id, created_by)
      VALUES ('My space', 'Your private space. Only you can see it.', '#0a8c4e', true, u.id, u.id)
      RETURNING id INTO v_project;

      INSERT INTO public.statuses (project_id, name, color, position, is_done) VALUES
        (v_project, 'To do', '#64748b', 0, false),
        (v_project, 'In progress', '#2550e8', 1, false),
        (v_project, 'Review', '#c9a227', 2, false),
        (v_project, 'Done', '#0a8c4e', 3, true);
    END IF;
  END LOOP;
END $$;

-- Tell the Supabase API about the new tables straight away.
NOTIFY pgrst, 'reload schema';
