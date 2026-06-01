import Anthropic from '@anthropic-ai/sdk'

/**
 * Scavenger Hunt photo verifier.
 *
 * Isolated from the API route (per CLAUDE.md: separation of concerns + testability)
 * so the AI logic can be exercised independently of HTTP/auth/storage. Uses Claude
 * vision (the same SDK + model family already used by generate-story) to loosely,
 * generously decide whether a child's photo matches the prompt they read.
 */

const VERIFIER_MODEL = 'claude-sonnet-4-6'
const VERIFY_TIMEOUT_MS = 20_000

export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export interface VerifyInput {
  imageBase64: string // raw base64 (no data: prefix)
  mimeType: string
  promptText: string
  targetDescription: string
  exampleObjects: string[]
}

export interface VerifyResult {
  isMatch: boolean
  confidence: number // 0-1
  reasoning: string // for parents/debugging
  kidMessage: string // friendly, shown to the child
  flagged: boolean // safety/abuse
  model: string
}

// A friendly, retry-encouraging default used when the model fails, times out, or
// returns something unparseable. Never scolds; never charges the child a failure.
function fallbackResult(reason: string): VerifyResult {
  return {
    isMatch: false,
    confidence: 0,
    reasoning: `error: ${reason}`,
    kidMessage: 'Our helper is napping — try that one again!',
    flagged: false,
    model: VERIFIER_MODEL,
  }
}

function normalizeMimeType(mimeType: string): ImageMimeType {
  const base = (mimeType || '').split(';')[0].trim().toLowerCase()
  switch (base) {
    case 'image/png':
      return 'image/png'
    case 'image/gif':
      return 'image/gif'
    case 'image/webp':
      return 'image/webp'
    default:
      return 'image/jpeg'
  }
}

function buildSystemPrompt(input: VerifyInput): string {
  const examples =
    input.exampleObjects.length > 0
      ? input.exampleObjects.join(', ')
      : '(no specific examples — use the description)'

  return `You are a friendly, GENEROUS judge for a children's reading scavenger-hunt game.
A young child (~7, learning to read) was asked to photograph something.

PROMPT THE CHILD READ: "${input.promptText}"
WHAT COUNTS AS A MATCH: ${input.targetDescription}
EXAMPLE MATCHING OBJECTS: ${examples}

Decide if the photo plausibly shows something matching the prompt.

RULES:
- Be generous. This rewards reading effort, not photography. If a reasonable
  parent would say "yeah, close enough," it's a MATCH.
- Blurry, dim, or partial photos still count if the object is recognizable.
- Creative/unexpected-but-valid answers count (the prompt is open-ended).
- Only reject if the photo clearly shows something unrelated, or nothing relevant.
- SAFETY: set "flagged": true if the photo contains a person's face, a screen
  showing an image (possible cheating: photo-of-a-photo), or anything unsafe/inappropriate.
  Still judge the match normally, but flag it for the parent.

Return ONLY JSON, with no markdown and no extra text:
{ "isMatch": bool, "confidence": 0-1, "reasoning": "<1 sentence>",
  "kidMessage": "<short, warm, encouraging — never scolding>", "flagged": bool }`
}

// Coerce/validate the model's parsed JSON into a VerifyResult.
function coerceResult(parsed: unknown): VerifyResult | null {
  if (!parsed || typeof parsed !== 'object') return null
  const p = parsed as Record<string, unknown>

  if (typeof p.isMatch !== 'boolean') return null

  let confidence = typeof p.confidence === 'number' ? p.confidence : 0
  if (Number.isNaN(confidence)) confidence = 0
  confidence = Math.max(0, Math.min(1, confidence))

  return {
    isMatch: p.isMatch,
    confidence,
    reasoning: typeof p.reasoning === 'string' ? p.reasoning : '',
    kidMessage:
      typeof p.kidMessage === 'string' && p.kidMessage.trim().length > 0
        ? p.kidMessage
        : p.isMatch
          ? 'Great find!'
          : "Hmm, I don't quite see it — want to try again?",
    flagged: typeof p.flagged === 'boolean' ? p.flagged : false,
    model: VERIFIER_MODEL,
  }
}

/**
 * Verify a single photo against a prompt. Always resolves (never throws) so the
 * caller can record the attempt and let the child retry on any failure.
 */
export async function verifyScavengerPhoto(
  input: VerifyInput
): Promise<VerifyResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return fallbackResult('missing_api_key')
  }

  const anthropic = new Anthropic({ apiKey })

  try {
    const response = await anthropic.messages.create(
      {
        model: VERIFIER_MODEL,
        max_tokens: 400,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: normalizeMimeType(input.mimeType),
                  data: input.imageBase64,
                },
              },
              {
                type: 'text',
                text: buildSystemPrompt(input),
              },
            ],
          },
        ],
      },
      { timeout: VERIFY_TIMEOUT_MS }
    )

    const text =
      response.content[0]?.type === 'text' ? response.content[0].text : ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return fallbackResult('no_json')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return fallbackResult('parse_failed')
    }

    const result = coerceResult(parsed)
    if (!result) {
      return fallbackResult('invalid_shape')
    }

    return result
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'APIConnectionTimeoutError' ||
        /timeout/i.test(error.message))
    return fallbackResult(isTimeout ? 'timeout' : 'request_failed')
  }
}
