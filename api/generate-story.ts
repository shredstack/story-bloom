import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

interface RequestBody {
  childName: string;
  childAge: number;
  readingLevel: string;
  favoriteThings: string[];
  parentSummary: string | null;
  customPrompt: string | null;
}

interface StoryResponse {
  title: string;
  content: string;
  illustrations: { description: string; position: number; imageUrl?: string }[];
}

async function generateAndUploadIllustration(
  description: string,
  openai: OpenAI,
  supabaseUrl: string,
  supabaseKey: string
): Promise<string | null> {
  try {
    // Generate image with DALL-E 3
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Children's book illustration, colorful and friendly style: ${description}. Style: warm, inviting, suitable for children, storybook illustration, soft colors, whimsical.`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const tempImageUrl = response.data[0]?.url;
    if (!tempImageUrl) return null;

    // Fetch the image from OpenAI's temporary URL
    const imageResponse = await fetch(tempImageUrl);
    if (!imageResponse.ok) {
      console.error('Failed to fetch image from OpenAI');
      return null;
    }

    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const filename = `illustrations/${timestamp}-${randomId}.png`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('story-illustrations')
      .upload(filename, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '31536000', // Cache for 1 year
      });

    if (uploadError) {
      console.error('Error uploading to Supabase:', uploadError);
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('story-illustrations')
      .getPublicUrl(filename);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error generating/uploading illustration:', error);
    return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: RequestBody = await req.json();
    const { childName, childAge, readingLevel, favoriteThings, parentSummary, customPrompt } = body;

    if (!childName || !childAge || !readingLevel || !favoriteThings?.length) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const anthropicApiKey = process.env.VITE_ANTHROPIC_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!anthropicApiKey) {
      return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });
    const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
    const canUploadImages = openai && supabaseUrl && supabaseServiceKey;

    const wordCountByLevel: Record<string, { min: number; max: number; sentences: string }> = {
      'Pre-K': { min: 25, max: 40, sentences: '3-5 very short sentences' },
      'Kindergarten': { min: 40, max: 60, sentences: '5-8 short sentences' },
      '1st Grade': { min: 60, max: 100, sentences: '8-12 simple sentences' },
      '2nd Grade': { min: 100, max: 150, sentences: '10-15 sentences' },
      '3rd Grade': { min: 150, max: 250, sentences: '15-20 sentences' },
      '4th Grade': { min: 250, max: 350, sentences: '20-25 sentences' },
      '5th Grade': { min: 350, max: 450, sentences: '25-30 sentences' },
      '6th Grade': { min: 450, max: 550, sentences: '30-35 sentences' },
    };

    const levelConfig = wordCountByLevel[readingLevel] || wordCountByLevel['Kindergarten'];

    const prompt = `You are a creative children's story writer. Generate an engaging, age-appropriate story for a child with the following profile:

- Name: ${childName}
- Age: ${childAge}
- Reading Level: ${readingLevel}
- Interests: ${favoriteThings.join(', ')}
${parentSummary ? `- About the child: ${parentSummary}` : ''}

${customPrompt ? `The child specifically requested: ${customPrompt}` : ''}

CRITICAL LENGTH REQUIREMENTS for ${readingLevel} reading level:
- Story MUST be ${levelConfig.min}-${levelConfig.max} words total (${levelConfig.sentences})
- Use simple, common words appropriate for ${readingLevel} readers
- Keep sentences short and easy to read
- DO NOT exceed ${levelConfig.max} words under any circumstances

Please write a story that:
1. Strictly follows the word count limit above - this is the most important requirement
2. Uses vocabulary and sentence structure appropriate for ${readingLevel}
3. Incorporates the child's interests naturally into the story
4. Is engaging and fun
5. Has a simple beginning, middle, and end
6. Features ${childName} as the main character

Provide exactly 1 illustration description for the most exciting moment in the story. The position should be the character index in the story content where the illustration should appear (typically near the middle or climax).

CRITICAL JSON OUTPUT REQUIREMENTS:
- You MUST respond with ONLY valid JSON, nothing else
- Do NOT include any text before or after the JSON
- Do NOT include markdown code blocks or backticks
- Do NOT include explanations or commentary
- Your entire response must be parseable as JSON

Respond in this exact JSON format:
{
  "title": "Short Title Here",
  "content": "Full story text here...",
  "illustrations": [
    {"description": "A vivid, detailed scene description suitable for illustration generation", "position": 0}
  ]
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      temperature: 1,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    let storyData: StoryResponse;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      storyData = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse story response' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!storyData.title || !storyData.content) {
      return new Response(JSON.stringify({ error: 'Invalid story format' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate actual illustrations using DALL-E 3 and upload to Supabase
    if (canUploadImages && storyData.illustrations?.length > 0) {
      const illustrationPromises = storyData.illustrations.map(async (illustration) => {
        const imageUrl = await generateAndUploadIllustration(
          illustration.description,
          openai,
          supabaseUrl,
          supabaseServiceKey
        );
        return { ...illustration, imageUrl: imageUrl || undefined };
      });

      storyData.illustrations = await Promise.all(illustrationPromises);
    }

    return new Response(JSON.stringify(storyData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating story:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate story. Please try again.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export const config = {
  runtime: 'edge',
};
