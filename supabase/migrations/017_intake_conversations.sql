-- ================================================================
-- 017_intake_conversations.sql
-- Conversational adaptive intake: per-exchange Q&A with AI insights.
-- ================================================================

CREATE TABLE IF NOT EXISTS intake_conversations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  total_exchanges integer     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_intake_conv_clinic ON intake_conversations(clinic_id);
ALTER TABLE intake_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_rw_conversations" ON intake_conversations FOR ALL
  USING (clinic_id IN (
    SELECT cm.clinic_id FROM clinic_members cm
    WHERE cm.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND cm.role = 'owner' AND cm.status = 'active'
  ));

CREATE POLICY "clinicians_read_conversations" ON intake_conversations FOR SELECT
  USING (clinic_id IN (
    SELECT cm.clinic_id FROM clinic_members cm
    WHERE cm.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND cm.role IN ('owner', 'clinician') AND cm.status = 'active'
  ));

CREATE TABLE IF NOT EXISTS intake_exchanges (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id       uuid        NOT NULL REFERENCES intake_conversations(id) ON DELETE CASCADE,
  exchange_order        integer     NOT NULL,
  question_text         text        NOT NULL,
  question_category     text        NOT NULL CHECK (question_category IN (
    'identity', 'philosophy', 'vocabulary', 'decision_thresholds',
    'patient_journey', 'outcomes', 'follow_up'
  )),
  answer_text           text,
  ai_extracted_insights jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exchanges_conv ON intake_exchanges(conversation_id);
ALTER TABLE intake_exchanges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_rw_exchanges" ON intake_exchanges FOR ALL
  USING (conversation_id IN (
    SELECT id FROM intake_conversations WHERE clinic_id IN (
      SELECT cm.clinic_id FROM clinic_members cm
      WHERE cm.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND cm.role = 'owner' AND cm.status = 'active'
    )
  ));

CREATE POLICY "clinicians_read_exchanges" ON intake_exchanges FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM intake_conversations WHERE clinic_id IN (
      SELECT cm.clinic_id FROM clinic_members cm
      WHERE cm.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND cm.role IN ('owner', 'clinician') AND cm.status = 'active'
    )
  ));
