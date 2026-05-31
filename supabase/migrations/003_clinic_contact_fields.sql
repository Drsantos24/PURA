ALTER TABLE clinics ADD COLUMN IF NOT EXISTS phone   text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS website text;

ALTER TABLE clinic_settings
  ALTER COLUMN message_tone SET DEFAULT 'encouraging';
