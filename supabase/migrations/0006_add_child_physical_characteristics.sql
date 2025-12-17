-- Add physical characteristics and profile image fields to children table
-- These optional fields help personalize story illustrations to match the child

-- Add profile image URL (stored in user-profile-images bucket)
ALTER TABLE children ADD COLUMN profile_image_url TEXT;
ALTER TABLE children ADD COLUMN profile_image_storage_path TEXT;

-- Add physical characteristics (all optional, default to NULL meaning "diverse")
-- When NULL, the LLM can choose any characteristics for story illustrations
ALTER TABLE children ADD COLUMN skin_tone TEXT;
ALTER TABLE children ADD COLUMN hair_color TEXT;
ALTER TABLE children ADD COLUMN eye_color TEXT;
ALTER TABLE children ADD COLUMN gender TEXT;
ALTER TABLE children ADD COLUMN pronouns TEXT;

-- Add comments for documentation
COMMENT ON COLUMN children.profile_image_url IS 'Public URL of child profile picture';
COMMENT ON COLUMN children.profile_image_storage_path IS 'Storage path in user-profile-images bucket';
COMMENT ON COLUMN children.skin_tone IS 'Optional skin tone for illustration personalization (e.g., fair, light, medium, olive, tan, brown, dark)';
COMMENT ON COLUMN children.hair_color IS 'Optional hair color for illustration personalization';
COMMENT ON COLUMN children.eye_color IS 'Optional eye color for illustration personalization';
COMMENT ON COLUMN children.gender IS 'Optional gender for illustration personalization';
COMMENT ON COLUMN children.pronouns IS 'Optional pronouns (she/her/hers, he/him/his, they/them/theirs)';
