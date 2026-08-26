-- Parent-chosen focus words for Word Rescue
--
-- A parent can star a word on their child's list to say "practice this next".
-- The star is a countdown, not a flag: it holds the number of future sessions
-- the word is still owed, so it spends itself and the parent never has to
-- remember to un-star. Same shape as scavenger_prompt_progress.struggle_repeats.

ALTER TABLE struggling_words
  ADD COLUMN focus_repeats INTEGER NOT NULL DEFAULT 0
    CHECK (focus_repeats >= 0);

-- Session selection asks "which of this child's words are owed repeats?", so
-- only the starred rows need to be indexed.
CREATE INDEX idx_struggling_words_focus
  ON struggling_words(child_id)
  WHERE focus_repeats > 0;

-- Spend one repeat, atomically, so a session in progress can't clobber a star
-- the parent tops up at the same moment. SECURITY INVOKER (the default) on
-- purpose: RLS still restricts this to the caller's own children.
CREATE OR REPLACE FUNCTION consume_word_focus_repeat(p_word_id UUID)
RETURNS INTEGER AS $$
DECLARE
  remaining INTEGER;
BEGIN
  UPDATE struggling_words
  SET focus_repeats = GREATEST(focus_repeats - 1, 0)
  WHERE id = p_word_id
  RETURNING focus_repeats INTO remaining;

  RETURN COALESCE(remaining, 0);
END;
$$ LANGUAGE plpgsql;
