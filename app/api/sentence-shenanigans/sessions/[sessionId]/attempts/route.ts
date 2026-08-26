import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SENTENCE_ACCURACY_THRESHOLD, type AttemptScoredBy } from '@/lib/types'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

interface RecordAttemptBody {
  sentenceId: string
  /** Null when a grown-up scored the sentence by hand — there is no transcript. */
  spokenText: string | null
  accuracy: number
  wordResults: Array<{
    word: string
    spoken: string | null
    correct: boolean
    position: number
  }>
  isCorrect: boolean
  scoredBy?: AttemptScoredBy
}

// POST: Record a sentence attempt
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params
    const body: RecordAttemptBody = await request.json()
    const { sentenceId, spokenText, accuracy, wordResults, isCorrect } = body
    const scoredBy: AttemptScoredBy = body.scoredBy === 'grownup' ? 'grownup' : 'speech'

    if (!sentenceId || spokenText === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // A grown-up-scored attempt has no transcript; a speech-scored one must.
    if (scoredBy === 'speech' && spokenText === null) {
      return NextResponse.json(
        { error: 'Missing spoken text for a speech-scored attempt' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify session exists and user owns it via child
    const { data: session } = await supabase
      .from('sentence_practice_sessions')
      .select('id, child_id, children!inner(user_id)')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const childrenData = session.children as unknown as { user_id: string }
    if (childrenData.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get current attempt count for this sentence in this session
    const { count: attemptCount } = await supabase
      .from('sentence_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('sentence_id', sentenceId)

    const attemptNumber = (attemptCount || 0) + 1
    const wordCount = wordResults.length
    const wordsCorrect = wordResults.filter((w) => w.correct).length

    // Record the attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('sentence_attempts')
      .insert({
        session_id: sessionId,
        sentence_id: sentenceId,
        spoken_text: scoredBy === 'grownup' ? null : spokenText,
        scored_by: scoredBy,
        word_count: wordCount,
        words_correct: wordsCorrect,
        accuracy_percentage: accuracy,
        word_results: wordResults,
        attempt_number: attemptNumber,
        is_correct: isCorrect,
      })
      .select()
      .single()

    if (attemptError) {
      console.error('Error recording attempt:', attemptError)
      return NextResponse.json(
        { error: 'Failed to record attempt' },
        { status: 500 }
      )
    }

    // Update session progress
    const { data: currentSession } = await supabase
      .from('sentence_practice_sessions')
      .select('sentences_practiced, sentences_correct, total_words_attempted, total_words_correct')
      .eq('id', sessionId)
      .single()

    if (currentSession) {
      await supabase
        .from('sentence_practice_sessions')
        .update({
          sentences_practiced: currentSession.sentences_practiced + 1,
          sentences_correct:
            currentSession.sentences_correct + (isCorrect ? 1 : 0),
          total_words_attempted: currentSession.total_words_attempted + wordCount,
          total_words_correct: currentSession.total_words_correct + wordsCorrect,
        })
        .eq('id', sessionId)
    }

    // Update sentence stats (best accuracy, times practiced/correct)
    const { data: sentence } = await supabase
      .from('material_sentences')
      .select('times_practiced, times_correct, best_accuracy')
      .eq('id', sentenceId)
      .single()

    if (sentence) {
      const newBestAccuracy =
        sentence.best_accuracy === null || accuracy > sentence.best_accuracy
          ? accuracy
          : sentence.best_accuracy

      await supabase
        .from('material_sentences')
        .update({
          times_practiced: sentence.times_practiced + 1,
          times_correct: sentence.times_correct + (isCorrect ? 1 : 0),
          best_accuracy: newBestAccuracy,
          last_practiced_at: new Date().toISOString(),
        })
        .eq('id', sentenceId)
    }

    return NextResponse.json({
      attempt,
      isCorrect,
      accuracy,
    })
  } catch (error) {
    console.error('Error in attempts POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
