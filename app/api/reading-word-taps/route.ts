import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeWord } from '@/lib/utils/syllabify'

/**
 * Tap-to-hear counters (spec §5.4, §6.8).
 *
 * A word she asks to hear repeatedly is a signal, not a verdict. Nothing here
 * writes to struggling_words: reaching the threshold only puts the word in
 * front of a parent, who confirms or declines. That confirmation step is what
 * stops a kid mashing the speaker button from polluting her practice list.
 */

/** 3 taps across at least 2 distinct days. */
const REVIEW_TAP_THRESHOLD = 3
const REVIEW_DAY_THRESHOLD = 2

async function authorizeChild(childId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: child } = await supabase
    .from('children')
    .select('id, user_id')
    .eq('id', childId)
    .single()

  if (!child || child.user_id !== user.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  }

  return { supabase }
}

// GET: the parent's review queue for one child.
export async function GET(request: NextRequest) {
  try {
    const childId = new URL(request.url).searchParams.get('childId')
    if (!childId) {
      return NextResponse.json(
        { error: 'Missing required parameter: childId' },
        { status: 400 }
      )
    }

    const { error, supabase } = await authorizeChild(childId)
    if (error) return error

    const { data, error: queryError } = await supabase!
      .from('reading_word_taps')
      .select('*')
      .eq('child_id', childId)
      .eq('promoted_to_struggling', false)
      .eq('dismissed', false)
      .gte('tap_count', REVIEW_TAP_THRESHOLD)
      .gte('distinct_days', REVIEW_DAY_THRESHOLD)
      .order('tap_count', { ascending: false })

    if (queryError) {
      console.error('Error fetching reading word taps:', queryError)
      return NextResponse.json({ error: 'Failed to fetch words' }, { status: 500 })
    }

    return NextResponse.json({ words: data ?? [] })
  } catch (err) {
    console.error('Error in reading-word-taps GET:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: record one tap.
export async function POST(request: NextRequest) {
  try {
    const { childId, word } = (await request.json()) ?? {}
    if (!childId || typeof word !== 'string') {
      return NextResponse.json(
        { error: 'Missing required fields: childId, word' },
        { status: 400 }
      )
    }

    // Same normalizer the struggling-words pipeline uses, so the two lists
    // agree on what counts as "the same word".
    const normalized = normalizeWord(word)
    if (!normalized) {
      // Punctuation-only token. Nothing to count.
      return NextResponse.json({ recorded: false })
    }

    const { error, supabase } = await authorizeChild(childId)
    if (error) return error

    const { error: rpcError } = await supabase!.rpc('record_reading_word_tap', {
      p_child_id: childId,
      p_normalized_word: normalized,
    })

    if (rpcError) {
      console.error('Error recording reading word tap:', rpcError)
      return NextResponse.json({ error: 'Failed to record tap' }, { status: 500 })
    }

    return NextResponse.json({ recorded: true, word: normalized })
  } catch (err) {
    console.error('Error in reading-word-taps POST:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: resolve a queued word — the parent added it, or declined it.
export async function PATCH(request: NextRequest) {
  try {
    const { childId, id, action } = (await request.json()) ?? {}
    if (!childId || !id || (action !== 'promote' && action !== 'dismiss')) {
      return NextResponse.json(
        { error: 'Requires childId, id and action of "promote" or "dismiss"' },
        { status: 400 }
      )
    }

    const { error, supabase } = await authorizeChild(childId)
    if (error) return error

    // Declining is permanent for that word: the parent has judged it, and
    // re-asking every few days would be nagging.
    const patch =
      action === 'promote' ? { promoted_to_struggling: true } : { dismissed: true }

    const { error: updateError } = await supabase!
      .from('reading_word_taps')
      .update(patch)
      .eq('id', id)
      .eq('child_id', childId)

    if (updateError) {
      console.error('Error updating reading word tap:', updateError)
      return NextResponse.json({ error: 'Failed to update word' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in reading-word-taps PATCH:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
