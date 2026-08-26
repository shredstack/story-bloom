import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isWordMatch } from '@/lib/utils/wordMatch'
import {
  WORD_RESCUE_REWARDS,
  calculateWordStage,
  type AttemptScoredBy,
  type WordMasteryStage,
  type WordCheckResult,
} from '@/lib/types'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

interface CheckWordBody {
  strugglingWordId: string
  /** Present when speech decided; absent when a grown-up did. */
  spokenText?: string
  /** The grown-up's verdict. Only honored with `scoredBy: 'grownup'`. */
  isCorrect?: boolean
  usedCoach?: boolean
  scoredBy?: AttemptScoredBy
}

// POST: Check a word attempt
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params
    const body: CheckWordBody = await request.json()
    const { strugglingWordId, spokenText, usedCoach = false } = body
    const scoredBy: AttemptScoredBy = body.scoredBy === 'grownup' ? 'grownup' : 'speech'

    if (!strugglingWordId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (scoredBy === 'speech' && spokenText === undefined) {
      return NextResponse.json(
        { error: 'Missing spoken text' },
        { status: 400 }
      )
    }

    if (scoredBy === 'grownup' && typeof body.isCorrect !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing grown-up verdict' },
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

    // Verify session exists and user owns it
    const { data: session } = await supabase
      .from('word_rescue_sessions')
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

    // Get the struggling word
    const { data: word } = await supabase
      .from('struggling_words')
      .select('*')
      .eq('id', strugglingWordId)
      .single()

    if (!word) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 })
    }

    // Get app settings for mastery threshold
    const { data: settings } = await supabase
      .from('app_settings')
      .select('mastery_correct_threshold, cash_reward_enabled, cash_per_mastered_word')
      .eq('user_id', user.id)
      .single()

    const masteryThreshold = settings?.mastery_correct_threshold || 2

    // A grown-up's verdict is taken as given; otherwise the transcript is matched.
    const isCorrect =
      scoredBy === 'grownup'
        ? (body.isCorrect as boolean)
        : isWordMatch(
            (spokenText ?? '').toLowerCase().trim(),
            word.word.toLowerCase().trim()
          )

    // Calculate rewards
    let coinsEarned = 0
    let cashEarned = 0
    const previousStage = word.current_stage as WordMasteryStage

    // Update word progress
    const newTimesCorrect = isCorrect ? word.times_correct + 1 : word.times_correct
    const newTimesPracticed = word.times_practiced + 1

    // Calculate new stage
    const newStage = calculateWordStage(newTimesCorrect, masteryThreshold)
    const stageAdvanced = newStage !== previousStage && isCorrect
    const isMastered = newStage === 'mastered' && previousStage !== 'mastered'

    if (isCorrect) {
      coinsEarned = WORD_RESCUE_REWARDS.coinsPerCorrect
      if (!usedCoach) {
        coinsEarned += WORD_RESCUE_REWARDS.bonusCoinsWithoutCoach
      }
      if (stageAdvanced) {
        coinsEarned += WORD_RESCUE_REWARDS.coinsPerStageAdvance
      }
    }

    // Calculate cash reward if mastered and cash rewards enabled
    if (isMastered && settings?.cash_reward_enabled) {
      cashEarned = settings.cash_per_mastered_word || 0.10
    }

    // Update the struggling word
    const wordUpdate: Record<string, unknown> = {
      times_practiced: newTimesPracticed,
      times_correct: newTimesCorrect,
      current_stage: newStage,
      last_practiced_at: new Date().toISOString(),
    }

    if (isMastered) {
      wordUpdate.mastered_at = new Date().toISOString()
    }

    await supabase
      .from('struggling_words')
      .update(wordUpdate)
      .eq('id', strugglingWordId)

    // Get current attempt count for this word in this session
    const { count: attemptCount } = await supabase
      .from('word_rescue_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('struggling_word_id', strugglingWordId)

    // Record the attempt
    await supabase.from('word_rescue_attempts').insert({
      session_id: sessionId,
      struggling_word_id: strugglingWordId,
      spoken_text: scoredBy === 'grownup' ? null : spokenText,
      scored_by: scoredBy,
      is_correct: isCorrect,
      attempt_number: (attemptCount || 0) + 1,
      used_word_coach: usedCoach,
      coins_earned: coinsEarned,
    })

    // Update session stats
    const { data: currentSession } = await supabase
      .from('word_rescue_sessions')
      .select('words_practiced, words_correct, words_mastered, coins_earned, gems_earned, cash_earned')
      .eq('id', sessionId)
      .single()

    if (currentSession) {
      await supabase
        .from('word_rescue_sessions')
        .update({
          words_practiced: currentSession.words_practiced + 1,
          words_correct: currentSession.words_correct + (isCorrect ? 1 : 0),
          words_mastered: currentSession.words_mastered + (isMastered ? 1 : 0),
          coins_earned: currentSession.coins_earned + coinsEarned,
          gems_earned: currentSession.gems_earned + (isMastered ? WORD_RESCUE_REWARDS.gemsPerMastery : 0),
          cash_earned: parseFloat(currentSession.cash_earned || '0') + cashEarned,
        })
        .eq('id', sessionId)
    }

    // Update cash rewards for the week if cash earned
    if (cashEarned > 0) {
      // Get week start date (Monday)
      const today = new Date()
      const dayOfWeek = today.getDay()
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Adjust for Monday
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - diff)
      weekStart.setHours(0, 0, 0, 0)
      const weekStartDate = weekStart.toISOString().split('T')[0]

      // Upsert cash reward record
      try {
        await supabase.rpc('upsert_cash_reward', {
          p_child_id: session.child_id,
          p_week_start_date: weekStartDate,
          p_cash_earned: cashEarned,
          p_words_mastered: 1,
        })
      } catch {
        // Fallback if RPC doesn't exist yet
        console.log('Cash reward RPC not available, skipping')
      }
    }

    const result: WordCheckResult = {
      correct: isCorrect,
      coinsEarned,
      isMastered,
      cashEarned,
      newStage,
      previousStage,
      stageAdvanced,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in word check:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
