-- ================================================================
-- PURA Health — 001_initial_schema.sql
-- Run once in Supabase SQL Editor.
-- ================================================================

-- ----------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ================================================================
-- TABLES
-- ================================================================

-- 1. clinics — one row per beta clinic; no clinic_id (this IS the tenant root)
CREATE TABLE clinics (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_name         text        NOT NULL,
  clinic_key          text        NOT NULL UNIQUE,
  owner_email         text        NOT NULL UNIQUE,
  location            text,
  timezone            text        NOT NULL DEFAULT 'America/New_York',
  onboarding_complete boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 2. clinic_settings — one row per clinic
CREATE TABLE clinic_settings (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         uuid        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  checkin_send_time time        NOT NULL DEFAULT '06:00',
  auto_send_enabled boolean     NOT NULL DEFAULT true,
  message_tone      text        NOT NULL DEFAULT 'professional',
  alert_threshold   integer     NOT NULL DEFAULT 15,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id)
);

-- 3. patients
CREATE TABLE patients (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         uuid        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  first_name        text        NOT NULL,
  last_name         text        NOT NULL,
  phone_number      text        NOT NULL,
  email             text,
  chief_complaint   text,
  enrollment_status text        NOT NULL DEFAULT 'active'
                                CHECK (enrollment_status IN ('active', 'inactive', 'discharged')),
  last_checkin_date date,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 4. patient_checkin_tokens — 24-hour SMS tokens; patients never log into Supabase
CREATE TABLE patient_checkin_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id  uuid        NOT NULL REFERENCES clinics(id)  ON DELETE CASCADE,
  token      text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- 5. daily_checkins — patient self-report; inserts via service key only
CREATE TABLE daily_checkins (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id         uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id          uuid        NOT NULL REFERENCES clinics(id)  ON DELETE CASCADE,
  pain_level         integer     NOT NULL CHECK (pain_level        BETWEEN 0 AND 10),
  sleep_quality      integer     NOT NULL CHECK (sleep_quality     BETWEEN 0 AND 10),
  sleep_hours        numeric(4,1)NOT NULL CHECK (sleep_hours       BETWEEN 0 AND 24),
  energy_level       integer     NOT NULL CHECK (energy_level      BETWEEN 0 AND 10),
  stress_level       integer     NOT NULL CHECK (stress_level      BETWEEN 0 AND 10),
  functional_ability integer     NOT NULL CHECK (functional_ability BETWEEN 0 AND 10),
  mood               integer     NOT NULL CHECK (mood              BETWEEN 0 AND 10),
  hrv_manual         integer,
  rhr_manual         integer,
  patient_note       text,
  checkin_date       date        NOT NULL DEFAULT CURRENT_DATE,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- 6. pura_index_history — written by trigger on daily_checkins INSERT
CREATE TABLE pura_index_history (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id       uuid        NOT NULL REFERENCES clinics(id)  ON DELETE CASCADE,
  pura_signal     integer     NOT NULL CHECK (pura_signal BETWEEN 0 AND 100),
  baseline_signal integer,
  calculated_at   timestamptz NOT NULL DEFAULT now()
);

-- 7. ai_message_queue — draft → approved → sent/skipped
CREATE TABLE ai_message_queue (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    uuid        NOT NULL REFERENCES clinics(id)  ON DELETE CASCADE,
  patient_id   uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  message_type text        NOT NULL,
  ai_analysis  text,
  message_body text,
  status       text        NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'approved', 'sent', 'skipped')),
  approved_at  timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 8. patient_signal_alerts
CREATE TABLE patient_signal_alerts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id    uuid        NOT NULL REFERENCES clinics(id)  ON DELETE CASCADE,
  alert_type   text        NOT NULL,
  trigger_data jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);

-- 9. access_log — append-only audit trail; inserts via service key only
CREATE TABLE access_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  actor_email text        NOT NULL,
  action      text        NOT NULL,
  target_type text,
  target_id   uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 10. baa_agreements
