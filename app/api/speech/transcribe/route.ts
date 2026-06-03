import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

/**
 * Server-side speech-to-text via OpenAI Whisper.
 *
 * Why this exists: iOS WKWebView has NO Web Speech API, so the read-aloud games
 * (Word Quest, Sentence Shenanigans) can't use `webkitSpeechRecognition` on iPad.
 * `useSpeechRecognition` falls back to recording audio (useAudioRecorder) and
 * POSTing it here, then returns the transcript through its normal contract — so
 * the games' call sites don't change. Works identically on iOS and Android.
 */

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Speech transcription is not configured.' },
        { status: 500 }
      )
    }

    // Same-origin cookie auth, consistent with the other API routes — keeps this
    // endpoint behind a logged-in session even though it's a kid device.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const audio = formData.get('audio') as File | null
    if (!audio) {
      return NextResponse.json(
        { error: 'Missing required field: audio' },
        { status: 400 }
      )
    }

    const openai = new OpenAI({ apiKey })
    const result = await openai.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
      language: 'en', // kids' reading practice is English; improves accuracy
    })

    return NextResponse.json({ transcript: (result.text ?? '').trim() })
  } catch (error) {
    console.error('Speech transcription failed:', error)
    return NextResponse.json(
      { error: 'Could not transcribe the audio. Please try again.' },
      { status: 500 }
    )
  }
}
