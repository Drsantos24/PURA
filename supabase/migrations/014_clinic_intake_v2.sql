-- ================================================================
-- 014_clinic_intake_v2.sql
-- Expand clinic_profiles with deep intake fields for AI context.
-- ================================================================

ALTER TABLE clinic_profiles
  ADD COLUMN IF NOT EXISTS intake_version               text        NOT NULL DEFAULT 'v2',
  ADD COLUMN IF NOT EXISTS practice_origin_story        text,
  ADD COLUMN IF NOT EXISTS typical_patient_journey      text,
  ADD COLUMN IF NOT EXISTS what_you_wish_other_chiropractors_knew text,
  ADD COLUMN IF NOT EXISTS common_outcomes_data         jsonb,
  ADD COLUMN IF NOT EXISTS clinic_vocabulary            jsonb,
  ADD COLUMN IF NOT EXISTS decision_thresholds          jsonb,
  ADD COLUMN IF NOT EXISTS completed_sections           jsonb       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_substantive_edit        timestamptz;

COMMENT ON COLUMN clinic_profiles.clinic_vocabulary IS
  '{"preferred_terms": [...], "banned_words": [...], "signature_phrases": [...]}';
COMMENT ON COLUMN clinic_profiles.decision_thresholds IS
  '{"call_threshold": 50, "text_threshold": 60, "silent_days_urgent": 3, "signal_drop_urgent": 20}';
COMMENT ON COLUMN clinic_profiles.completed_sections IS
  '{"practice_identity": false, "patient_journey": false, "clinical_vocabulary": false, "decision_thresholds": false, "outcomes_measured": false}';
COMMENT ON COLUMN clinic_profiles.common_outcomes_data IS
  '{"avg_visits_to_discharge": 10, "patient_satisfaction_pct": 92, "top_complaints": ["lower back pain", "neck pain"]}';
