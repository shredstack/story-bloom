-- Grown-up answer checking: an alternative to the microphone for devices where
-- speech recognition is unreliable (Amazon Fire tablets in particular, whose
-- WebView has no working recognition service). A grown-up sitting with the child
-- marks each word/sentence right or wrong instead.
--
--   'microphone' - today's behavior; speech decides (default)
--   'grownup'    - no mic at all; a grown-up taps the verdict
--   'both'       - mic is available AND a grown-up can score/override

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS answer_check_mode TEXT NOT NULL DEFAULT 'microphone';

ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_answer_check_mode_check;

ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_answer_check_mode_check
  CHECK (answer_check_mode IN ('microphone', 'grownup', 'both'));

COMMENT ON COLUMN app_settings.answer_check_mode IS
  'How reading attempts are judged: microphone (speech recognition), grownup (a parent marks right/wrong), or both.';

-- Attempts scored by a grown-up have no transcript, so record HOW each attempt
-- was judged and let the transcript be absent.
ALTER TABLE sentence_attempts
  ALTER COLUMN spoken_text DROP NOT NULL;

ALTER TABLE sentence_attempts
  ADD COLUMN IF NOT EXISTS scored_by TEXT NOT NULL DEFAULT 'speech';

ALTER TABLE sentence_attempts
  DROP CONSTRAINT IF EXISTS sentence_attempts_scored_by_check;

ALTER TABLE sentence_attempts
  ADD CONSTRAINT sentence_attempts_scored_by_check
  CHECK (scored_by IN ('speech', 'grownup'));

ALTER TABLE word_rescue_attempts
  ADD COLUMN IF NOT EXISTS scored_by TEXT NOT NULL DEFAULT 'speech';

ALTER TABLE word_rescue_attempts
  DROP CONSTRAINT IF EXISTS word_rescue_attempts_scored_by_check;

ALTER TABLE word_rescue_attempts
  ADD CONSTRAINT word_rescue_attempts_scored_by_check
  CHECK (scored_by IN ('speech', 'grownup'));

COMMENT ON COLUMN sentence_attempts.scored_by IS
  'speech = judged by speech recognition; grownup = a parent marked the words.';
COMMENT ON COLUMN word_rescue_attempts.scored_by IS
  'speech = judged by speech recognition; grownup = a parent marked it right/wrong.';
