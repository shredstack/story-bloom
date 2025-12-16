# StoryBloom

A personalized children's reading app that generates custom stories using AI. StoryBloom creates engaging, age-appropriate stories tailored to each child's interests and reading level.

## Features

- **Personalized Stories**: AI-generated stories featuring your child's name and interests
- **Age-Appropriate Content**: Stories matched to your child's reading level
- **Multiple Child Profiles**: Support for families with multiple children
- **Story Library**: Save and organize all generated stories
- **Favorites**: Mark favorite stories for easy access
- **Adjustable Font Size**: Customize reading experience with multiple font sizes
- **Tablet-Optimized**: Designed for iPad and tablet reading

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **Build Tool**: Vite
- **Database & Auth**: Supabase
- **AI**: Anthropic Claude API (Claude Sonnet 4)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A Supabase account
- An Anthropic API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/story-bloom.git
   cd story-bloom
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

   Fill in your credentials in `.env`:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

4. Set up your Supabase database by running the following SQL in the Supabase SQL editor:

   ```sql
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
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
story-bloom/
├── api/                    # Vercel serverless functions
│   └── generate-story.ts   # Claude API integration
├── public/                 # Static assets
├── src/
│   ├── components/         # React components
│   │   ├── layout/         # Layout components (Header, Layout)
│   │   └── ui/             # Reusable UI components
│   ├── context/            # React Context providers
│   │   ├── AuthContext.tsx # Authentication state
│   │   └── ChildContext.tsx# Child profile state
│   ├── hooks/              # Custom React hooks
│   │   ├── useFontSize.ts  # Font size persistence
│   │   └── useStories.ts   # Story CRUD operations
│   ├── lib/                # Library configurations
│   │   └── supabase.ts     # Supabase client
│   ├── pages/              # Page components
│   │   ├── Auth.tsx        # Sign in/Sign up
│   │   ├── Dashboard.tsx   # Main dashboard
│   │   ├── Landing.tsx     # Landing page
│   │   ├── Library.tsx     # Story library
│   │   ├── Onboarding.tsx  # Child profile setup
│   │   ├── Profile.tsx     # Profile management
│   │   └── StoryReader.tsx # Story display
│   ├── types/              # TypeScript types
│   ├── App.tsx             # Main app with routing
│   ├── index.css           # Global styles & Tailwind
│   └── main.tsx            # App entry point
├── .env.example            # Environment variables template
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vercel.json             # Vercel configuration
└── vite.config.ts
```

## Deployment to Vercel

1. Push your code to GitHub

2. Import the project in Vercel:
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository

3. Configure environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ANTHROPIC_API_KEY`

4. Deploy!

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
