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
