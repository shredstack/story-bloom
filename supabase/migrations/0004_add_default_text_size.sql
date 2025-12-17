-- Add default_text_size column to children table
-- This allows parents to set a preferred text size for each child's stories

ALTER TABLE children
ADD COLUMN default_text_size TEXT NOT NULL DEFAULT 'medium';

-- Add a check constraint to ensure valid text size values
ALTER TABLE children
ADD CONSTRAINT valid_text_size
CHECK (default_text_size IN ('small', 'medium', 'large', 'extra-large'));

-- Add a comment for documentation
COMMENT ON COLUMN children.default_text_size IS 'Default text size preference for displaying stories (small, medium, large, extra-large)';
