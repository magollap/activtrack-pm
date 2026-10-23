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
