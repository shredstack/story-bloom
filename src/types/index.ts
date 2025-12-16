export interface Child {
  id: string;
  user_id: string;
  name: string;
  age: number;
  reading_level: string;
  favorite_things: string[];
  parent_summary: string | null;
  created_at: string;
}

export interface Illustration {
  description: string;
  position: number;
}

export interface Story {
  id: string;
  child_id: string;
  title: string;
  content: string;
  custom_prompt: string | null;
  illustrations: Illustration[] | null;
  is_favorited: boolean;
  created_at: string;
}

export interface StoryGenerationResponse {
  title: string;
  content: string;
  illustrations: Illustration[];
}

export type FontSize = 'small' | 'medium' | 'large' | 'extra-large';

export const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  'small': 'text-base leading-relaxed',
  'medium': 'text-lg leading-relaxed',
  'large': 'text-xl leading-relaxed',
  'extra-large': 'text-2xl leading-relaxed',
};

export const READING_LEVELS = [
  'Pre-K',
  'Kindergarten',
  '1st Grade',
  '2nd Grade',
  '3rd Grade',
  '4th Grade',
  '5th Grade',
  '6th Grade',
] as const;

export type ReadingLevel = typeof READING_LEVELS[number];
