-- ================================================================
-- 019_patient_import_jobs.sql
-- Tracks CSV/XLSX import jobs with preview + validation state.
-- ================================================================

CREATE TABLE IF NOT EXISTS patient_import_jobs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         uuid        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  uploaded_by_user  text        NOT NULL,
  original_filename text        NOT NULL,
  total_rows        integer     NOT NULL DEFAULT 0,
  valid_rows        integer     NOT NULL DEFAULT 0,
  invalid_rows      integer     NOT NULL DEFAULT 0,
  status            text        NOT NULL DEFAULT 'parsing'
                                CHECK (status IN ('parsing','preview','committing','completed','failed')),
  preview_data      jsonb,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_clinic ON patient_import_jobs(clinic_id);
ALTER TABLE patient_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_rw_import_jobs" ON patient_import_jobs FOR ALL
  USING (clinic_id IN (
    SELECT cm.clinic_id FROM clinic_members cm
    WHERE cm.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND cm.role = 'owner' AND cm.status = 'active'
  ));

CREATE POLICY "clinicians_read_import_jobs" ON patient_import_jobs FOR SELECT
  USING (clinic_id IN (
    SELECT cm.clinic_id FROM clinic_members cm
    WHERE cm.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND cm.role IN ('owner','clinician') AND cm.status = 'active'
  ));

-- founder_config: key-value store for founder-only state (launch checklist, etc.)
CREATE TABLE IF NOT EXISTS founder_config (
  key        text        PRIMARY KEY,
  value      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
