import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { selectWordRescueWords } from '@/lib/games/wordRescueSelection'

interface CreateSessionBody {
  childId: string
  buddyPetId?: string
}

/**
 * Safety valve on the candidate fetch. Word lists run to tens of words, not
 * hundreds; the rows are already ordered least-recently-practiced first, so a
 * list long enough to hit this cap loses only words the child just saw.
 */
const CANDIDATE_POOL_LIMIT = 500

// POST: Create a new Word Rescue session
export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionBody = await request.json()
    const { childId, buddyPetId } = body

    if (!childId) {
      return NextResponse.json(
        { error: 'Missing required field: childId' },
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

    // Verify user owns this child
    const { data: child } = await supabase
      .from('children')
      .select('id, user_id')
      .eq('id', childId)
      .single()

    if (!child || child.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get app settings for words per session
    const { data: settings } = await supabase
      .from('app_settings')
      .select('words_per_session')
      .eq('user_id', user.id)
      .single()

    const wordsPerSession = settings?.words_per_session || 10

    // Fetch every word this child could practice, then let
    // `selectWordRescueWords` decide the session: the parent's starred words
    // first, then newest struggles, then least recently practiced. Ordering
    // can't happen in the query — `current_stage` is text, so the database
    // would sort `blooming` ahead of `seedling`.
    const { data: candidates, error: wordsError } = await supabase
      .from('struggling_words')
      .select('*')
      .eq('child_id', childId)
      .eq('is_active', true)
      .neq('current_stage', 'mastered')
      .order('last_practiced_at', { ascending: true, nullsFirst: true })
      .limit(CANDIDATE_POOL_LIMIT)

    if (wordsError) {
      console.error('Error fetching words:', wordsError)
      return NextResponse.json(
        { error: 'Failed to fetch words' },
        { status: 500 }
      )
    }

    const words = selectWordRescueWords(candidates || [], wordsPerSession)

    if (words.length === 0) {
      return NextResponse.json(
        { error: 'No words to practice. Add some words first!' },
        { status: 400 }
      )
    }

    // Create the session
    const { data: session, error: sessionError } = await supabase
      .from('word_rescue_sessions')
      .insert({
        child_id: childId,
        buddy_pet_id: buddyPetId || null,
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Error creating session:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    // Get buddy pet details if provided
    let buddyPet = null
    if (buddyPetId) {
      const { data: pet } = await supabase
        .from('pets')
        .select('*')
        .eq('id', buddyPetId)
        .single()
      buddyPet = pet
    }

    return NextResponse.json({
      session,
      words,
      buddyPet,
    })
  } catch (error) {
    console.error('Error in word-rescue sessions POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
