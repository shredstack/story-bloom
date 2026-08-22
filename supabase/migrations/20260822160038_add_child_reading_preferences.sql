-- Reading Guide, Phase 0: per-child reading guide + typography preferences.
--
-- Stored as JSONB rather than discrete columns because this is ~18 settings
-- that will keep growing; discrete columns would mean a migration per tweak.
--
-- Existing RLS on `children` (auth.uid() = user_id, 0001_initial_schema.sql)
-- already scopes reads and writes, so no new policies are needed.

ALTER TABLE children
ADD COLUMN reading_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN children.reading_preferences IS
  'Per-child reading guide + typography preferences. Sparse: only keys the parent has
   changed are stored; the client merges over DEFAULT_READING_PREFERENCES. See
   lib/reading/types.ts (ReadingPreferences).';
