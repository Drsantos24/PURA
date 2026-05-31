-- Junction wearable user mapping.
-- Stores the Junction-side user_id once a patient connects a device.
-- Nullable — patients without a connected device have NULL here.
-- clinic_id RLS on patients table already covers this column.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS junction_user_id text;
