-- =====================================================================================
-- ActivTrack demo data: "Demo Project", a pet care SaaS (PawPal) built for a client
--
-- 50 cards: 10 To do, 15 In progress, 10 Review, 15 Done, spread over Aug 3 - Oct 30, 2026,
-- with sprints, epics, story points, checklists, comments and status history.
--
-- How to use: Supabase -> SQL Editor -> New query -> paste this file -> Run.
-- Needs: at least one ActivTrack account (the oldest governor owns the demo data).
-- Custom fields (Epic, Feature, Type, Story points, Sprint) are added only if the custom fields
-- database update has been run; otherwise the cards are created without them.
--
-- To remove the demo later:  DELETE FROM projects WHERE name = 'Demo Project' AND NOT is_personal;
-- =====================================================================================
DO $$
DECLARE
  v_owner uuid;
  v_project uuid;
  s_todo uuid; s_prog uuid; s_rev uuid; s_done uuid;
  f_epic uuid; f_feature uuid; f_type uuid; f_points uuid; f_sprint uuid;
  has_fields boolean := to_regclass('public.custom_fields') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'custom_values');
  has_lock boolean := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'custom_fields' AND column_name = 'locked');
  t uuid;
BEGIN
  SELECT id INTO v_owner FROM profiles WHERE role = 'governor' AND NOT disabled ORDER BY created_at LIMIT 1;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'No ActivTrack governor account found. Sign up in the app first, then run this again.';
  END IF;
  IF EXISTS (SELECT 1 FROM projects WHERE name = 'Demo Project' AND NOT is_personal) THEN
    RAISE EXCEPTION 'A "Demo Project" already exists. Delete it first: DELETE FROM projects WHERE name = ''Demo Project'' AND NOT is_personal;';
  END IF;

  INSERT INTO projects (name, description, color, is_personal, owner_id, created_by, created_at, updated_at)
  VALUES ('Demo Project', 'PawPal: pet care SaaS for Happy Tails Veterinary Group. Online booking, vet portal, telehealth, medical records and a mobile app. Fixed-scope build, 7 two-week sprints.', '#0a8c4e', false, NULL, v_owner, '2026-07-30 10:52:00-05', '2026-07-30 10:04:00-05')
  RETURNING id INTO v_project;

  INSERT INTO statuses (project_id, name, color, position, is_done) VALUES (v_project, 'To do', '#64748b', 0, false) RETURNING id INTO s_todo;
  INSERT INTO statuses (project_id, name, color, position, is_done) VALUES (v_project, 'In progress', '#2550e8', 1, false) RETURNING id INTO s_prog;
  INSERT INTO statuses (project_id, name, color, position, is_done) VALUES (v_project, 'Review', '#c9a227', 2, false) RETURNING id INTO s_rev;
  INSERT INTO statuses (project_id, name, color, position, is_done) VALUES (v_project, 'Done', '#0a8c4e', 3, true) RETURNING id INTO s_done;

  IF has_fields THEN
    INSERT INTO custom_fields (project_id, name, type, options, position, show_on_card)
    VALUES (v_project, 'Epic', 'select', '[{"id": "auth", "label": "Accounts & login", "color": "#2550e8"}, {"id": "pets", "label": "Pet profiles", "color": "#0a8c4e"}, {"id": "booking", "label": "Appointment booking", "color": "#c9a227"}, {"id": "vet", "label": "Vet clinic portal", "color": "#7c3aed"}, {"id": "notify", "label": "Reminders & notifications", "color": "#db2777"}, {"id": "pay", "label": "Payments & billing", "color": "#ea580c"}, {"id": "tele", "label": "Telehealth", "color": "#0d9488"}, {"id": "records", "label": "Medical records", "color": "#e11d48"}, {"id": "mobile", "label": "Mobile app", "color": "#0284c7"}, {"id": "platform", "label": "Platform & DevOps", "color": "#64748b"}]'::jsonb, 0, true) RETURNING id INTO f_epic;
    INSERT INTO custom_fields (project_id, name, type, options, position, show_on_card)
    VALUES (v_project, 'Feature', 'select', '[{"id": "signin", "label": "Sign-up & sign-in", "color": "#2550e8"}, {"id": "privacy", "label": "Roles & privacy", "color": "#475569"}, {"id": "find", "label": "Search & lost pets", "color": "#0d9488"}, {"id": "health", "label": "Health tracking", "color": "#16a34a"}, {"id": "profiles", "label": "Pet profiles & photos", "color": "#0a8c4e"}, {"id": "engine", "label": "Scheduling engine", "color": "#a16207"}, {"id": "ownerbook", "label": "Owner booking flow", "color": "#c9a227"}, {"id": "clinicsetup", "label": "Clinic setup", "color": "#7c3aed"}, {"id": "clinicops", "label": "Clinic daily operations", "color": "#9333ea"}, {"id": "vaccines", "label": "Vaccine reminders", "color": "#be185d"}, {"id": "apptrem", "label": "Appointment reminders", "color": "#db2777"}, {"id": "subs", "label": "Subscriptions & store", "color": "#c2410c"}, {"id": "checkout", "label": "Deposits & invoices", "color": "#ea580c"}, {"id": "video", "label": "Video visits", "color": "#0d9488"}, {"id": "insurance", "label": "Insurance claims", "color": "#be123c"}, {"id": "history", "label": "Medical history", "color": "#e11d48"}, {"id": "mobilev1", "label": "Mobile app v1", "color": "#0284c7"}, {"id": "quality", "label": "Quality & release", "color": "#64748b"}, {"id": "infra", "label": "Infrastructure", "color": "#334155"}]'::jsonb, 1, false) RETURNING id INTO f_feature;
    INSERT INTO custom_fields (project_id, name, type, options, position, show_on_card)
    VALUES (v_project, 'Type', 'select', '[{"id": "feature", "label": "Feature", "color": "#2550e8"}, {"id": "bug", "label": "Bug", "color": "#e11d48"}, {"id": "chore", "label": "Chore", "color": "#64748b"}, {"id": "spike", "label": "Spike", "color": "#c9a227"}]'::jsonb, 2, true) RETURNING id INTO f_type;
    INSERT INTO custom_fields (project_id, name, type, options, position, show_on_card)
    VALUES (v_project, 'Story points', 'number', '[]'::jsonb, 3, true) RETURNING id INTO f_points;
    INSERT INTO custom_fields (project_id, name, type, options, position, show_on_card)
    VALUES (v_project, 'Sprint', 'select', '[{"id": "s1", "label": "Sprint 1", "color": "#64748b"}, {"id": "s2", "label": "Sprint 2", "color": "#64748b"}, {"id": "s3", "label": "Sprint 3", "color": "#64748b"}, {"id": "s4", "label": "Sprint 4", "color": "#64748b"}, {"id": "s5", "label": "Sprint 5", "color": "#64748b"}, {"id": "s6", "label": "Sprint 6", "color": "#64748b"}, {"id": "s7", "label": "Sprint 7", "color": "#c9a227"}]'::jsonb, 4, false) RETURNING id INTO f_sprint;
    -- Planning fields: only project leads (the scrum master) change Epic, Feature and Type.
    IF has_lock THEN
      EXECUTE 'UPDATE custom_fields SET locked = true WHERE id = ANY($1)' USING ARRAY[f_epic, f_feature, f_type];
    END IF;
  END IF;


  -- done: Set up AWS environments (dev, staging, prod) with Terraform
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Set up AWS environments (dev, staging, prod) with Terraform', 'Separate VPCs per environment, remote state in S3 with DynamoDB locking.', s_done, 'high', NULL, '2026-08-06', '2026-08-13', 0, '2026-08-10 17:49:00-05', v_owner, '2026-08-05 11:08:00-05', '2026-08-10 18:42:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'platform', f_feature::text, 'infra', f_type::text, 'chore', f_points::text, 8, f_sprint::text, 's1'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'VPC and subnets', true, 0, '2026-08-05 16:35:00-05', '2026-08-10 11:16:00-05'), (t, 'RDS Postgres', true, 1, '2026-08-05 17:55:00-05', '2026-08-10 15:13:00-05'), (t, 'S3 state backend', true, 2, '2026-08-05 17:48:00-05', '2026-08-10 12:45:00-05'), (t, 'IAM roles for CI', true, 3, '2026-08-05 13:25:00-05', '2026-08-10 14:28:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-08-06 16:07:00-05', '2026-08-06 12:14:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-08-08 10:21:00-05', '2026-08-08 09:37:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-08-10 17:14:00-05', '2026-08-10 12:00:00-05');

  -- done: CI/CD pipeline with GitHub Actions
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'CI/CD pipeline with GitHub Actions', 'Lint, test and build on every PR; deploy to staging on merge to main.', s_done, 'high', v_owner, '2026-08-10', '2026-08-19', 1, '2026-08-16 09:14:00-05', v_owner, '2026-08-08 10:57:00-05', '2026-08-16 18:02:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'platform', f_feature::text, 'infra', f_type::text, 'chore', f_points::text, 5, f_sprint::text, 's1'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Lint and unit tests', true, 0, '2026-08-08 14:04:00-05', '2026-08-16 17:15:00-05'), (t, 'Docker build and push', true, 1, '2026-08-08 13:42:00-05', '2026-08-16 16:13:00-05'), (t, 'Staging auto-deploy', true, 2, '2026-08-08 17:08:00-05', '2026-08-16 16:15:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-08-10 15:12:00-05', '2026-08-10 10:06:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-08-15 15:22:00-05', '2026-08-15 15:26:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-08-16 16:55:00-05', '2026-08-16 09:43:00-05');

  -- done: Pet owner sign-up with email verification
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Pet owner sign-up with email verification', 'Owners sign up with email and password; verification link expires after 24 hours.', s_done, 'high', NULL, '2026-08-16', '2026-08-24', 2, '2026-08-26 10:03:00-05', v_owner, '2026-08-15 15:46:00-05', '2026-08-26 18:21:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'auth', f_feature::text, 'signin', f_type::text, 'feature', f_points::text, 5, f_sprint::text, 's1'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Sign-up form', true, 0, '2026-08-15 10:15:00-05', '2026-08-26 12:12:00-05'), (t, 'Verification email', true, 1, '2026-08-15 17:28:00-05', '2026-08-26 11:27:00-05'), (t, 'Expired link handling', true, 2, '2026-08-15 11:17:00-05', '2026-08-26 16:15:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-08-16 10:28:00-05', '2026-08-16 17:06:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-08-25 09:41:00-05', '2026-08-25 17:53:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-08-26 09:05:00-05', '2026-08-26 12:10:00-05');

  -- done: Login, logout and password reset
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Login, logout and password reset', 'Standard auth flows, rate limited.', s_done, 'high', v_owner, '2026-08-20', '2026-08-29', 3, '2026-08-27 16:13:00-05', v_owner, '2026-08-18 15:57:00-05', '2026-08-27 18:03:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'auth', f_feature::text, 'signin', f_type::text, 'feature', f_points::text, 3, f_sprint::text, 's2'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Login', true, 0, '2026-08-18 11:24:00-05', '2026-08-27 09:24:00-05'), (t, 'Forgot password email', true, 1, '2026-08-18 13:59:00-05', '2026-08-27 16:18:00-05'), (t, 'Reset form', true, 2, '2026-08-18 15:44:00-05', '2026-08-27 17:42:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Merged after review. Thanks!', '2026-08-20 13:13:00-05', '2026-08-20 09:37:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-08-20 17:03:00-05', '2026-08-20 14:03:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-08-24 09:37:00-05', '2026-08-24 16:32:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-08-27 17:10:00-05', '2026-08-27 09:32:00-05');

  -- done: Create and edit pet profile
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Create and edit pet profile', 'Name, species, breed, birthday, weight, photo, microchip number.', s_done, 'high', v_owner, '2026-08-25', '2026-09-07', 4, '2026-09-06 11:04:00-05', v_owner, '2026-08-23 10:43:00-05', '2026-09-06 18:55:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'pets', f_feature::text, 'profiles', f_type::text, 'feature', f_points::text, 5, f_sprint::text, 's2'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Form with validation', true, 0, '2026-08-23 12:25:00-05', '2026-09-06 10:56:00-05'), (t, 'Photo upload', true, 1, '2026-08-23 12:37:00-05', '2026-09-06 09:39:00-05'), (t, 'Edit and delete', true, 2, '2026-08-23 10:26:00-05', '2026-09-06 17:20:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-08-25 12:42:00-05', '2026-08-25 14:15:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-09-05 13:25:00-05', '2026-09-05 11:42:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-09-06 13:29:00-05', '2026-09-06 14:59:00-05');

  -- done: Multiple pets per household
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Multiple pets per household', 'Owners can add several pets and switch between them.', s_done, 'medium', NULL, '2026-09-01', '2026-09-09', 5, '2026-09-05 10:00:00-05', v_owner, '2026-08-29 16:39:00-05', '2026-09-05 18:36:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'pets', f_feature::text, 'profiles', f_type::text, 'feature', f_points::text, 3, f_sprint::text, 's3'), t;
  END IF;
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-01 10:34:00-05', '2026-09-01 12:32:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-09-04 13:08:00-05', '2026-09-04 14:56:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-09-05 10:56:00-05', '2026-09-05 12:23:00-05');

  -- done: Breed list for dogs and cats
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Breed list for dogs and cats', 'Searchable breed picker seeded from the client''s list.', s_done, 'low', v_owner, '2026-09-08', '2026-09-17', 6, '2026-09-17 16:53:00-05', v_owner, '2026-09-04 17:45:00-05', '2026-09-17 18:19:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'pets', f_feature::text, 'profiles', f_type::text, 'chore', f_points::text, 2, f_sprint::text, 's3'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Deployed to production, verified with the client.', '2026-09-16 17:19:00-05', '2026-09-16 10:56:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-08 11:16:00-05', '2026-09-08 10:56:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-09-16 10:47:00-05', '2026-09-16 17:09:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-09-17 13:18:00-05', '2026-09-17 12:45:00-05');

  -- done: Clinic onboarding: add vets and opening hours
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Clinic onboarding: add vets and opening hours', 'Clinic admins add vets, rooms and weekly opening hours.', s_done, 'high', v_owner, '2026-09-10', '2026-09-13', 7, '2026-09-15 13:32:00-05', v_owner, '2026-09-07 16:16:00-05', '2026-09-15 18:57:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'vet', f_feature::text, 'clinicsetup', f_type::text, 'feature', f_points::text, 8, f_sprint::text, 's3'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Vet list', true, 0, '2026-09-07 09:05:00-05', '2026-09-15 15:53:00-05'), (t, 'Opening hours editor', true, 1, '2026-09-07 13:02:00-05', '2026-09-15 09:21:00-05'), (t, 'Holiday closures', true, 2, '2026-09-07 11:40:00-05', '2026-09-15 13:10:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Client signed off in the weekly demo.', '2026-09-15 17:00:00-05', '2026-09-15 10:04:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-10 11:34:00-05', '2026-09-10 09:53:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-09-13 14:37:00-05', '2026-09-13 17:09:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-09-15 15:08:00-05', '2026-09-15 09:19:00-05');

  -- done: Appointment slots engine
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Appointment slots engine', 'Generates bookable slots from opening hours, vet availability and appointment length.', s_done, 'urgent', v_owner, '2026-09-15', '2026-09-26', 8, '2026-09-24 09:57:00-05', v_owner, '2026-09-12 14:13:00-05', '2026-09-24 18:43:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'booking', f_feature::text, 'engine', f_type::text, 'feature', f_points::text, 13, f_sprint::text, 's4'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Slot generation', true, 0, '2026-09-12 12:42:00-05', '2026-09-24 10:22:00-05'), (t, 'Overlap checks', true, 1, '2026-09-12 17:56:00-05', '2026-09-24 15:39:00-05'), (t, 'Time zone handling', true, 2, '2026-09-12 11:59:00-05', '2026-09-24 12:55:00-05'), (t, 'Unit tests', true, 3, '2026-09-12 11:51:00-05', '2026-09-24 11:56:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'QA passed on staging.', '2026-09-14 15:51:00-05', '2026-09-14 12:17:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-15 11:50:00-05', '2026-09-15 10:24:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-09-22 09:54:00-05', '2026-09-22 16:14:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-09-24 12:52:00-05', '2026-09-24 16:22:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'priority', 'High', 'Urgent', v_owner, '2026-09-15 09:19:00-05', '2026-09-15 09:52:00-05');

  -- done: Book an appointment (owner web flow)
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Book an appointment (owner web flow)', 'Pick pet, reason, vet and slot; confirmation screen and email.', s_done, 'high', NULL, '2026-09-21', '2026-10-01', 9, '2026-10-03 12:14:00-05', v_owner, '2026-09-17 09:42:00-05', '2026-10-03 18:12:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'booking', f_feature::text, 'ownerbook', f_type::text, 'feature', f_points::text, 8, f_sprint::text, 's4'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Reason picker', true, 0, '2026-09-17 15:21:00-05', '2026-10-03 13:55:00-05'), (t, 'Slot picker', true, 1, '2026-09-17 10:49:00-05', '2026-10-03 13:22:00-05'), (t, 'Confirmation email', true, 2, '2026-09-17 17:25:00-05', '2026-10-03 17:21:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-21 10:56:00-05', '2026-09-21 13:11:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-10-01 13:02:00-05', '2026-10-01 10:38:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-10-03 15:22:00-05', '2026-10-03 14:27:00-05');

  -- done: Fix double booking when two owners pick the same slot
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Fix double booking when two owners pick the same slot', 'Race condition under load. Use a unique constraint plus retry.', s_done, 'urgent', NULL, '2026-09-25', '2026-10-06', 10, '2026-10-04 17:07:00-05', v_owner, '2026-09-22 15:57:00-05', '2026-10-04 18:36:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'booking', f_feature::text, 'engine', f_type::text, 'bug', f_points::text, 3, f_sprint::text, 's4'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Reproduce with load test', true, 0, '2026-09-22 12:16:00-05', '2026-10-04 09:45:00-05'), (t, 'DB constraint', true, 1, '2026-09-22 15:00:00-05', '2026-10-04 17:59:00-05'), (t, 'Friendly error message', true, 2, '2026-09-22 17:43:00-05', '2026-10-04 12:23:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'QA passed on staging.', '2026-10-02 14:42:00-05', '2026-10-02 10:46:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-25 13:32:00-05', '2026-09-25 13:42:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-10-03 15:20:00-05', '2026-10-03 15:44:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-10-04 13:35:00-05', '2026-10-04 11:12:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'priority', 'High', 'Urgent', v_owner, '2026-09-25 09:26:00-05', '2026-09-25 09:42:00-05');

  -- done: Email reminders 24 hours before appointments
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Email reminders 24 hours before appointments', 'Scheduled job sends reminders with reschedule and cancel links.', s_done, 'medium', NULL, '2026-09-30', '2026-10-07', 11, '2026-10-04 11:39:00-05', v_owner, '2026-09-29 13:25:00-05', '2026-10-04 18:35:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'notify', f_feature::text, 'apptrem', f_type::text, 'feature', f_points::text, 5, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Scheduler job', true, 0, '2026-09-29 09:19:00-05', '2026-10-04 13:13:00-05'), (t, 'Email template', true, 1, '2026-09-29 15:50:00-05', '2026-10-04 14:29:00-05'), (t, 'Unsubscribe link', true, 2, '2026-09-29 16:28:00-05', '2026-10-04 12:32:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Merged after review. Thanks!', '2026-10-05 10:18:00-05', '2026-10-05 17:42:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-30 14:05:00-05', '2026-09-30 12:43:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-10-03 13:14:00-05', '2026-10-03 12:09:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-10-04 09:02:00-05', '2026-10-04 12:30:00-05');

  -- done: Vaccination records upload (PDF and photo)
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Vaccination records upload (PDF and photo)', 'Owners upload vaccine certificates; vets can verify them.', s_done, 'medium', NULL, '2026-10-04', '2026-10-15', 12, '2026-10-11 10:29:00-05', v_owner, '2026-10-03 15:56:00-05', '2026-10-11 18:40:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'records', f_feature::text, 'history', f_type::text, 'feature', f_points::text, 5, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Upload to S3', true, 0, '2026-10-03 12:45:00-05', '2026-10-11 15:31:00-05'), (t, 'Virus scan', true, 1, '2026-10-03 15:15:00-05', '2026-10-11 11:41:00-05'), (t, 'Verified badge', true, 2, '2026-10-03 09:57:00-05', '2026-10-11 10:49:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Client signed off in the weekly demo.', '2026-10-05 09:35:00-05', '2026-10-05 12:58:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-04 10:29:00-05', '2026-10-04 11:51:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-10-10 16:42:00-05', '2026-10-10 17:35:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-10-11 14:48:00-05', '2026-10-11 16:39:00-05');

  -- done: Stripe integration for clinic deposits
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Stripe integration for clinic deposits', 'Optional deposit when booking; refunds on cancellation more than 24 hours before.', s_done, 'high', NULL, '2026-10-11', '2026-10-25', 13, '2026-10-22 17:27:00-05', v_owner, '2026-10-08 17:28:00-05', '2026-10-22 18:57:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'pay', f_feature::text, 'checkout', f_type::text, 'feature', f_points::text, 8, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Stripe Checkout', true, 0, '2026-10-08 11:47:00-05', '2026-10-22 16:28:00-05'), (t, 'Webhooks', true, 1, '2026-10-08 13:48:00-05', '2026-10-22 12:53:00-05'), (t, 'Refund rules', true, 2, '2026-10-08 13:49:00-05', '2026-10-22 17:31:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Client signed off in the weekly demo.', '2026-10-16 10:45:00-05', '2026-10-16 13:15:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-11 13:21:00-05', '2026-10-11 14:57:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-10-20 17:05:00-05', '2026-10-20 11:09:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-10-22 12:24:00-05', '2026-10-22 11:45:00-05');

  -- done: Spike: telehealth video provider comparison
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Spike: telehealth video provider comparison', 'Compared Twilio, Daily and Vonage on price, HIPAA-style compliance and SDK quality. Recommendation: Daily.', s_done, 'medium', v_owner, '2026-10-15', '2026-10-23', 14, '2026-10-24 15:26:00-05', v_owner, '2026-10-12 14:34:00-05', '2026-10-24 18:29:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'tele', f_feature::text, 'video', f_type::text, 'spike', f_points::text, 3, f_sprint::text, 's6'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Client signed off in the weekly demo.', '2026-10-15 15:57:00-05', '2026-10-15 09:54:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-15 15:30:00-05', '2026-10-15 09:22:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-10-21 13:48:00-05', '2026-10-21 15:54:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'Review', 'Done', v_owner, '2026-10-24 15:34:00-05', '2026-10-24 17:51:00-05');

  -- review: Reschedule and cancel appointment
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Reschedule and cancel appointment', 'Owners reschedule or cancel up to the clinic''s cutoff time.', s_rev, 'high', v_owner, '2026-09-24', '2026-11-05', 0, NULL, v_owner, '2026-09-18 12:17:00-05', '2026-10-01 18:27:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'booking', f_feature::text, 'ownerbook', f_type::text, 'feature', f_points::text, 5, f_sprint::text, 's4'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Reschedule flow', true, 0, '2026-09-18 09:24:00-05', '2026-10-01 14:42:00-05'), (t, 'Cancellation policy text', true, 1, '2026-09-18 15:46:00-05', '2026-10-01 11:53:00-05'), (t, 'Notify clinic', false, 2, '2026-09-18 16:58:00-05', '2026-10-01 11:39:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Client wants to see this in Thursday''s demo.', '2026-10-02 09:05:00-05', '2026-10-02 15:08:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-24 16:11:00-05', '2026-09-24 09:16:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-10-01 15:20:00-05', '2026-10-01 12:29:00-05');

  -- review: Vet daily schedule view
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Vet daily schedule view', 'Day and week views of a vet''s appointments with pet details.', s_rev, 'high', v_owner, '2026-09-16', '2026-10-29', 1, NULL, v_owner, '2026-09-11 15:17:00-05', '2026-10-04 18:48:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'vet', f_feature::text, 'clinicops', f_type::text, 'feature', f_points::text, 8, f_sprint::text, 's4'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Day view', true, 0, '2026-09-11 13:53:00-05', '2026-10-04 10:30:00-05'), (t, 'Week view', true, 1, '2026-09-11 09:47:00-05', '2026-10-04 17:03:00-05'), (t, 'Print layout', false, 2, '2026-09-11 14:14:00-05', '2026-10-04 10:49:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-16 09:48:00-05', '2026-09-16 09:15:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-10-04 12:53:00-05', '2026-10-04 09:39:00-05');

  -- review: SMS reminders via Twilio
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'SMS reminders via Twilio', 'Opt-in SMS reminders in addition to email.', s_rev, 'medium', v_owner, '2026-10-04', '2026-11-06', 2, NULL, v_owner, '2026-09-30 11:30:00-05', '2026-10-15 18:42:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'notify', f_feature::text, 'apptrem', f_type::text, 'feature', f_points::text, 5, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Opt-in setting', true, 0, '2026-09-30 12:29:00-05', '2026-10-15 13:49:00-05'), (t, 'Twilio integration', true, 1, '2026-09-30 14:10:00-05', '2026-10-15 10:49:00-05'), (t, 'STOP handling', false, 2, '2026-09-30 11:19:00-05', '2026-10-15 10:37:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Client wants to see this in Thursday''s demo.', '2026-10-09 15:45:00-05', '2026-10-09 12:04:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-04 12:06:00-05', '2026-10-04 13:54:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-10-15 10:50:00-05', '2026-10-15 09:22:00-05');

  -- review: Medication schedule for pets
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Medication schedule for pets', 'Vets prescribe medication with dose and frequency; owners get reminders.', s_rev, 'high', v_owner, '2026-10-08', '2026-11-08', 3, NULL, v_owner, '2026-10-06 14:04:00-05', '2026-10-21 18:32:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'records', f_feature::text, 'history', f_type::text, 'feature', f_points::text, 8, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Prescription form', true, 0, '2026-10-06 09:54:00-05', '2026-10-21 15:52:00-05'), (t, 'Owner reminder', true, 1, '2026-10-06 16:06:00-05', '2026-10-21 15:23:00-05'), (t, 'Mark dose given', false, 2, '2026-10-06 16:45:00-05', '2026-10-21 11:27:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Addressed review comments, one more look please.', '2026-10-22 17:49:00-05', '2026-10-22 16:29:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-08 15:52:00-05', '2026-10-08 13:20:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-10-21 12:53:00-05', '2026-10-21 10:17:00-05');

  -- review: Invoices and receipts PDF
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Invoices and receipts PDF', 'Downloadable invoices with clinic branding.', s_rev, 'medium', v_owner, '2026-09-06', '2026-11-08', 4, NULL, v_owner, '2026-09-04 16:36:00-05', '2026-09-11 18:39:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'pay', f_feature::text, 'checkout', f_type::text, 'feature', f_points::text, 5, f_sprint::text, 's3'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'PR is up, please review.', '2026-09-09 16:54:00-05', '2026-09-09 14:11:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-06 16:13:00-05', '2026-09-06 14:51:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-09-11 13:21:00-05', '2026-09-11 13:56:00-05');

  -- review: Fix pet photo upload failing on iPhone HEIC images
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Fix pet photo upload failing on iPhone HEIC images', 'Convert HEIC to JPEG on the server before resizing.', s_rev, 'high', v_owner, '2026-09-25', '2026-10-28', 5, NULL, v_owner, '2026-09-21 13:35:00-05', '2026-10-15 18:00:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'pets', f_feature::text, 'profiles', f_type::text, 'bug', f_points::text, 2, f_sprint::text, 's4'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'PR is up, please review.', '2026-09-27 12:46:00-05', '2026-09-27 15:31:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-25 17:48:00-05', '2026-09-25 12:44:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-10-15 16:41:00-05', '2026-10-15 16:28:00-05');

  -- review: Role-based access for clinic staff
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Role-based access for clinic staff', 'Admin, vet and receptionist roles with different permissions.', s_rev, 'high', v_owner, '2026-09-19', '2026-10-30', 6, NULL, v_owner, '2026-09-14 12:25:00-05', '2026-10-12 18:44:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'auth', f_feature::text, 'privacy', f_type::text, 'feature', f_points::text, 5, f_sprint::text, 's4'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Role model', true, 0, '2026-09-14 13:42:00-05', '2026-10-12 14:30:00-05'), (t, 'Permission checks', true, 1, '2026-09-14 17:33:00-05', '2026-10-12 14:27:00-05'), (t, 'Audit log', false, 2, '2026-09-14 17:21:00-05', '2026-10-12 14:44:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Addressed review comments, one more look please.', '2026-09-23 12:07:00-05', '2026-09-23 12:20:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-19 10:47:00-05', '2026-09-19 17:48:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-10-12 11:12:00-05', '2026-10-12 12:47:00-05');

  -- review: Load test booking API (500 concurrent users)
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Load test booking API (500 concurrent users)', 'k6 scripts against staging; target p95 under 300 ms.', s_rev, 'medium', v_owner, '2026-10-06', '2026-11-03', 7, NULL, v_owner, '2026-10-02 17:38:00-05', '2026-10-29 18:18:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'platform', f_feature::text, 'quality', f_type::text, 'chore', f_points::text, 3, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-06 12:18:00-05', '2026-10-06 12:23:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-10-29 11:19:00-05', '2026-10-29 09:45:00-05');

  -- review: Weight tracking chart
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Weight tracking chart', 'Line chart of weight over time from visit notes.', s_rev, 'low', v_owner, '2026-09-13', '2026-10-30', 8, NULL, v_owner, '2026-09-10 13:02:00-05', '2026-09-24 18:03:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'pets', f_feature::text, 'health', f_type::text, 'feature', f_points::text, 3, f_sprint::text, 's3'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Client wants to see this in Thursday''s demo.', '2026-09-14 10:55:00-05', '2026-09-14 09:36:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-13 13:30:00-05', '2026-09-13 16:28:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-09-24 14:11:00-05', '2026-09-24 09:16:00-05');

  -- review: Accessibility pass on booking flow
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Accessibility pass on booking flow', 'Keyboard navigation, labels and contrast to WCAG AA.', s_rev, 'medium', v_owner, '2026-10-11', '2026-11-07', 9, NULL, v_owner, '2026-10-06 10:25:00-05', '2026-10-22 18:31:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'booking', f_feature::text, 'ownerbook', f_type::text, 'chore', f_points::text, 3, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Keyboard nav', true, 0, '2026-10-06 09:09:00-05', '2026-10-22 11:51:00-05'), (t, 'Screen reader labels', true, 1, '2026-10-06 13:05:00-05', '2026-10-22 12:07:00-05'), (t, 'Contrast fixes', false, 2, '2026-10-06 17:48:00-05', '2026-10-22 15:38:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Client wants to see this in Thursday''s demo.', '2026-10-13 16:58:00-05', '2026-10-13 16:19:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-11 15:19:00-05', '2026-10-11 09:39:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'In progress', 'Review', v_owner, '2026-10-22 10:48:00-05', '2026-10-22 12:40:00-05');

  -- progress: Telehealth video consultations (Daily SDK)
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Telehealth video consultations (Daily SDK)', 'Video calls between owner and vet from the appointment page.', s_prog, 'urgent', v_owner, '2026-10-24', '2026-11-13', 0, NULL, v_owner, '2026-10-17 10:10:00-05', '2026-10-24 18:15:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'tele', f_feature::text, 'video', f_type::text, 'feature', f_points::text, 13, f_sprint::text, 's6'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Room creation API', true, 0, '2026-10-17 17:04:00-05', '2026-10-24 11:00:00-05'), (t, 'Waiting room', false, 1, '2026-10-17 15:28:00-05', '2026-10-24 16:18:00-05'), (t, 'Call UI', false, 2, '2026-10-17 09:14:00-05', '2026-10-24 13:45:00-05'), (t, 'Recording consent', false, 3, '2026-10-17 13:44:00-05', '2026-10-24 16:04:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Blocked briefly on credentials from the client, now unblocked.', '2026-10-21 15:07:00-05', '2026-10-21 17:14:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-24 11:58:00-05', '2026-10-24 13:52:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'priority', 'High', 'Urgent', v_owner, '2026-10-24 09:09:00-05', '2026-10-24 09:04:00-05');

  -- progress: Visit notes and SOAP records
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Visit notes and SOAP records', 'Vets write SOAP notes after each visit; owners see a summary.', s_prog, 'high', v_owner, '2026-10-11', '2026-11-02', 1, NULL, v_owner, '2026-10-05 13:38:00-05', '2026-10-11 18:47:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'records', f_feature::text, 'history', f_type::text, 'feature', f_points::text, 8, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'SOAP editor', true, 0, '2026-10-05 16:07:00-05', '2026-10-11 16:44:00-05'), (t, 'Owner summary', true, 1, '2026-10-05 13:44:00-05', '2026-10-11 15:17:00-05'), (t, 'Attachments', false, 2, '2026-10-05 17:34:00-05', '2026-10-11 16:28:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Scope confirmed with the client PM.', '2026-10-05 14:38:00-05', '2026-10-05 13:01:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-11 10:14:00-05', '2026-10-11 09:48:00-05');

  -- progress: Mobile app: login and pet list (React Native)
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Mobile app: login and pet list (React Native)', 'First mobile screens sharing the web API.', s_prog, 'high', v_owner, '2026-09-26', '2026-10-28', 2, NULL, v_owner, '2026-09-18 09:48:00-05', '2026-09-26 18:48:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'mobile', f_feature::text, 'mobilev1', f_type::text, 'feature', f_points::text, 8, f_sprint::text, 's4'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Expo setup', true, 0, '2026-09-18 16:33:00-05', '2026-09-26 16:58:00-05'), (t, 'Login screen', false, 1, '2026-09-18 13:11:00-05', '2026-09-26 15:40:00-05'), (t, 'Pet list', false, 2, '2026-09-18 16:05:00-05', '2026-09-26 16:22:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'About halfway, API done, UI next.', '2026-09-23 11:21:00-05', '2026-09-23 15:44:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-26 16:18:00-05', '2026-09-26 15:52:00-05');

  -- progress: Mobile app: push notifications
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Mobile app: push notifications', 'Appointment reminders and vet messages via FCM and APNs.', s_prog, 'medium', v_owner, '2026-09-15', '2026-10-30', 3, NULL, v_owner, '2026-09-13 10:20:00-05', '2026-09-15 18:16:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'mobile', f_feature::text, 'mobilev1', f_type::text, 'feature', f_points::text, 5, f_sprint::text, 's4'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'About halfway, API done, UI next.', '2026-09-16 17:29:00-05', '2026-09-16 15:03:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-15 12:33:00-05', '2026-09-15 14:39:00-05');

  -- progress: Subscription plans for clinics (Stripe Billing)
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Subscription plans for clinics (Stripe Billing)', 'Starter, Pro and Enterprise plans with a 14-day trial.', s_prog, 'high', v_owner, '2026-10-23', '2026-11-16', 4, NULL, v_owner, '2026-10-20 09:13:00-05', '2026-10-23 18:17:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'pay', f_feature::text, 'subs', f_type::text, 'feature', f_points::text, 8, f_sprint::text, 's6'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Plans in Stripe', true, 0, '2026-10-20 13:28:00-05', '2026-10-23 16:07:00-05'), (t, 'Upgrade and downgrade', false, 1, '2026-10-20 09:40:00-05', '2026-10-23 12:45:00-05'), (t, 'Trial ending email', false, 2, '2026-10-20 11:19:00-05', '2026-10-23 17:00:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Blocked briefly on credentials from the client, now unblocked.', '2026-10-20 10:29:00-05', '2026-10-20 10:41:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-23 11:31:00-05', '2026-10-23 13:32:00-05');

  -- progress: Owner to clinic messaging
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Owner to clinic messaging', 'Secure chat between owners and clinic staff, with attachments.', s_prog, 'medium', v_owner, '2026-10-09', '2026-11-07', 5, NULL, v_owner, '2026-10-07 16:30:00-05', '2026-10-09 18:15:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'vet', f_feature::text, 'clinicops', f_type::text, 'feature', f_points::text, 8, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Scope confirmed with the client PM.', '2026-10-08 12:58:00-05', '2026-10-08 17:47:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-09 11:55:00-05', '2026-10-09 10:17:00-05');

  -- progress: Clinic analytics dashboard
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Clinic analytics dashboard', 'Bookings, no-shows and revenue per week for clinic admins.', s_prog, 'medium', NULL, '2026-10-12', '2026-11-11', 6, NULL, v_owner, '2026-10-04 14:59:00-05', '2026-10-12 18:50:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'vet', f_feature::text, 'clinicops', f_type::text, 'feature', f_points::text, 8, f_sprint::text, 's6'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Bookings chart', true, 0, '2026-10-04 09:18:00-05', '2026-10-12 13:53:00-05'), (t, 'No-show rate', true, 1, '2026-10-04 16:55:00-05', '2026-10-12 11:28:00-05'), (t, 'Revenue by service', false, 2, '2026-10-04 17:30:00-05', '2026-10-12 14:21:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Scope confirmed with the client PM.', '2026-10-12 16:59:00-05', '2026-10-12 14:55:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-12 12:44:00-05', '2026-10-12 12:36:00-05');

  -- progress: Fix reminder emails sent in UTC instead of clinic time zone
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Fix reminder emails sent in UTC instead of clinic time zone', 'Customer reported reminders arriving at 3 AM.', s_prog, 'high', v_owner, '2026-09-27', '2026-11-16', 7, NULL, v_owner, '2026-09-26 15:02:00-05', '2026-09-27 18:20:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'notify', f_feature::text, 'apptrem', f_type::text, 'bug', f_points::text, 2, f_sprint::text, 's4'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Scope confirmed with the client PM.', '2026-09-28 15:42:00-05', '2026-09-28 11:31:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-27 09:08:00-05', '2026-09-27 17:37:00-05');

  -- progress: Waitlist when no slots are free
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Waitlist when no slots are free', 'Owners join a waitlist and are offered cancelled slots first.', s_prog, 'medium', v_owner, '2026-09-22', '2026-11-15', 8, NULL, v_owner, '2026-09-17 10:55:00-05', '2026-09-22 18:54:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'booking', f_feature::text, 'engine', f_type::text, 'feature', f_points::text, 5, f_sprint::text, 's4'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Scope confirmed with the client PM.', '2026-09-21 09:46:00-05', '2026-09-21 11:26:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-22 11:04:00-05', '2026-09-22 16:50:00-05');

  -- progress: Export medical history as PDF
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Export medical history as PDF', 'For owners moving to a new clinic.', s_prog, 'medium', v_owner, '2026-10-03', '2026-11-04', 9, NULL, v_owner, '2026-10-01 15:41:00-05', '2026-10-03 18:05:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'records', f_feature::text, 'history', f_type::text, 'feature', f_points::text, 3, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-03 17:24:00-05', '2026-10-03 14:40:00-05');

  -- progress: Kubernetes migration for API services (EKS)
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Kubernetes migration for API services (EKS)', 'Move API and workers from ECS to EKS with Helm charts and autoscaling.', s_prog, 'high', NULL, '2026-10-10', '2026-11-09', 10, NULL, v_owner, '2026-10-07 17:02:00-05', '2026-10-10 18:39:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'platform', f_feature::text, 'infra', f_type::text, 'chore', f_points::text, 13, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Helm charts', true, 0, '2026-10-07 12:40:00-05', '2026-10-10 13:14:00-05'), (t, 'HPA config', false, 1, '2026-10-07 10:27:00-05', '2026-10-10 10:48:00-05'), (t, 'Ingress and TLS', false, 2, '2026-10-07 10:28:00-05', '2026-10-10 11:44:00-05'), (t, 'Cut-over plan', false, 3, '2026-10-07 13:57:00-05', '2026-10-10 09:02:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Pairing on this tomorrow.', '2026-10-07 14:23:00-05', '2026-10-07 15:09:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-10 12:33:00-05', '2026-10-10 15:36:00-05');

  -- progress: Observability: logs, metrics and alerts
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Observability: logs, metrics and alerts', 'Grafana dashboards and PagerDuty alerts for booking and payments.', s_prog, 'high', v_owner, '2026-09-15', '2026-11-11', 11, NULL, v_owner, '2026-09-10 11:05:00-05', '2026-09-15 18:39:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'platform', f_feature::text, 'infra', f_type::text, 'chore', f_points::text, 5, f_sprint::text, 's4'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Prometheus metrics', true, 0, '2026-09-10 12:31:00-05', '2026-09-15 11:14:00-05'), (t, 'Grafana dashboards', true, 1, '2026-09-10 16:40:00-05', '2026-09-15 13:29:00-05'), (t, 'Alert rules', false, 2, '2026-09-10 13:42:00-05', '2026-09-15 09:57:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-15 13:43:00-05', '2026-09-15 17:10:00-05');

  -- progress: Single sign-on with Google and Apple
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Single sign-on with Google and Apple', 'Social login for pet owners.', s_prog, 'medium', v_owner, '2026-09-23', '2026-11-15', 12, NULL, v_owner, '2026-09-21 14:37:00-05', '2026-09-23 18:19:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'auth', f_feature::text, 'signin', f_type::text, 'feature', f_points::text, 5, f_sprint::text, 's4'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Pairing on this tomorrow.', '2026-09-24 16:54:00-05', '2026-09-24 13:12:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-09-23 15:54:00-05', '2026-09-23 16:06:00-05');

  -- progress: Insurance claim form pre-fill
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Insurance claim form pre-fill', 'Generate a claim form from the visit and invoice.', s_prog, 'low', v_owner, '2026-10-03', '2026-10-30', 13, NULL, v_owner, '2026-09-29 14:36:00-05', '2026-10-03 18:18:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'records', f_feature::text, 'insurance', f_type::text, 'feature', f_points::text, 5, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-03 13:01:00-05', '2026-10-03 15:17:00-05');

  -- progress: Fix slow pet search for clinics with 10k+ patients
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Fix slow pet search for clinics with 10k+ patients', 'Add trigram index and paginate results.', s_prog, 'high', v_owner, '2026-10-06', '2026-11-12', 14, NULL, v_owner, '2026-10-03 09:58:00-05', '2026-10-06 18:38:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'pets', f_feature::text, 'find', f_type::text, 'bug', f_points::text, 3, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Blocked briefly on credentials from the client, now unblocked.', '2026-10-05 14:14:00-05', '2026-10-05 12:39:00-05');
  INSERT INTO task_history (task_id, field, from_value, to_value, actor_id, created_at, updated_at) VALUES (t, 'status', 'To do', 'In progress', v_owner, '2026-10-06 13:43:00-05', '2026-10-06 11:40:00-05');

  -- todo: Mobile app: book appointment flow
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Mobile app: book appointment flow', 'Port the web booking flow to the mobile app.', s_todo, 'high', v_owner, NULL, '2026-12-09', 0, NULL, v_owner, '2026-10-25 09:19:00-05', '2026-10-25 18:50:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'mobile', f_feature::text, 'mobilev1', f_type::text, 'feature', f_points::text, 8, f_sprint::text, 's6'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Needs estimation in sprint planning.', '2026-10-26 10:58:00-05', '2026-10-26 13:20:00-05');

  -- todo: Grooming and boarding services
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Grooming and boarding services', 'Non-medical services with their own durations and pricing.', s_todo, 'medium', NULL, NULL, '2026-11-26', 1, NULL, v_owner, '2026-10-01 11:12:00-05', '2026-10-01 18:08:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'booking', f_feature::text, 'ownerbook', f_type::text, 'feature', f_points::text, 8, f_sprint::text, 's5'), t;
  END IF;

  -- todo: Multi-location clinics
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Multi-location clinics', 'One clinic account with several locations, shared patients.', s_todo, 'medium', NULL, NULL, NULL, 2, NULL, v_owner, '2026-10-16 14:33:00-05', '2026-10-16 18:32:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'vet', f_feature::text, 'clinicsetup', f_type::text, 'feature', f_points::text, 13, f_sprint::text, 's6'), t;
  END IF;

  -- todo: GDPR data export and deletion
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'GDPR data export and deletion', 'Owners download or delete all their data.', s_todo, 'high', NULL, NULL, '2026-11-13', 3, NULL, v_owner, '2026-10-01 13:58:00-05', '2026-10-01 18:52:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'auth', f_feature::text, 'privacy', f_type::text, 'chore', f_points::text, 5, f_sprint::text, 's5'), t;
  END IF;

  -- todo: Annual vaccine due reminders
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Annual vaccine due reminders', 'Remind owners when vaccines are about to expire.', s_todo, 'medium', NULL, NULL, '2026-11-25', 4, NULL, v_owner, '2026-10-12 13:47:00-05', '2026-10-12 18:55:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'notify', f_feature::text, 'vaccines', f_type::text, 'feature', f_points::text, 3, f_sprint::text, 's6'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Client asked for this in the last steering meeting.', '2026-10-12 10:09:00-05', '2026-10-12 12:55:00-05');

  -- todo: Pet food and supplies store integration
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Pet food and supplies store integration', 'Explore partner APIs for ordering food from the app.', s_todo, 'low', NULL, NULL, NULL, 5, NULL, v_owner, '2026-10-08 15:54:00-05', '2026-10-08 18:51:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'pay', f_feature::text, 'subs', f_type::text, 'spike', f_points::text, 3, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Client asked for this in the last steering meeting.', '2026-10-08 09:16:00-05', '2026-10-08 17:07:00-05');

  -- todo: Penetration test fixes
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Penetration test fixes', 'Address findings from the client''s external pen test.', s_todo, 'urgent', v_owner, NULL, '2026-11-21', 6, NULL, v_owner, '2026-10-02 13:37:00-05', '2026-10-02 18:24:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'platform', f_feature::text, 'quality', f_type::text, 'chore', f_points::text, 5, f_sprint::text, 's5'), t;
  END IF;

  -- todo: Lost pet alert with microchip lookup
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Lost pet alert with microchip lookup', 'Owners mark a pet as lost and share a poster link.', s_todo, 'low', NULL, NULL, '2026-11-11', 7, NULL, v_owner, '2026-10-29 10:43:00-05', '2026-10-29 18:14:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'pets', f_feature::text, 'find', f_type::text, 'feature', f_points::text, 5, f_sprint::text, 's7'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Needs estimation in sprint planning.', '2026-10-30 10:40:00-05', '2026-10-30 16:58:00-05');

  -- todo: Telehealth: prescriptions after video call
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Telehealth: prescriptions after video call', 'Vets issue prescriptions directly from the call summary.', s_todo, 'medium', NULL, NULL, NULL, 8, NULL, v_owner, '2026-10-03 15:07:00-05', '2026-10-03 18:08:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'tele', f_feature::text, 'video', f_type::text, 'feature', f_points::text, 5, f_sprint::text, 's5'), t;
  END IF;
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Client asked for this in the last steering meeting.', '2026-10-03 16:07:00-05', '2026-10-03 10:15:00-05');

  -- todo: Customer UAT round 2
  INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, start_date, due_date, position, completed_at, created_by, created_at, updated_at)
  VALUES (v_project, 'Customer UAT round 2', 'User acceptance testing with the client''s two pilot clinics.', s_todo, 'high', NULL, NULL, '2026-12-07', 9, NULL, v_owner, '2026-10-24 11:24:00-05', '2026-10-24 18:29:00-05')
  RETURNING id INTO t;
  IF has_fields THEN
    EXECUTE 'UPDATE tasks SET custom_values = $1 WHERE id = $2'
      USING jsonb_build_object(f_epic::text, 'platform', f_feature::text, 'quality', f_type::text, 'chore', f_points::text, 3, f_sprint::text, 's6'), t;
  END IF;
  INSERT INTO checklist_items (task_id, text, done, position, created_at, updated_at) VALUES (t, 'Prepare test scripts', false, 0, '2026-10-24 14:42:00-05', '2026-10-24 17:26:00-05'), (t, 'Run sessions', false, 1, '2026-10-24 11:56:00-05', '2026-10-24 15:41:00-05'), (t, 'Log feedback', false, 2, '2026-10-24 10:53:00-05', '2026-10-24 16:39:00-05');
  INSERT INTO comments (task_id, author_id, body, created_at, updated_at) VALUES (t, v_owner, 'Needs estimation in sprint planning.', '2026-10-25 14:13:00-05', '2026-10-25 16:28:00-05');

  RAISE NOTICE 'Demo Project created with 50 cards (custom fields: %).', CASE WHEN has_fields THEN 'yes' ELSE 'no, run the custom fields update to add them' END;
END $$;
