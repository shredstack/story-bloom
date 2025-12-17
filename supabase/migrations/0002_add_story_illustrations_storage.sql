-- Add storage bucket for story illustrations
-- Run this migration to create the storage bucket and set up policies

-- Create the storage bucket for story illustrations
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-illustrations', 'story-illustrations', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload illustrations
CREATE POLICY "Authenticated users can upload illustrations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'story-illustrations');

-- Policy to allow public read access to illustrations
CREATE POLICY "Public read access to illustrations"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'story-illustrations');

-- Policy to allow users to delete their own illustrations
-- (Using the file path pattern: user_id/story_id/filename)
CREATE POLICY "Users can delete their own illustrations"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'story-illustrations'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
