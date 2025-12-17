export interface Child {
  id: string;
  user_id: string;
  name: string;
  age: number;
  reading_level: string;
  favorite_things: string[];
  parent_summary: string | null;
  default_text_size: FontSize;
  created_at: string;
  // Optional physical characteristics for illustration personalization
  profile_image_url: string | null;
  profile_image_storage_path: string | null;
  skin_tone: SkinTone | null;
  hair_color: HairColor | null;
  eye_color: EyeColor | null;
  gender: Gender | null;
  pronouns: Pronouns | null;
}

export interface Illustration {
  description: string;
  position: number;
  imageUrl?: string;
  customIllustrationId?: string;
}

export interface CustomIllustration {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  image_url: string;
  storage_path: string;
  created_at: string;
}

export interface Story {
  id: string;
  child_id: string;
  title: string;
  content: string;
  custom_prompt: string | null;
  illustrations: Illustration[] | null;
  is_favorited: boolean;
  source_illustration_url: string | null;
  created_at: string;
}

export interface StoryGenerationResponse {
  title: string;
  content: string;
  illustrations: Illustration[];
  warning?: string;
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

// Physical characteristics types for illustration personalization
// All default to null/"diverse" meaning the LLM can choose any characteristics

export const SKIN_TONES = [
  { id: 'diverse', label: 'Diverse (any)', color: null },
  { id: 'fair', label: 'Fair', color: '#FFDFC4' },
  { id: 'light', label: 'Light', color: '#F0D5BE' },
  { id: 'medium', label: 'Medium', color: '#D1A684' },
  { id: 'olive', label: 'Olive', color: '#C4A87C' },
  { id: 'tan', label: 'Tan', color: '#A67B5B' },
  { id: 'brown', label: 'Brown', color: '#8D5524' },
  { id: 'dark', label: 'Dark', color: '#5C3A21' },
] as const;

export type SkinTone = typeof SKIN_TONES[number]['id'];

export const HAIR_COLORS = [
  'diverse',
  'black',
  'dark brown',
  'brown',
  'light brown',
  'auburn',
  'red',
  'strawberry blonde',
  'blonde',
  'platinum blonde',
  'gray',
  'white',
] as const;

export type HairColor = typeof HAIR_COLORS[number];

export const EYE_COLORS = [
  'diverse',
  'brown',
  'dark brown',
  'hazel',
  'amber',
  'green',
  'blue',
  'gray',
  'black',
] as const;

export type EyeColor = typeof EYE_COLORS[number];

export const GENDERS = [
  { id: 'diverse', label: 'Diverse (any)' },
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'non-binary', label: 'Non-binary' },
  { id: 'genderfluid', label: 'Genderfluid' },
  { id: 'genderqueer', label: 'Genderqueer' },
  { id: 'prefer-not-to-say', label: 'Prefer not to say' },
] as const;

export type Gender = typeof GENDERS[number]['id'];

export const PRONOUNS = [
  { id: 'diverse', label: 'Diverse (any)', value: null },
  { id: 'she-her', label: 'She/Her/Hers', value: 'she/her/hers' },
  { id: 'he-him', label: 'He/Him/His', value: 'he/him/his' },
  { id: 'they-them', label: 'They/Them/Theirs', value: 'they/them/theirs' },
] as const;

export type Pronouns = typeof PRONOUNS[number]['id'];
