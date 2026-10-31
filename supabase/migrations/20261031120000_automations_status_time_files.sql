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