CREATE TABLE baa_agreements (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    uuid        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  signed_at    timestamptz NOT NULL,
  document_ref text,
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ================================================================
-- INDEXES
-- ================================================================

CREATE INDEX ON clinic_settings        (clinic_id);

CREATE INDEX ON patients               (clinic_id);
CREATE INDEX ON patients               (clinic_id, enrollment_status);

CREATE INDEX ON patient_checkin_tokens (clinic_id);
CREATE INDEX ON patient_checkin_tokens (patient_id);
CREATE INDEX ON patient_checkin_tokens (token);

CREATE INDEX ON daily_checkins         (clinic_id);
CREATE INDEX ON daily_checkins         (patient_id);
CREATE INDEX ON daily_checkins         (clinic_id, checkin_date DESC);

CREATE INDEX ON pura_index_history     (clinic_id);
CREATE INDEX ON pura_index_history     (patient_id);
CREATE INDEX ON pura_index_history     (patient_id, calculated_at DESC);

CREATE INDEX ON ai_message_queue       (clinic_id);
CREATE INDEX ON ai_message_queue       (patient_id);
CREATE INDEX ON ai_message_queue       (clinic_id, status);

CREATE INDEX ON patient_signal_alerts  (clinic_id);
CREATE INDEX ON patient_signal_alerts  (patient_id);
CREATE INDEX ON patient_signal_alerts  (clinic_id, resolved_at)
  WHERE resolved_at IS NULL;

CREATE INDEX ON access_log             (clinic_id);
CREATE INDEX ON access_log             (clinic_id, created_at DESC);

CREATE INDEX ON baa_agreements         (clinic_id);


-- ================================================================
-- PURA SIGNAL TRIGGER
-- ================================================================
--
-- Formula (all inputs 0-10, result 0-100):
--   Pain (inverted)          × 0.25
--   Sleep quality            × 0.20
--   Sleep hours (norm to 8h) × 0.15
--   Energy                   × 0.15
--   Stress (inverted)        × 0.10
--   Functional ability       × 0.10
--   Mood                     × 0.05
--   ──────────────────────────────
--   raw (0-10)  × 10  →  PURA Signal (0-100)
-- ================================================================

CREATE OR REPLACE FUNCTION calculate_pura_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sleep_norm  numeric;
  v_raw         numeric;
  v_signal      integer;
BEGIN
  -- Normalize sleep hours: 8 h ideal → 10; capped at 10 above 8 h
  v_sleep_norm := LEAST(NEW.sleep_hours / 8.0, 1.0) * 10;

  v_raw :=
    (10 - NEW.pain_level)      * 0.25 +
    NEW.sleep_quality          * 0.20 +
    v_sleep_norm               * 0.15 +
    NEW.energy_level           * 0.15 +
    (10 - NEW.stress_level)    * 0.10 +
    NEW.functional_ability     * 0.10 +
    NEW.mood                   * 0.05;

  v_signal := ROUND(v_raw * 10)::integer;

  INSERT INTO pura_index_history (patient_id, clinic_id, pura_signal, calculated_at)
  VALUES (NEW.patient_id, NEW.clinic_id, v_signal, NEW.created_at);

  -- Keep patients.last_checkin_date current
  UPDATE patients
  SET    last_checkin_date = NEW.checkin_date
  WHERE  id = NEW.patient_id
    AND  (last_checkin_date IS NULL OR last_checkin_date < NEW.checkin_date);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pura_signal
  AFTER INSERT ON daily_checkins
  FOR EACH ROW
  EXECUTE FUNCTION calculate_pura_signal();


-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================

-- Helper: returns the clinic id whose owner_email matches the
-- current JWT email. SECURITY DEFINER so it can read clinics
-- table without being blocked by clinics' own RLS.
CREATE OR REPLACE FUNCTION get_my_clinic_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM   clinics
  WHERE  owner_email = (auth.jwt() ->> 'email')
  LIMIT  1;
$$;

-- Enable RLS on every table
ALTER TABLE clinics                ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_checkin_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pura_index_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_message_queue       ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_signal_alerts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE baa_agreements         ENABLE ROW LEVEL SECURITY;

-- ── clinics ────────────────────────────────────────────────────
-- No INSERT policy: clinics are created by the founder via service key only.
CREATE POLICY "clinics_select_own"
  ON clinics FOR SELECT
  USING (owner_email = (auth.jwt() ->> 'email'));

CREATE POLICY "clinics_update_own"
  ON clinics FOR UPDATE
  USING (owner_email = (auth.jwt() ->> 'email'));

-- ── clinic_settings ────────────────────────────────────────────
CREATE POLICY "clinic_settings_select"
  ON clinic_settings FOR SELECT
  USING (clinic_id = get_my_clinic_id());

CREATE POLICY "clinic_settings_insert"
  ON clinic_settings FOR INSERT
  WITH CHECK (clinic_id = get_my_clinic_id());

CREATE POLICY "clinic_settings_update"
  ON clinic_settings FOR UPDATE
  USING (clinic_id = get_my_clinic_id());

-- ── patients ───────────────────────────────────────────────────
CREATE POLICY "patients_select"
  ON patients FOR SELECT
  USING (clinic_id = get_my_clinic_id());

CREATE POLICY "patients_insert"
  ON patients FOR INSERT
  WITH CHECK (clinic_id = get_my_clinic_id());

CREATE POLICY "patients_update"
  ON patients FOR UPDATE
  USING (clinic_id = get_my_clinic_id());

-- ── patient_checkin_tokens ─────────────────────────────────────
-- INSERT/DELETE via service key only (token lifecycle managed server-side).
CREATE POLICY "tokens_select"
  ON patient_checkin_tokens FOR SELECT
  USING (clinic_id = get_my_clinic_id());

-- ── daily_checkins ─────────────────────────────────────────────
-- INSERT via service key only (patient submits through server route).
CREATE POLICY "checkins_select"
  ON daily_checkins FOR SELECT
  USING (clinic_id = get_my_clinic_id());

-- ── pura_index_history ─────────────────────────────────────────
-- INSERT via trigger (SECURITY DEFINER), no owner INSERT policy needed.
CREATE POLICY "pura_index_select"
  ON pura_index_history FOR SELECT
  USING (clinic_id = get_my_clinic_id());

-- ── ai_message_queue ───────────────────────────────────────────
-- INSERT via service key (AI pipeline). Owner reads and approves/skips.
CREATE POLICY "ai_queue_select"
  ON ai_message_queue FOR SELECT
  USING (clinic_id = get_my_clinic_id());

CREATE POLICY "ai_queue_update"
  ON ai_message_queue FOR UPDATE
  USING (clinic_id = get_my_clinic_id());

-- ── patient_signal_alerts ──────────────────────────────────────
-- INSERT via service key (alert detection pipeline). Owner reads and resolves.
CREATE POLICY "alerts_select"
  ON patient_signal_alerts FOR SELECT
  USING (clinic_id = get_my_clinic_id());

CREATE POLICY "alerts_update"
  ON patient_signal_alerts FOR UPDATE
  USING (clinic_id = get_my_clinic_id());

-- ── access_log ─────────────────────────────────────────────────
-- Append-only via service key. Owner can read their own log.
CREATE POLICY "access_log_select"
  ON access_log FOR SELECT
  USING (clinic_id = get_my_clinic_id());

-- ── baa_agreements ─────────────────────────────────────────────
CREATE POLICY "baa_select"
  ON baa_agreements FOR SELECT
  USING (clinic_id = get_my_clinic_id());

CREATE POLICY "baa_insert"
  ON baa_agreements FOR INSERT
  WITH CHECK (clinic_id = get_my_clinic_id());
