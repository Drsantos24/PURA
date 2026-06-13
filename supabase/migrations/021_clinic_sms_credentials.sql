-- Migration 021: Per-clinic SMS credentials
-- Each beta clinic can supply their own Twilio sub-account so they can
-- register A2P independently and send from their own number.
--
-- account_sid and auth_token are AES-encrypted via pgcrypto using a key stored
-- in the database setting app.sms_secret (32-byte hex string).
-- Set with: ALTER DATABASE postgres SET app.sms_secret = '<openssl rand -hex 32>';
-- pgcrypto extension already enabled by migration 001.

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE clinic_sms_credentials (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             uuid        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  provider              text        NOT NULL DEFAULT 'platform_default'
                                    CHECK (provider IN ('twilio_subaccount', 'twilio_byo', 'platform_default')),
  -- Encrypted blobs; NULL when provider = 'platform_default'
  account_sid_enc       bytea,
  auth_token_enc        bytea,
  from_number           text,                   -- E.164, e.g. +18005551234
  whatsapp_from_number  text,                   -- E.164, nullable
  is_verified           boolean     NOT NULL DEFAULT false,
  verified_at           timestamptz,
  last_send_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id)
);

CREATE INDEX ON clinic_sms_credentials (clinic_id);

-- Auto-update updated_at on every change
CREATE OR REPLACE FUNCTION touch_clinic_sms_credentials()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_clinic_sms_credentials
  BEFORE UPDATE ON clinic_sms_credentials
  FOR EACH ROW EXECUTE FUNCTION touch_clinic_sms_credentials();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE clinic_sms_credentials ENABLE ROW LEVEL SECURITY;

-- Clinic owners read/write their own row only.
-- Encrypted blobs come back as-is; decryption happens server-side.
CREATE POLICY "sms_creds_select"
  ON clinic_sms_credentials FOR SELECT
  USING (clinic_id = get_my_clinic_id());

CREATE POLICY "sms_creds_insert"
  ON clinic_sms_credentials FOR INSERT
  WITH CHECK (clinic_id = get_my_clinic_id());

CREATE POLICY "sms_creds_update"
  ON clinic_sms_credentials FOR UPDATE
  USING (clinic_id = get_my_clinic_id());

-- Service role (used by server API routes + cron) bypasses RLS automatically.

-- ─── SECURITY DEFINER: decrypt credentials ────────────────────────────────────
-- Called exclusively from server-side routes via service role.
-- Returns decrypted account_sid and auth_token, plus other fields.
-- Returns empty result set if no row exists or secret is not configured.

CREATE OR REPLACE FUNCTION get_clinic_sms_creds(p_clinic_id uuid)
RETURNS TABLE (
  provider              text,
  account_sid           text,
  auth_token            text,
  from_number           text,
  whatsapp_from_number  text,
  is_verified           boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  BEGIN
    v_secret := current_setting('app.sms_secret', true);
  EXCEPTION WHEN OTHERS THEN
    v_secret := NULL;
  END;

  RETURN QUERY
  SELECT
    c.provider,
    CASE
      WHEN c.account_sid_enc IS NULL OR v_secret IS NULL OR length(v_secret) = 0 THEN NULL::text
      ELSE convert_from(
        decrypt(c.account_sid_enc, decode(v_secret, 'hex'), 'aes'),
        'UTF8'
      )
    END,
    CASE
      WHEN c.auth_token_enc IS NULL OR v_secret IS NULL OR length(v_secret) = 0 THEN NULL::text
      ELSE convert_from(
        decrypt(c.auth_token_enc, decode(v_secret, 'hex'), 'aes'),
        'UTF8'
      )
    END,
    c.from_number,
    c.whatsapp_from_number,
    c.is_verified
  FROM clinic_sms_credentials c
  WHERE c.clinic_id = p_clinic_id;
END;
$$;

-- ─── SECURITY DEFINER: encrypt credentials ────────────────────────────────────
-- Called from /api/sms POST route to encrypt before storage.
-- Returns NULL bytea pair if app.sms_secret is not configured (dev fallback).

CREATE OR REPLACE FUNCTION encrypt_sms_credentials(
  p_account_sid text,
  p_auth_token  text
)
RETURNS TABLE (
  account_sid_enc bytea,
  auth_token_enc  bytea
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  BEGIN
    v_secret := current_setting('app.sms_secret', true);
  EXCEPTION WHEN OTHERS THEN
    v_secret := NULL;
  END;

  IF v_secret IS NULL OR length(v_secret) = 0 THEN
    RETURN QUERY SELECT NULL::bytea, NULL::bytea;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    encrypt(p_account_sid::bytea, decode(v_secret, 'hex'), 'aes'),
    encrypt(p_auth_token::bytea,  decode(v_secret, 'hex'), 'aes');
END;
$$;

COMMENT ON TABLE clinic_sms_credentials IS
  'Per-clinic Twilio credentials. account_sid and auth_token are AES-encrypted '
  'at rest via pgcrypto. Decryption via get_clinic_sms_creds(). '
  'provider=platform_default means the clinic uses PURAs shared account.';
