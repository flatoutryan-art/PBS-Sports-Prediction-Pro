-- ============================================================
-- PBS PICKS PRO — Stage 4 Migration
-- Run AFTER migration_stage3.sql
-- ============================================================

-- ─────────────────────────────────────────
-- 1. TEMPORARY PIN SUPPORT
-- When admin resets a player's PIN, we flag
-- them as needing a new PIN on next login.
-- The temp PIN is a one-time credential.
-- ─────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS requires_pin_reset BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temp_pin_hash       TEXT,       -- cleared after first use
  ADD COLUMN IF NOT EXISTS pin_reset_at        TIMESTAMPTZ;


-- ─────────────────────────────────────────
-- 2. FIXTURE MANAGEMENT COLUMNS
-- Track external API sync metadata
-- ─────────────────────────────────────────

ALTER TABLE fixtures
  ADD COLUMN IF NOT EXISTS external_id    TEXT UNIQUE,   -- ID from external API/Kaggle
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS round_number   SMALLINT;      -- match day / round within stage

CREATE INDEX IF NOT EXISTS fixtures_external_id_idx ON fixtures (external_id);
CREATE INDEX IF NOT EXISTS fixtures_status_kickoff_idx ON fixtures (status, kickoff_at);


-- ─────────────────────────────────────────
-- 3. ADMIN: RESET PLAYER PIN
-- Sets a temporary 6-digit PIN, marks player
-- as requiring reset on next login.
-- Does NOT expose the existing PIN hash.
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_reset_pin(
  p_profile_phone  TEXT,
  p_temp_pin       TEXT,    -- 6-digit temp PIN chosen by admin
  p_admin_uid      UUID
)
RETURNS TABLE (
  success      BOOLEAN,
  display_name TEXT,
  error_code   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  -- Verify admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE auth_user_id = p_admin_uid
  ) THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'UNAUTHORIZED';
    RETURN;
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE phone = p_profile_phone;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'NOT_FOUND';
    RETURN;
  END IF;

  -- Hash the temp PIN and flag for reset
  UPDATE profiles
  SET
    temp_pin_hash       = crypt(p_temp_pin, gen_salt('bf', 10)),
    requires_pin_reset  = true,
    pin_reset_at        = NOW(),
    login_attempts      = 0,        -- clear any lockout
    locked_until        = NULL,
    updated_at          = NOW()
  WHERE phone = p_profile_phone;

  RETURN QUERY SELECT true, v_profile.display_name, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_reset_pin(TEXT, TEXT, UUID) TO authenticated;


