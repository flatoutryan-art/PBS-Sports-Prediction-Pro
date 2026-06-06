-- ============================================================
-- PBS PICKS PRO — Stage 5 Migration
-- Run AFTER migration_stage4.sql
-- ============================================================

-- ─────────────────────────────────────────
-- 1. ADMIN: RESET ALL PREDICTIONS
-- Used for trial runs before the real tournament.
-- Triple-guarded:
--   a) Requires admin auth_user_id
--   b) Requires a confirmation passphrase
--   c) Only works when no fixture has status = 'completed'
--      (prevents accidental wipe during real tournament)
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_reset_all_predictions(
  p_admin_uid    UUID,
  p_confirmation TEXT   -- must equal 'RESET_TRIAL_RUN' exactly
)
RETURNS TABLE (
  success         BOOLEAN,
  predictions_deleted INT,
  points_reset    INT,
  error_code      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pred_count INT;
  v_user_count INT;
  v_completed_count INT;
BEGIN
  -- 1. Admin check
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = p_admin_uid) THEN
    RETURN QUERY SELECT false, 0, 0, 'UNAUTHORIZED';
    RETURN;
  END IF;

  -- 2. Passphrase check
  IF p_confirmation != 'RESET_TRIAL_RUN' THEN
    RETURN QUERY SELECT false, 0, 0, 'WRONG_PASSPHRASE';
    RETURN;
  END IF;

  -- 3. Safety: block if any fixtures are already completed
  --    (means the real tournament has started — don't wipe real data)
  SELECT COUNT(*) INTO v_completed_count
  FROM fixtures WHERE status = 'completed';

  IF v_completed_count > 0 THEN
    RETURN QUERY SELECT false, 0, 0, 'TOURNAMENT_IN_PROGRESS';
    RETURN;
  END IF;

  -- Count what we're about to delete
  SELECT COUNT(*) INTO v_pred_count FROM predictions;
  SELECT COUNT(*) INTO v_user_count  FROM profiles WHERE total_points > 0;

  -- Delete all predictions
  DELETE FROM predictions;

  -- Reset all player points to 0
  UPDATE profiles SET total_points = 0, updated_at = NOW();

  RETURN QUERY SELECT true, v_pred_count, v_user_count, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_reset_all_predictions(UUID, TEXT) TO authenticated;


-- ─────────────────────────────────────────
-- 2. INDEX OPTIMISATIONS for live tournament
-- Speeds up the most common query patterns
-- ─────────────────────────────────────────

-- Leaderboard view query (total_points DESC rank window)
CREATE INDEX IF NOT EXISTS profiles_total_points_idx
  ON profiles (total_points DESC)
  WHERE is_registered = true;

-- Dashboard fixtures query (ordered by kickoff, filtered by status)
CREATE INDEX IF NOT EXISTS fixtures_kickoff_status_idx
  ON fixtures (kickoff_at ASC, status);

-- Predictions lookup per user (My Picks page)
CREATE INDEX IF NOT EXISTS predictions_user_match_idx
  ON predictions (user_id, match_id);

-- Notification log cleanup query
CREATE INDEX IF NOT EXISTS notification_log_created_idx
  ON notification_log (created_at DESC);


-- ─────────────────────────────────────────
-- 3. VERIFY
-- ─────────────────────────────────────────
-- SELECT proname FROM pg_proc WHERE proname = 'admin_reset_all_predictions';
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;
