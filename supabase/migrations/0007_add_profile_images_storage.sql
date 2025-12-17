-- Create storage bucket for child profile images
-- Images should be compressed before upload to save storage

-- Create the storage bucket for user profile images
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-profile-images', 'user-profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload profile images
-- Users can only upload to their own folder (user_id as folder name)
CREATE POLICY "Authenticated users can upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-profile-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy to allow public read access to profile images
CREATE POLICY "Public read access to profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-profile-images');

-- Policy to allow users to update their own profile images
CREATE POLICY "Users can update their own profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-profile-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy to allow users to delete their own profile images
CREATE POLICY "Users can delete their own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-profile-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
