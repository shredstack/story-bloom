-- Reading Guide, Phase 3: tap-to-hear counters.
--
-- These are events, not settings, so they get their own table rather than
-- another key in children.reading_preferences.
--
-- A word she asks to hear repeatedly is a signal, not a verdict: nothing here
-- reaches the Word Rescue practice list without a parent confirming it. A kid
-- mashing the speaker button must not be able to pollute her own word list.

CREATE TABLE reading_word_taps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  normalized_word TEXT NOT NULL,
  tap_count INTEGER NOT NULL DEFAULT 1,
  distinct_days INTEGER NOT NULL DEFAULT 1,
  last_tapped_on DATE NOT NULL DEFAULT CURRENT_DATE,
  promoted_to_struggling BOOLEAN NOT NULL DEFAULT FALSE,
  dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (child_id, normalized_word)
);

-- The parent review queue reads exactly this shape.
CREATE INDEX idx_reading_word_taps_review
  ON reading_word_taps (child_id, promoted_to_struggling, dismissed, tap_count);

ALTER TABLE reading_word_taps ENABLE ROW LEVEL SECURITY;

-- Policies mirror struggling_words: access is via ownership of the child.
CREATE POLICY "Users can view reading word taps for their children"
  ON reading_word_taps FOR SELECT
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert reading word taps for their children"
  ON reading_word_taps FOR INSERT
  WITH CHECK (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can update reading word taps for their children"
  ON reading_word_taps FOR UPDATE
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete reading word taps for their children"
  ON reading_word_taps FOR DELETE
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

-- The conditional day increment can't be expressed through PostgREST's upsert,
-- so it lives here: tap_count always increments, distinct_days only when this
-- is the first tap of a new day.
CREATE OR REPLACE FUNCTION record_reading_word_tap(
  p_child_id UUID,
  p_normalized_word TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO reading_word_taps (child_id, normalized_word)
  VALUES (p_child_id, p_normalized_word)
  ON CONFLICT (child_id, normalized_word)
  DO UPDATE SET
    tap_count = reading_word_taps.tap_count + 1,
    distinct_days = reading_word_taps.distinct_days
      + CASE WHEN reading_word_taps.last_tapped_on < CURRENT_DATE THEN 1 ELSE 0 END,
    last_tapped_on = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
