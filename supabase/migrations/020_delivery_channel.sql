-- Migration 020: Add delivery_channel to patients
-- Controls how each patient receives their daily check-in link.
-- Default 'sms' preserves existing behaviour for all current patients.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS delivery_channel text NOT NULL DEFAULT 'sms';

ALTER TABLE patients
  ADD CONSTRAINT patients_delivery_channel_check
  CHECK (delivery_channel IN ('sms', 'whatsapp', 'email', 'both_sms_email'));

COMMENT ON COLUMN patients.delivery_channel IS
  'How the DC sends the daily check-in link. sms=SMS only, whatsapp=WhatsApp only, email=email only, both_sms_email=SMS + email.';
