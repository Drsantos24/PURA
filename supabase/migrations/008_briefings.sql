-- Morning briefing generated nightly per clinic by the AI pipeline.
-- patient_callouts stores re-identified callout rows after AI de-identified processing.

CREATE TABLE briefings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  generated_at     timestamptz NOT NULL DEFAULT now(),
  summary_text     text        NOT NULL,
  patient_callouts jsonb       NOT NULL DEFAULT '[]'
);

CREATE INDEX ON briefings (clinic_id, generated_at DESC);

ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefings_select"
  ON briefings FOR SELECT
  USING (clinic_id = get_my_clinic_id());
