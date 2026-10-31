-- =====================================================================================
-- ActivTrack demo data update: planning fields for "Demo Project"
--
-- For a Demo Project loaded before Oct 31, 2026. Adds a Feature field (Epic -> Feature -> card),
-- fills it in for the 50 demo cards, and locks Epic, Feature and Type to project leads.
-- Story points and Sprint stay open to the whole team.
--
-- Needs: supabase/migrations/20261031160000_locked_fields.sql (run it first).
-- How to use: Supabase -> SQL Editor -> New query -> paste this file -> Run. Safe to run twice.
-- =====================================================================================
DO $$
DECLARE
  v_project uuid;
  f_feature uuid;
BEGIN
  SELECT id INTO v_project FROM projects WHERE name = 'Demo Project' AND NOT is_personal ORDER BY created_at LIMIT 1;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'No "Demo Project" found. Load supabase/seed/demo_pet_care.sql instead (it already includes these fields).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'custom_fields' AND column_name = 'locked') THEN
    RAISE EXCEPTION 'Run supabase/migrations/20261031160000_locked_fields.sql first.';
  END IF;

  SELECT id INTO f_feature FROM custom_fields WHERE project_id = v_project AND name = 'Feature';
  IF f_feature IS NULL THEN
    UPDATE custom_fields SET position = position + 1 WHERE project_id = v_project AND position >= 1;
    INSERT INTO custom_fields (project_id, name, type, options, position, show_on_card)
    VALUES (v_project, 'Feature', 'select', '[{"id": "signin", "label": "Sign-up & sign-in", "color": "#2550e8"}, {"id": "privacy", "label": "Roles & privacy", "color": "#475569"}, {"id": "find", "label": "Search & lost pets", "color": "#0d9488"}, {"id": "health", "label": "Health tracking", "color": "#16a34a"}, {"id": "profiles", "label": "Pet profiles & photos", "color": "#0a8c4e"}, {"id": "engine", "label": "Scheduling engine", "color": "#a16207"}, {"id": "ownerbook", "label": "Owner booking flow", "color": "#c9a227"}, {"id": "clinicsetup", "label": "Clinic setup", "color": "#7c3aed"}, {"id": "clinicops", "label": "Clinic daily operations", "color": "#9333ea"}, {"id": "vaccines", "label": "Vaccine reminders", "color": "#be185d"}, {"id": "apptrem", "label": "Appointment reminders", "color": "#db2777"}, {"id": "subs", "label": "Subscriptions & store", "color": "#c2410c"}, {"id": "checkout", "label": "Deposits & invoices", "color": "#ea580c"}, {"id": "video", "label": "Video visits", "color": "#0d9488"}, {"id": "insurance", "label": "Insurance claims", "color": "#be123c"}, {"id": "history", "label": "Medical history", "color": "#e11d48"}, {"id": "mobilev1", "label": "Mobile app v1", "color": "#0284c7"}, {"id": "quality", "label": "Quality & release", "color": "#64748b"}, {"id": "infra", "label": "Infrastructure", "color": "#334155"}]'::jsonb, 1, false)
    RETURNING id INTO f_feature;
  END IF;

  UPDATE tasks t SET custom_values = t.custom_values || jsonb_build_object(f_feature::text, m.feature)
  FROM (SELECT title, CASE title
      WHEN 'Set up AWS environments (dev, staging, prod) with Terraform' THEN 'infra'
      WHEN 'CI/CD pipeline with GitHub Actions' THEN 'infra'
      WHEN 'Pet owner sign-up with email verification' THEN 'signin'
      WHEN 'Login, logout and password reset' THEN 'signin'
      WHEN 'Create and edit pet profile' THEN 'profiles'
      WHEN 'Multiple pets per household' THEN 'profiles'
      WHEN 'Breed list for dogs and cats' THEN 'profiles'
      WHEN 'Clinic onboarding: add vets and opening hours' THEN 'clinicsetup'
      WHEN 'Appointment slots engine' THEN 'engine'
      WHEN 'Book an appointment (owner web flow)' THEN 'ownerbook'
      WHEN 'Fix double booking when two owners pick the same slot' THEN 'engine'
      WHEN 'Email reminders 24 hours before appointments' THEN 'apptrem'
      WHEN 'Vaccination records upload (PDF and photo)' THEN 'history'
      WHEN 'Stripe integration for clinic deposits' THEN 'checkout'
      WHEN 'Spike: telehealth video provider comparison' THEN 'video'
      WHEN 'Reschedule and cancel appointment' THEN 'ownerbook'
      WHEN 'Vet daily schedule view' THEN 'clinicops'
      WHEN 'SMS reminders via Twilio' THEN 'apptrem'
      WHEN 'Medication schedule for pets' THEN 'history'
      WHEN 'Invoices and receipts PDF' THEN 'checkout'
      WHEN 'Fix pet photo upload failing on iPhone HEIC images' THEN 'profiles'
      WHEN 'Role-based access for clinic staff' THEN 'privacy'
      WHEN 'Load test booking API (500 concurrent users)' THEN 'quality'
      WHEN 'Weight tracking chart' THEN 'health'
      WHEN 'Accessibility pass on booking flow' THEN 'ownerbook'
      WHEN 'Telehealth video consultations (Daily SDK)' THEN 'video'
      WHEN 'Visit notes and SOAP records' THEN 'history'
      WHEN 'Mobile app: login and pet list (React Native)' THEN 'mobilev1'
      WHEN 'Mobile app: push notifications' THEN 'mobilev1'
      WHEN 'Subscription plans for clinics (Stripe Billing)' THEN 'subs'
      WHEN 'Owner to clinic messaging' THEN 'clinicops'
      WHEN 'Clinic analytics dashboard' THEN 'clinicops'
      WHEN 'Fix reminder emails sent in UTC instead of clinic time zone' THEN 'apptrem'
      WHEN 'Waitlist when no slots are free' THEN 'engine'
      WHEN 'Export medical history as PDF' THEN 'history'
      WHEN 'Kubernetes migration for API services (EKS)' THEN 'infra'
      WHEN 'Observability: logs, metrics and alerts' THEN 'infra'
      WHEN 'Single sign-on with Google and Apple' THEN 'signin'
      WHEN 'Insurance claim form pre-fill' THEN 'insurance'
      WHEN 'Fix slow pet search for clinics with 10k+ patients' THEN 'find'
      WHEN 'Mobile app: book appointment flow' THEN 'mobilev1'
      WHEN 'Grooming and boarding services' THEN 'ownerbook'
      WHEN 'Multi-location clinics' THEN 'clinicsetup'
      WHEN 'GDPR data export and deletion' THEN 'privacy'
      WHEN 'Annual vaccine due reminders' THEN 'vaccines'
      WHEN 'Pet food and supplies store integration' THEN 'subs'
      WHEN 'Penetration test fixes' THEN 'quality'
      WHEN 'Lost pet alert with microchip lookup' THEN 'find'
      WHEN 'Telehealth: prescriptions after video call' THEN 'video'
      WHEN 'Customer UAT round 2' THEN 'quality'
    END AS feature FROM tasks WHERE project_id = v_project) m
  WHERE t.project_id = v_project AND t.title = m.title AND m.feature IS NOT NULL
    AND NOT (t.custom_values ? f_feature::text);

  UPDATE custom_fields SET locked = (name IN ('Epic', 'Feature', 'Type')) WHERE project_id = v_project;
END $$;
