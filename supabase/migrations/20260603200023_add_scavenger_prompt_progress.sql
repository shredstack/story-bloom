-- Scavenger Hunt: per-child, per-prompt progress for adaptive repetition & mastery.
--
-- The bank (scavenger_hunt_prompts) and per-photo finds (scavenger_hunt_finds) carry
-- no per-child *memory* of how a clue is going. This table adds that memory so a
-- clue can be:
--   * drilled on demand   ("This is tricky" -> guaranteed reappearances), and
--   * retired when easy    (found 3x with no tricky flag -> mastered).

CREATE TABLE scavenger_prompt_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id  UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  prompt_id UUID REFERENCES scavenger_hunt_prompts(id) ON DELETE CASCADE NOT NULL,

  times_shown INTEGER NOT NULL DEFAULT 0,   -- engaged exposures (verify or skip), once per prompt per session
  times_found INTEGER NOT NULL DEFAULT 0,   -- verified matches (first match per session counts)

  struggle_flagged           BOOLEAN NOT NULL DEFAULT FALSE,  -- ever tapped "tricky" (historical)
  struggle_repeats_remaining INTEGER NOT NULL DEFAULT 0,      -- forced reappearances still owed

  status TEXT NOT NULL DEFAULT 'learning'   -- 'learning' | 'mastered'
    CHECK (status IN ('learning','mastered')),

  last_shown_at TIMESTAMPTZ,
  mastered_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (child_id, prompt_id)
);

CREATE INDEX idx_sh_progress_child_status
  ON scavenger_prompt_progress (child_id, status);

-- RLS mirrors the other scavenger tables: a row is visible/writable only when its
-- child belongs to the requesting user.
ALTER TABLE scavenger_prompt_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scavenger progress for their children"
  ON scavenger_prompt_progress FOR SELECT
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert scavenger progress for their children"
  ON scavenger_prompt_progress FOR INSERT
  WITH CHECK (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can update scavenger progress for their children"
  ON scavenger_prompt_progress FOR UPDATE
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete scavenger progress for their children"
  ON scavenger_prompt_progress FOR DELETE
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Atomic upsert-and-evaluate RPC (mirrors upsert_scavenger_cash_reward).
--
-- Counter bumps use SQL increments so parallel verifies can't clobber each other.
-- SECURITY DEFINER bypasses RLS for the increment, so we re-check ownership inside
-- (auth.uid() still reflects the caller's JWT). Routes also verify ownership before
-- calling -- this is defense in depth.
--
-- p_count_shown: this engagement is the prompt's first in the session (-> times_shown
--                +1 and one struggle repeat paid off). Multiple photos of the same
--                clue in one hunt count as a single exposure (parent-faithful).
-- p_found:       this engagement is the first verified match for the prompt this
--                session (-> times_found +1).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_scavenger_progress(
  p_child_id          UUID,
  p_prompt_id         UUID,
  p_count_shown       BOOLEAN,
  p_found             BOOLEAN,
  p_mastery_threshold INTEGER DEFAULT 3
)
RETURNS scavenger_prompt_progress AS $$
DECLARE
  result scavenger_prompt_progress;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM children WHERE id = p_child_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this child';
  END IF;

  INSERT INTO scavenger_prompt_progress AS p
    (child_id, prompt_id, times_shown, times_found, last_shown_at, updated_at)
  VALUES (
    p_child_id,
    p_prompt_id,
    CASE WHEN p_count_shown THEN 1 ELSE 0 END,
    CASE WHEN p_found THEN 1 ELSE 0 END,
    NOW(),
    NOW()
  )
  ON CONFLICT (child_id, prompt_id) DO UPDATE SET
    times_shown = p.times_shown + CASE WHEN p_count_shown THEN 1 ELSE 0 END,
    times_found = p.times_found + CASE WHEN p_found THEN 1 ELSE 0 END,
    struggle_repeats_remaining =
      CASE WHEN p_count_shown
           THEN GREATEST(p.struggle_repeats_remaining - 1, 0)
           ELSE p.struggle_repeats_remaining END,
    last_shown_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO result;

  -- Mastery (retire): 3 verified finds, no outstanding forced repeats, still learning.
  -- A flagged prompt therefore can't master until it has paid off its repeats first.
  IF result.status = 'learning'
     AND result.times_found >= p_mastery_threshold
     AND result.struggle_repeats_remaining = 0 THEN
    UPDATE scavenger_prompt_progress
      SET status = 'mastered', mastered_at = NOW(), updated_at = NOW()
      WHERE id = result.id
      RETURNING * INTO result;
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Flag a clue as "tricky": set the historical flag and owe at least p_repeats
-- forced reappearances. Re-tapping tops the counter back up (never lowers it).
-- Flagging a mastered clue un-retires it so the child can practice it again.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION flag_scavenger_struggle(
  p_child_id  UUID,
  p_prompt_id UUID,
  p_repeats   INTEGER DEFAULT 5
)
RETURNS scavenger_prompt_progress AS $$
DECLARE
  result scavenger_prompt_progress;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM children WHERE id = p_child_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this child';
  END IF;

  INSERT INTO scavenger_prompt_progress AS p
    (child_id, prompt_id, struggle_flagged, struggle_repeats_remaining, updated_at)
  VALUES (p_child_id, p_prompt_id, TRUE, p_repeats, NOW())
  ON CONFLICT (child_id, prompt_id) DO UPDATE SET
    struggle_flagged = TRUE,
    struggle_repeats_remaining = GREATEST(p.struggle_repeats_remaining, p_repeats),
    status = 'learning',
    mastered_at = NULL,
    updated_at = NOW()
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
