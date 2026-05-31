-- Expanded wearable fields on daily_checkins.
-- All nullable — patients without wearables skip this section entirely.
-- The pura_signal trigger only reads the original 7 fields and is unchanged.

ALTER TABLE daily_checkins
  ADD COLUMN IF NOT EXISTS sleep_score      integer CHECK (sleep_score      BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS readiness_score  integer CHECK (readiness_score  BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS deep_sleep_minutes integer CHECK (deep_sleep_minutes >= 0),
  ADD COLUMN IF NOT EXISTS rem_sleep_minutes  integer CHECK (rem_sleep_minutes  >= 0),
  ADD COLUMN IF NOT EXISTS total_steps      integer CHECK (total_steps      >= 0),
  ADD COLUMN IF NOT EXISTS active_calories  integer CHECK (active_calories  >= 0);
