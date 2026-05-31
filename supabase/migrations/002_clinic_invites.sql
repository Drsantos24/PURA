-- ================================================================
-- PURA Health — 002_clinic_invites.sql
-- One-time invite tokens for onboarding beta clinic owners.
-- Only the service role key can read/write this table.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE clinic_invites (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token        text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  owner_email  text        NOT NULL,
  clinic_name  text        NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX ON clinic_invites (token);
CREATE INDEX ON clinic_invites (owner_email);

-- RLS on with zero policies = authenticated users see nothing.
-- Service role key bypasses RLS entirely.
ALTER TABLE clinic_invites ENABLE ROW LEVEL SECURITY;
