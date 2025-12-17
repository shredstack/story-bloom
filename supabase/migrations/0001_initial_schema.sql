-- StoryBloom Initial Schema Migration
-- Creates the children and stories tables with Row Level Security

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Child profiles table
CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  reading_level TEXT NOT NULL,
  favorite_things TEXT[] NOT NULL,
  parent_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stories table
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  custom_prompt TEXT,
  illustrations JSONB,
  is_favorited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- Policies for children table
CREATE POLICY "Users can view their own children"
  ON children FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own children"
  ON children FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own children"
  ON children FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own children"
  ON children FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for stories table
CREATE POLICY "Users can view stories for their children"
  ON stories FOR SELECT
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert stories for their children"
  ON stories FOR INSERT
  WITH CHECK (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can update stories for their children"
  ON stories FOR UPDATE
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete stories for their children"
  ON stories FOR DELETE
  USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));
