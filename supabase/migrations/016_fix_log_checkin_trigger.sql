-- ================================================================
-- 016_fix_log_checkin_trigger.sql
-- Fix: log_checkin_submitted() was casting patient_id::text into
-- a uuid column (access_log.target_id), causing all daily_checkins
-- inserts to fail. Removed the unnecessary ::text cast.
-- ================================================================

CREATE OR REPLACE FUNCTION log_checkin_submitted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.access_log(clinic_id, actor_email, action, target_type, target_id)
  VALUES (NEW.clinic_id, 'patient@checkin', 'checkin_submitted', 'patient', NEW.patient_id);
  RETURN NEW;
END;
$$;
