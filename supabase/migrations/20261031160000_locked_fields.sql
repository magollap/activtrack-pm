/*
# Locked custom fields

## Plain-English summary
- A project lead can mark a custom field (for example Epic, Feature or Type) as "Project leads only".
- Everyone on the project still sees the value; only project leads and governors can set or change it.
- The rule is enforced here in the database, so it also applies to the AI assistant, bulk edits,
  automations, duplicated cards and direct API calls, not just the card screen.

## 1. Changes
- `custom_fields.locked` (boolean, default false).
- Trigger `tasks_guard_locked_fields` on `tasks` (insert, and updates of `custom_values`): refuses a
  change to a locked field's value unless the person is a project lead or governor of that project.

## 2. Security
- Locking and unlocking a field is a field change, so only project managers can do it (existing
  custom_fields policies).
- The trigger runs as SECURITY DEFINER with a fixed search_path and reads only field definitions.
- Statements run without a signed-in user (the SQL Editor, seed scripts) are not restricted.

## 3. Notes
- Safe to run more than once. Also included in supabase/setup.sql.
- Needs 20261030160000_custom_fields_templates.sql to have been run first.
*/

ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;
GRANT INSERT (locked), UPDATE (locked) ON custom_fields TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_locked_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  old_values jsonb := CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.custom_values, '{}'::jsonb) ELSE '{}'::jsonb END;
  new_values jsonb := COALESCE(NEW.custom_values, '{}'::jsonb);
  blocked text;
BEGIN
  -- No signed-in user: SQL Editor, migrations and seed scripts.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF old_values = new_values THEN
    RETURN NEW;
  END IF;
  IF public.project_access(NEW.project_id) IN ('manage', 'lead') THEN
    RETURN NEW;
  END IF;

  SELECT f.name INTO blocked
  FROM custom_fields f
  WHERE f.project_id = NEW.project_id
    AND f.locked
    AND (old_values -> f.id::text) IS DISTINCT FROM (new_values -> f.id::text)
  ORDER BY f.position
  LIMIT 1;

  IF blocked IS NOT NULL THEN
    RAISE EXCEPTION '"%" is locked. Only project leads can change it.', blocked
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_locked_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tasks_guard_locked_fields ON tasks;
CREATE TRIGGER tasks_guard_locked_fields
  BEFORE INSERT OR UPDATE OF custom_values ON tasks
  FOR EACH ROW EXECUTE FUNCTION public.guard_locked_fields();

NOTIFY pgrst, 'reload schema';
