-- Add used_at to patient_checkin_tokens so the check-in server action
-- can mark a token consumed without deleting it (done page still reads it).
ALTER TABLE patient_checkin_tokens
  ADD COLUMN IF NOT EXISTS used_at timestamptz;

-- Partial index: fast lookup of unconsumed tokens (the common path).
CREATE INDEX IF NOT EXISTS patient_checkin_tokens_unused
  ON patient_checkin_tokens (token)
  WHERE used_at IS NULL;
