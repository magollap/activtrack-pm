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
