-- ================================================================
-- 018_approval_workflows.sql
-- Owner-controlled approval layer for patient-facing actions.
-- ================================================================

CREATE TABLE IF NOT EXISTS approval_settings (
  id                     uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id              uuid    NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  category               text    NOT NULL CHECK (category IN (
    'outbound_message', 'care_plan_change', 'intake_edit',
    'patient_invite', 'patient_data_edit'
  )),
  requires_approval      boolean NOT NULL DEFAULT true,
  who_can_approve        text[]  NOT NULL DEFAULT ARRAY['owner'],
  auto_approve_for_roles text[]  NOT NULL DEFAULT ARRAY[]::text[],
  UNIQUE (clinic_id, category)
);

ALTER TABLE approval_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_rw_approval_settings" ON approval_settings FOR ALL
  USING (clinic_id IN (
    SELECT cm.clinic_id FROM clinic_members cm
    WHERE cm.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND cm.role = 'owner' AND cm.status = 'active'
  ));

CREATE POLICY "members_read_approval_settings" ON approval_settings FOR SELECT
  USING (clinic_id IN (
    SELECT cm.clinic_id FROM clinic_members cm
    WHERE cm.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND cm.status = 'active'
  ));

CREATE TABLE IF NOT EXISTS approval_requests (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  requested_by_user   text        NOT NULL,
  category            text        NOT NULL CHECK (category IN (
    'outbound_message', 'care_plan_change', 'intake_edit',
    'patient_invite', 'patient_data_edit'
  )),
  payload             jsonb       NOT NULL,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  reviewed_by_user    text,
  reviewed_at         timestamptz,
  decision_note       text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_req_clinic    ON approval_requests(clinic_id);
CREATE INDEX IF NOT EXISTS idx_approval_req_status    ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_req_requester ON approval_requests(requested_by_user);

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_rw_approval_requests" ON approval_requests FOR ALL
  USING (clinic_id IN (
    SELECT cm.clinic_id FROM clinic_members cm
    WHERE cm.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND cm.role = 'owner' AND cm.status = 'active'
  ));

CREATE POLICY "requester_read_own" ON approval_requests FOR SELECT
  USING (requested_by_user = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "clinicians_insert_own" ON approval_requests FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT cm.clinic_id FROM clinic_members cm
      WHERE cm.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND cm.status = 'active'
    )
    AND requested_by_user = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
