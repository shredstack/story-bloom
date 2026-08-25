import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

/**
 * Server-side text-to-speech for ONE word (reading guide "Say it", spec §5.4).
 *
 * Why this exists: `speechSynthesis` is *present* in every WebView we ship
 * into, but presence is not capability. Amazon Fire tablets ship no Google TTS
 * engine, so `getVoices()` returns `[]` and `speak()` is a silent no-op — the
 * button looks dead and nothing anywhere reports an error. iOS WKWebView has
 * the same shape of failure early in page life. `useWordSpeech` falls back
 * here whenever the device's own voice fails to start, so the call sites don't
 * change. Mirrors /api/speech/transcribe, which exists for the same reason in
 * the other direction.
 *
 * GET rather than POST on purpose: the URL goes straight into `<audio src>`,
 * so the browser HTTP cache does the caching for us and a word she taps twice
 * is instant the second time.
 */

export const runtime = 'nodejs'
export const maxDuration = 30

/** Newer, cheaper, and the only one of the three that takes a style instruction. */
const TTS_MODEL = 'gpt-4o-mini-tts'
/** Available on every account; used if the model above is not enabled. */
const TTS_FALLBACK_MODEL = 'tts-1'
/** Warm and unhurried, without being a character doing a bit. */
const TTS_VOICE = 'nova'
const TTS_INSTRUCTIONS =
  'Say this single word slowly and very clearly, the way a patient teacher would ' +
  'for a six-year-old who is sounding it out. Do not add any other words.'
/** Matches the neutral `rate: 0.8` the on-device voice uses. */
const TTS_SPEED = 0.85

/**
 * One word, in the shape tokenize.ts produces. Anything else is a caller bug
 * or someone poking at the endpoint — either way we don't bill it to OpenAI.
 */
const WORD_PATTERN = /^[\p{L}\p{N}'’-]{1,48}$/u

/** A word's pronunciation never changes; let the device keep it for a day. */
const AUDIO_CACHE_CONTROL = 'private, max-age=86400'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Read-aloud is not configured.' },
        { status: 500 }
      )
    }

    const word = (new URL(request.url).searchParams.get('word') ?? '').trim()
    if (!word) {
      return NextResponse.json(
        { error: 'Missing required parameter: word' },
        { status: 400 }
      )
    }
    if (!WORD_PATTERN.test(word)) {
      return NextResponse.json(
        { error: 'This endpoint speaks a single word.' },
        { status: 400 }
      )
    }

    // Same-origin cookie auth, consistent with the other API routes — keeps
    // this endpoint behind a logged-in session even though it's a kid device.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const openai = new OpenAI({ apiKey })

    let response: Response
    try {
      response = await openai.audio.speech.create({
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input: word,
        instructions: TTS_INSTRUCTIONS,
        response_format: 'mp3',
        speed: TTS_SPEED,
      })
    } catch (modelError) {
      // The account may not have the newer model enabled. `tts-1` is older and
      // ignores `instructions`, but a plainly-spoken word still beats silence.
      console.warn(`${TTS_MODEL} unavailable, falling back to ${TTS_FALLBACK_MODEL}:`, modelError)
      response = await openai.audio.speech.create({
        model: TTS_FALLBACK_MODEL,
        voice: TTS_VOICE,
        input: word,
        response_format: 'mp3',
        speed: TTS_SPEED,
      })
    }

    const audio = await response.arrayBuffer()

    return new NextResponse(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.byteLength),
        'Cache-Control': AUDIO_CACHE_CONTROL,
      },
    })
  } catch (error) {
    console.error('Word speech synthesis failed:', error)
    return NextResponse.json(
      { error: 'Could not say that word. Please try again.' },
      { status: 500 }
    )
  }
}
