# StoryBloom - Personalized Children's Reading App

## Project Overview
Build a web application that generates personalized stories for children using Anthropic's Claude API. The app helps motivate kids to read by creating stories based on their interests, reading level, and preferences.

## Tech Stack
- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel
- **AI**: Anthropic Claude API (use Claude Sonnet 4.5)

## Core Features

### 1. Authentication & User Management
- Sign up / Sign in flow using Supabase Auth
- Parent creates account and manages one or more child profiles
- Each child profile stores:
  - Child's name
  - Age
  - Reading level (e.g., "Kindergarten", "1st Grade", "2nd Grade", etc.)
  - Favorite things (array of interests: animals, sports, activities, etc.)
  - Parent's summary of their child (free text field)

### 2. Story Generation
- After login, parent/child can generate a new story
- Optional prompt field for specific requests (e.g., "rainbow dinosaurs")
- Use Claude API to generate age-appropriate stories based on:
  - Child's reading level (adjust vocabulary and sentence complexity)
  - Child's interests
  - Parent's summary
  - Optional additional context
- Stories should be engaging, educational, and appropriately challenging
- Generate 1-3 simple illustration prompts as part of the story (describe scenes for AI image generation)

### 3. Story Display & Management
- Display generated stories with:
  - Large, adjustable font size (small/medium/large/extra-large)
  - Clean, readable layout optimized for tablets
  - Colorful but not distracting design
  - Illustration placeholders (for now, just show the illustration descriptions until you implement image generation)
- Save all generated stories to database
- Allow users to favorite stories
- Story library view showing:
  - All generated stories for the child
  - Filter for favorited stories
  - Story title and preview

### 4. Database Schema (Supabase)

```sql
-- Child profiles
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

-- Stories
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  custom_prompt TEXT,
  illustrations JSONB, -- Array of {description, position}
  is_favorited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security policies
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
```

## Application Flow

### First Time User
1. Sign up page → Create account
2. Onboarding: Create first child profile (name, age, reading level, interests, summary)
3. Dashboard with "Generate Story" button

### Returning User
1. Sign in → Select child (if multiple children)
2. Dashboard showing:
   - "Generate New Story" button
   - Recent stories
   - Favorited stories

### Story Generation Flow
1. Optional: Enter custom prompt for this story
2. Click "Generate Story"
3. Show loading state while Claude generates story
4. Display story with adjustable font size
5. Auto-save to database
6. Show favorite button

## Claude API Integration

### Story Generation Prompt Structure
```
You are a creative children's story writer. Generate an engaging, age-appropriate story for a child with the following profile:

- Name: {child.name}
- Age: {child.age}
- Reading Level: {child.reading_level}
- Interests: {child.favorite_things.join(", ")}
- About the child: {child.parent_summary}

{custom_prompt ? `The child specifically requested: ${custom_prompt}` : ''}

Please write a story that:
1. Matches the reading level with appropriate vocabulary and sentence structure
2. Incorporates the child's interests
3. Is engaging and educational
4. Is about 300-500 words long
5. Includes a clear beginning, middle, and end

Also provide 1-3 illustration descriptions at key moments in the story. Format your response as JSON:
{
  "title": "Story Title",
  "content": "Full story text...",
  "illustrations": [
    {"description": "Scene description for illustration", "position": 0},
    {"description": "Another scene", "position": 150}
  ]
}
```

## UI/UX Requirements

### Design System
- **Colors**: Soft, warm, playful palette (pastels with vibrant accents)
- **Typography**: Kid-friendly sans-serif font (e.g., Quicksand, Nunito)
- **Layout**: Clean, spacious, minimal distractions
- **Tablet-first**: Optimize for iPad-sized screens but responsive for all devices

### Key Pages
1. **Landing/Welcome** - Brief intro, sign up/sign in buttons
2. **Auth** - Sign up / Sign in forms
3. **Child Profile Setup** - Multi-step form for creating child profile
4. **Dashboard** - Child selector (if multiple), generate button, story library
5. **Story Reader** - Full-screen story view with font controls
6. **Story Library** - Grid/list of all stories with search/filter

## Environment Variables
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Implementation Notes

- Use React Router for navigation
- Use React Context or Zustand for state management
- Use Supabase client for database and auth
- Call Anthropic API from a secure backend endpoint (Vercel serverless function) to keep API key secret
- Handle loading states gracefully
- Add error handling for API failures
- Make font size persistent per user (localStorage)
- Consider adding a "Read to me" button for future text-to-speech feature
- Make sure to include files like .gitignore to ensure we have a solid code base checked into github
- The code base should be maintainable by developers
- All steps that claude code takes (like commands to install libraries and whatnot) should be documented in the README for developers to get started with contributing to this project

## Deployment
- Deploy to Vercel with environment variables configured
- Connect Vercel to GitHub for automatic deployments
- Ensure Vercel serverless functions are used for Anthropic API calls

## Future Enhancements (Not Required Now)
- AI-generated illustrations using DALL-E or similar
- Text-to-speech for stories
- Reading progress tracking
- Achievement badges
- Multiple language support
- Story sharing with other parents

---

Start by setting up the basic project structure, Supabase connection, and authentication flow. Then build out the child profile creation and story generation features. Focus on getting the core functionality working before polishing the UI.
