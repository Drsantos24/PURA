-- Short code helper — base57 (base62 minus visually ambiguous chars: 0 O 1 l I)
CREATE OR REPLACE FUNCTION gen_short_code()
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  text := '';
  i     int;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(chars, (floor(random() * length(chars)))::int + 1, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- Add column (nullable first so we can backfill)
ALTER TABLE patient_checkin_tokens
  ADD COLUMN IF NOT EXISTS short_code text;

-- Backfill existing rows — retry loop handles the rare collision
DO $$
DECLARE
  rec       record;
  candidate text;
BEGIN
  FOR rec IN SELECT id FROM patient_checkin_tokens WHERE short_code IS NULL LOOP
    LOOP
      candidate := gen_short_code();
      BEGIN
        UPDATE patient_checkin_tokens SET short_code = candidate WHERE id = rec.id;
        EXIT;  -- success, move to next row
      EXCEPTION WHEN unique_violation THEN
        NULL;  -- collision — spin again
      END;
    END LOOP;
  END LOOP;
END;
$$;

-- Now enforce NOT NULL and UNIQUE
ALTER TABLE patient_checkin_tokens
  ALTER COLUMN short_code SET NOT NULL;

ALTER TABLE patient_checkin_tokens
  ADD CONSTRAINT patient_checkin_tokens_short_code_key UNIQUE (short_code);

CREATE INDEX IF NOT EXISTS patient_checkin_tokens_short_code_idx
  ON patient_checkin_tokens (short_code);
