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

    const prompt = `You are a creative children's story writer. Generate an engaging, age-appropriate story for a child with the following profile:

- Name: ${childName}
- Age: ${childAge}
- Reading Level: ${readingLevel}
- Interests: ${favoriteThings.join(', ')}
${parentSummary ? `- About the child: ${parentSummary}` : ''}

${customPrompt ? `The child specifically requested: ${customPrompt}` : ''}

Please write a story that:
1. Matches the reading level with appropriate vocabulary and sentence structure
2. Incorporates the child's interests naturally into the story
3. Is engaging, fun, and educational
4. Is about 300-500 words long
5. Includes a clear beginning, middle, and end
6. Features ${childName} as the main character or a character with that name

Also provide 1-3 illustration descriptions at key moments in the story. The position should be the character index in the story content where the illustration should appear.

IMPORTANT: Respond ONLY with valid JSON in this exact format, no additional text:
{
  "title": "Story Title Here",
  "content": "Full story text here...",
  "illustrations": [
    {"description": "A vivid scene description for illustration", "position": 0},
    {"description": "Another scene description", "position": 150}
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
