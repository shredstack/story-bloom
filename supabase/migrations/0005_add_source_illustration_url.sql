-- Add source_illustration_url column to stories table
-- This stores the URL of the illustration used to generate the story (if any)

ALTER TABLE stories ADD COLUMN source_illustration_url TEXT;