-- ─────────────────────────────────────────
-- 4. UPDATE verify_pin_and_get_session
-- Handle temp PIN + force-reset flow
-- Replaces the Stage 3 version
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION verify_pin_and_get_session(
  p_phone TEXT,
  p_pin   TEXT
)
RETURNS TABLE (
  success           BOOLEAN,
  profile_id        UUID,
  auth_user_id      UUID,
  error_code        TEXT,
  requires_pin_reset BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile     profiles%ROWTYPE;
  v_pin_matches BOOLEAN;
  v_using_temp  BOOLEAN := false;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE phone = p_phone LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'NOT_INVITED', false;
    RETURN;
  END IF;

  IF NOT v_profile.is_registered THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'NOT_REGISTERED', false;
    RETURN;
  END IF;

  -- Lockout check
  IF v_profile.locked_until IS NOT NULL AND v_profile.locked_until > NOW() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'LOCKED', false;
    RETURN;
  END IF;

  -- Check temp PIN first (if reset was triggered)
  IF v_profile.requires_pin_reset AND v_profile.temp_pin_hash IS NOT NULL THEN
    v_pin_matches := (crypt(p_pin, v_profile.temp_pin_hash) = v_profile.temp_pin_hash);
    IF v_pin_matches THEN
      v_using_temp := true;
    END IF;
  END IF;

  -- Fall back to permanent PIN
  IF NOT v_pin_matches AND v_profile.pin_hash IS NOT NULL THEN
    v_pin_matches := (crypt(p_pin, v_profile.pin_hash) = v_profile.pin_hash);
  END IF;

  IF NOT v_pin_matches THEN
    UPDATE profiles
    SET
      login_attempts = login_attempts + 1,
      locked_until   = CASE
        WHEN login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
        ELSE NULL
      END
    WHERE phone = p_phone;

    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'WRONG_PIN', false;
    RETURN;
  END IF;

  -- Success — reset counters; clear temp PIN if it was used
  UPDATE profiles
  SET
    login_attempts = 0,
    locked_until   = NULL,
    last_login_at  = NOW(),
    -- If they used the temp PIN, clear it but keep requires_pin_reset = true
    -- so the app forces them to set a new one this session
    temp_pin_hash  = CASE WHEN v_using_temp THEN NULL ELSE temp_pin_hash END
  WHERE phone = p_phone;

  RETURN QUERY SELECT
    true,
    v_profile.id,
    v_profile.auth_user_id,
    NULL::TEXT,
    v_profile.requires_pin_reset;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_pin_and_get_session(TEXT, TEXT) TO anon;


-- ─────────────────────────────────────────
-- 5. SET NEW PIN AFTER FORCED RESET
-- Called after temp-PIN login; clears the reset flag
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_new_pin_after_reset(
  p_phone    TEXT,
  p_new_pin  TEXT
)
RETURNS TABLE (success BOOLEAN, error_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET
    pin_hash           = crypt(p_new_pin, gen_salt('bf', 10)),
    requires_pin_reset = false,
    temp_pin_hash      = NULL,
    updated_at         = NOW()
  WHERE phone = p_phone
    AND is_registered = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'NOT_FOUND';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION set_new_pin_after_reset(TEXT, TEXT) TO authenticated;


-- ─────────────────────────────────────────
-- 6. ADMIN: BULK INSERT PROFILES
-- Called by the bulk import UI.
-- Returns per-row result so UI can show validation.
-- ─────────────────────────────────────────

CREATE TYPE bulk_import_result AS (
  phone        TEXT,
  display_name TEXT,
  status       TEXT,   -- 'inserted' | 'duplicate' | 'invalid'
  message      TEXT
);

CREATE OR REPLACE FUNCTION admin_bulk_import_players(
  p_players   JSONB,   -- array of {phone, display_name, username}
  p_admin_uid UUID
)
RETURNS SETOF bulk_import_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player JSONB;
  v_phone  TEXT;
  v_name   TEXT;
  v_uname  TEXT;
BEGIN
  -- Admin check
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = p_admin_uid) THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, 'error'::TEXT, 'UNAUTHORIZED'::TEXT;
    RETURN;
  END IF;

  FOR v_player IN SELECT * FROM jsonb_array_elements(p_players)
  LOOP
    v_phone := v_player->>'phone';
    v_name  := v_player->>'display_name';
    v_uname := COALESCE(v_player->>'username', lower(regexp_replace(v_name, '\s+', '_', 'g')));

    -- Basic validation
    IF v_phone IS NULL OR length(v_phone) < 10 THEN
      RETURN QUERY SELECT v_phone, v_name, 'invalid'::TEXT, 'Phone too short'::TEXT;
      CONTINUE;
    END IF;

    IF v_name IS NULL OR length(trim(v_name)) < 2 THEN
      RETURN QUERY SELECT v_phone, v_name, 'invalid'::TEXT, 'Name too short'::TEXT;
      CONTINUE;
    END IF;

    -- Duplicate check
    IF EXISTS (SELECT 1 FROM profiles WHERE phone = v_phone) THEN
      RETURN QUERY SELECT v_phone, v_name, 'duplicate'::TEXT,
        'Already in system (registered: ' || (
          SELECT is_registered::TEXT FROM profiles WHERE phone = v_phone
        ) || ')'::TEXT;
      CONTINUE;
    END IF;

    -- Insert
    INSERT INTO profiles (username, display_name, phone)
    VALUES (v_uname, v_name, v_phone);

    RETURN QUERY SELECT v_phone, v_name, 'inserted'::TEXT, 'Added to invite list'::TEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_bulk_import_players(JSONB, UUID) TO authenticated;


-- ─────────────────────────────────────────
-- 7. ADMIN: UPSERT FIXTURE FROM SYNC
-- Called by the "Sync with API" button.
-- Uses external_id as the conflict key.
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_upsert_fixture(
  p_external_id    TEXT,
  p_home_team_id   UUID,
  p_away_team_id   UUID,
  p_kickoff_at     TIMESTAMPTZ,
  p_stage          TEXT,
  p_group_name     TEXT,
  p_venue          TEXT,
  p_round_number   SMALLINT,
  p_admin_uid      UUID
)
RETURNS TABLE (success BOOLEAN, fixture_id UUID, action TEXT, error_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fixture_id UUID;
  v_action     TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = p_admin_uid) THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'UNAUTHORIZED';
    RETURN;
  END IF;

  -- Upsert on external_id
  INSERT INTO fixtures (
    external_id, home_team_id, away_team_id, kickoff_at,
    stage, group_name, venue, round_number, last_synced_at, status
  )
  VALUES (
    p_external_id, p_home_team_id, p_away_team_id, p_kickoff_at,
    p_stage, p_group_name, p_venue, p_round_number, NOW(), 'upcoming'
  )
  ON CONFLICT (external_id) DO UPDATE SET
    kickoff_at     = EXCLUDED.kickoff_at,
    venue          = EXCLUDED.venue,
    round_number   = EXCLUDED.round_number,
    last_synced_at = NOW()
  RETURNING id INTO v_fixture_id;

  v_action := CASE WHEN FOUND THEN 'upserted' ELSE 'unchanged' END;
  RETURN QUERY SELECT true, v_fixture_id, v_action, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_fixture(TEXT, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, SMALLINT, UUID) TO authenticated;


-- ─────────────────────────────────────────
-- 8. VERIFY
-- ─────────────────────────────────────────
-- SELECT proname FROM pg_proc WHERE proname IN (
--   'admin_reset_pin', 'set_new_pin_after_reset',
--   'admin_bulk_import_players', 'admin_upsert_fixture'
-- );
