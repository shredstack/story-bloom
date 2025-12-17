-- Add custom illustrations table and storage bucket
-- Custom illustrations are user-uploaded images that can be used in stories

-- Create custom_illustrations table
CREATE TABLE custom_illustrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE custom_illustrations ENABLE ROW LEVEL SECURITY;

-- Policies for custom_illustrations table
CREATE POLICY "Users can view their own custom illustrations"
  ON custom_illustrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom illustrations"
  ON custom_illustrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom illustrations"
  ON custom_illustrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom illustrations"
  ON custom_illustrations FOR DELETE
  USING (auth.uid() = user_id);

-- Create the storage bucket for user-uploaded story illustrations
-- Note: The bucket 'user-uploaded-story-illustrations' should already exist in Supabase
-- This migration just adds the policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploaded-story-illustrations', 'user-uploaded-story-illustrations', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload custom illustrations
CREATE POLICY "Authenticated users can upload custom illustrations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-uploaded-story-illustrations');

-- Policy to allow public read access to custom illustrations
CREATE POLICY "Public read access to custom illustrations"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-uploaded-story-illustrations');

-- Policy to allow users to delete their own custom illustrations
CREATE POLICY "Users can delete their own custom illustrations"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-uploaded-story-illustrations'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
