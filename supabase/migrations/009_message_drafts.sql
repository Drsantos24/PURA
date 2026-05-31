-- AI-drafted outreach messages for DC review before sending.
-- Drafted when a patient's signal is red-zone or drops 15+ points below 7-day average.

CREATE TABLE message_drafts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  uuid        NOT NULL REFERENCES clinics(id)  ON DELETE CASCADE,
  patient_id uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  drafted_at timestamptz NOT NULL DEFAULT now(),
  body_text  text        NOT NULL,
  status     text        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'sent', 'dismissed')),
  sent_at    timestamptz
);

CREATE INDEX ON message_drafts (clinic_id, patient_id, status);

ALTER TABLE message_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drafts_select"
  ON message_drafts FOR SELECT
  USING (clinic_id = get_my_clinic_id());

CREATE POLICY "drafts_update"
  ON message_drafts FOR UPDATE
  USING (clinic_id = get_my_clinic_id());
