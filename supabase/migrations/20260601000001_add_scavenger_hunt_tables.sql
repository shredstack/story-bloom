-- Scavenger Hunt Game Migration
-- Sibling of word-rescue: a reading-practice game where the child reads a prompt,
-- photographs the matching object, an image AI loosely verifies it, and verified
-- finds earn cash through the existing cash_rewards machinery.

-- 1.1 Prompt bank (shared, curated, not per-child)
CREATE TABLE scavenger_hunt_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- What the child reads:
  prompt_text TEXT NOT NULL,                 -- "Find something red and round"

  -- What the AI checks for (hidden from the child; helps the verifier):
  target_description TEXT NOT NULL,          -- "a red, roughly round object (apple, ball, tomato)"
  example_objects TEXT[] DEFAULT '{}',       -- {'apple','ball','tomato','stop sign'}

  -- Selection metadata:
  location TEXT NOT NULL CHECK (location IN ('indoor','outdoor','either')),
  reading_level TEXT NOT NULL DEFAULT 'grade_1'
    CHECK (reading_level IN ('pre_k','kindergarten','grade_1','grade_2','grade_3')),
  difficulty TEXT NOT NULL DEFAULT 'easy'
    CHECK (difficulty IN ('easy','medium','hard')),
  category TEXT,                             -- 'color','shape','nature','household','texture','letter','animal'

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sh_prompts_select
  ON scavenger_hunt_prompts (is_active, reading_level, location, difficulty);

-- 1.2 Sessions (mirrors word_rescue_sessions)
CREATE TABLE scavenger_hunt_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,

  location_set TEXT NOT NULL DEFAULT 'either'   -- which prompts were drawn from
    CHECK (location_set IN ('indoor','outdoor','either')),

  prompts_total INTEGER DEFAULT 0,
  prompts_attempted INTEGER DEFAULT 0,
  prompts_found INTEGER DEFAULT 0,              -- AI-verified matches
  prompts_skipped INTEGER DEFAULT 0,            -- "can't find it" skips
  prompts_replaced INTEGER DEFAULT 0,           -- "give me a new one" swaps

  find_cash_earned NUMERIC(10,2) DEFAULT 0,         -- sum of per-find rewards
  completion_bonus_earned NUMERIC(10,2) DEFAULT 0,  -- awarded at /complete
  cash_earned NUMERIC(10,2) DEFAULT 0,              -- find_cash + completion_bonus (total)

  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sh_sessions_child ON scavenger_hunt_sessions (child_id, started_at DESC);

-- 1.3 Finds: per-photo submissions (mirrors word_rescue_attempts + photo & AI fields)
CREATE TABLE scavenger_hunt_finds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES scavenger_hunt_sessions(id) ON DELETE CASCADE NOT NULL,
  prompt_id UUID REFERENCES scavenger_hunt_prompts(id) ON DELETE SET NULL,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE NOT NULL,

  prompt_text TEXT NOT NULL,                  -- snapshot (prompt may change/deactivate later)

  -- Photo:
  photo_storage_path TEXT NOT NULL,           -- path within the 'scavenger-hunt-photos' bucket
  attempt_number INTEGER DEFAULT 1,           -- retries for the same prompt in this session

  -- AI verdict:
  is_match BOOLEAN NOT NULL,
  ai_confidence NUMERIC(3,2),                 -- 0.00-1.00
  ai_reasoning TEXT,                          -- model's short explanation (parent-facing / debugging)
  ai_kid_message TEXT,                        -- friendly message shown to the child
  ai_model TEXT,                              -- e.g. 'claude-sonnet-4-6' (for auditing)
  ai_flagged BOOLEAN DEFAULT FALSE,           -- safety/abuse flag

  cash_earned NUMERIC(10,2) DEFAULT 0,

  -- Parent moderation (optional override):
  parent_reviewed BOOLEAN DEFAULT FALSE,
  parent_override TEXT CHECK (parent_override IN ('approved','rejected')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sh_finds_session ON scavenger_hunt_finds (session_id);
CREATE INDEX idx_sh_finds_child   ON scavenger_hunt_finds (child_id, created_at DESC);

-- 1.4 app_settings additions (extend the existing cash-settings group)
ALTER TABLE app_settings
  ADD COLUMN scavenger_hunt_enabled         BOOLEAN       DEFAULT TRUE,
  ADD COLUMN cash_per_scavenger_find        NUMERIC(10,2) DEFAULT 0.10,
  ADD COLUMN scavenger_completion_bonus     NUMERIC(10,2) DEFAULT 0.50, -- paid once per finished hunt
  ADD COLUMN scavenger_completion_min_found INTEGER       DEFAULT 1,    -- min verified finds to earn the bonus
  ADD COLUMN scavenger_prompts_per_session  INTEGER       DEFAULT 8,
  ADD COLUMN scavenger_ai_confidence_floor  NUMERIC(3,2)  DEFAULT 0.45; -- min confidence to count as a match

-- 1.5 RLS
ALTER TABLE scavenger_hunt_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scavenger_hunt_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scavenger_hunt_finds ENABLE ROW LEVEL SECURITY;

-- prompts: readable by all authenticated users (shared bank). No insert/update/delete
-- policies -> only the service role (seed migration) can write.
CREATE POLICY "Authenticated users can read scavenger hunt prompts"
  ON scavenger_hunt_prompts FOR SELECT
  TO authenticated
  USING (TRUE);

-- sessions: child must belong to the requesting user
CREATE POLICY "Users can view scavenger hunt sessions for their children"
  ON scavenger_hunt_sessions FOR SELECT
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert scavenger hunt sessions for their children"
  ON scavenger_hunt_sessions FOR INSERT
  WITH CHECK (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can update scavenger hunt sessions for their children"
  ON scavenger_hunt_sessions FOR UPDATE
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete scavenger hunt sessions for their children"
  ON scavenger_hunt_sessions FOR DELETE
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

-- finds: child must belong to the requesting user
CREATE POLICY "Users can view scavenger hunt finds for their children"
  ON scavenger_hunt_finds FOR SELECT
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert scavenger hunt finds for their children"
  ON scavenger_hunt_finds FOR INSERT
  WITH CHECK (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can update scavenger hunt finds for their children"
  ON scavenger_hunt_finds FOR UPDATE
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete scavenger hunt finds for their children"
  ON scavenger_hunt_finds FOR DELETE
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

-- 1.6 Private storage bucket for hunt photos (access only via signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('scavenger-hunt-photos', 'scavenger-hunt-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: ${user_id}/${child_id}/${sessionId}/${findId}.jpg
-- First folder is the owning user's id, mirroring the reading-materials convention.
CREATE POLICY "Users can upload their scavenger hunt photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'scavenger-hunt-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their scavenger hunt photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'scavenger-hunt-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their scavenger hunt photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'scavenger-hunt-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Generic cash-reward upsert: adds cash to the child's weekly record WITHOUT
-- inflating words_mastered_this_week (that counter is word-rescue specific).
-- Both per-find rewards and the completion bonus feed the same weekly row, so
-- the existing weekly_cash_cap is respected across all games.
CREATE OR REPLACE FUNCTION upsert_scavenger_cash_reward(
  p_child_id UUID,
  p_week_start_date DATE,
  p_cash_earned DECIMAL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO cash_rewards (child_id, week_start_date, words_mastered_this_week, cash_earned)
  VALUES (p_child_id, p_week_start_date, 0, p_cash_earned)
  ON CONFLICT (child_id, week_start_date)
  DO UPDATE SET
    cash_earned = cash_rewards.cash_earned + p_cash_earned,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
