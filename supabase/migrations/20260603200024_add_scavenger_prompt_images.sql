-- Scavenger Hunt: Pre-K picture hints.
--
-- A non-reader (Pre-K) can't decode the clue, so for Pre-K children we show a
-- picture of the target above the text. Pictures are AI-generated once (offline)
-- and stored, then attached per prompt. Non-Pre-K children never receive them
-- (gated in the API by the *child's* reading level).

ALTER TABLE scavenger_hunt_prompts
  ADD COLUMN image_url          TEXT,   -- public URL of the curated illustration (nullable)
  ADD COLUMN image_storage_path TEXT;   -- path within the public images bucket

-- Public bucket: these are generic single-object illustrations (no text, no PII),
-- unlike the private scavenger-hunt-photos bucket of children's real photos. Public
-- + long cache is appropriate and lets the Capacitor WebView load them cheaply.
INSERT INTO storage.buckets (id, name, public)
VALUES ('scavenger-hunt-prompt-images', 'scavenger-hunt-prompt-images', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone may read (the bucket is public); only the service role (the offline
-- generator script) writes, so no insert/update/delete policies are defined.
CREATE POLICY "Public can read scavenger hunt prompt images"
ON storage.objects FOR SELECT
USING (bucket_id = 'scavenger-hunt-prompt-images');
