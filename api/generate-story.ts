import Anthropic from '@anthropic-ai/sdk';

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
  illustrations: { description: string; position: number }[];
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

    const apiKey = process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const anthropic = new Anthropic({ apiKey });

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

IMPORTANT: Respond ONLY with valid JSON in this exact format, no additional text:
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
