import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syllabify, normalizeWord } from '@/lib/utils/syllabify'
import { validateWord } from '@/lib/utils/spellcheck'

/** A star can't be topped up past a few weeks of sessions. */
const MAX_FOCUS_REPEATS = 20

// GET: List struggling words for a child
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const childId = searchParams.get('childId')
    const stage = searchParams.get('stage') // Optional filter: 'seedling', 'growing', 'blooming', 'mastered'
    const activeOnly = searchParams.get('activeOnly') !== 'false' // Default to true

    if (!childId) {
      return NextResponse.json(
        { error: 'Missing required parameter: childId' },
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

    // Build query
    let query = supabase
      .from('struggling_words')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    if (stage) {
      query = query.eq('current_stage', stage)
    }

    const { data: words, error } = await query

    if (error) {
      console.error('Error fetching struggling words:', error)
      return NextResponse.json(
        { error: 'Failed to fetch words' },
        { status: 500 }
      )
    }

    // Calculate stats
    const stats = {
      total: words?.length || 0,
      seedling: words?.filter((w) => w.current_stage === 'seedling').length || 0,
      growing: words?.filter((w) => w.current_stage === 'growing').length || 0,
      blooming: words?.filter((w) => w.current_stage === 'blooming').length || 0,
      mastered: words?.filter((w) => w.current_stage === 'mastered').length || 0,
      focused: words?.filter((w) => (w.focus_repeats || 0) > 0).length || 0,
    }

    return NextResponse.json({ words: words || [], stats })
  } catch (error) {
    console.error('Error in struggling-words GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Add word(s) manually
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { childId, word, words } = body

    if (!childId) {
      return NextResponse.json(
        { error: 'Missing required field: childId' },
        { status: 400 }
      )
    }

    if (!word && (!words || !Array.isArray(words) || words.length === 0)) {
      return NextResponse.json(
        { error: 'Must provide either word or words array' },
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

    // Handle single word
    if (word) {
      const normalized = normalizeWord(word)

      // Validate spelling
      const validationError = await validateWord(normalized)
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 })
      }

      const syllables = syllabify(normalized)

      const { data: newWord, error } = await supabase
        .from('struggling_words')
        .upsert(
          {
            child_id: childId,
            word: normalized,
            source: 'manual',
            syllable_breakdown: syllables,
            times_seen: 1,
          },
          {
            onConflict: 'child_id,word',
            ignoreDuplicates: true,
          }
        )
        .select()
        .single()

      if (error && error.code !== '23505') {
        console.error('Error adding word:', error)
        return NextResponse.json(
          { error: 'Failed to add word' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        word: newWord,
        alreadyExisted: error?.code === '23505',
      })
    }

    // Handle bulk words
    const wordsToAdd = words as string[]
    let added = 0
    let skipped = 0
    let existing = 0

    for (const w of wordsToAdd) {
      const normalized = normalizeWord(w)

      // Validate spelling
      const validationError = await validateWord(normalized)
      if (validationError) {
        skipped++
        continue
      }

      const syllables = syllabify(normalized)

      const { error } = await supabase.from('struggling_words').upsert(
        {
          child_id: childId,
          word: normalized,
          source: 'manual',
          syllable_breakdown: syllables,
          times_seen: 1,
        },
        {
          onConflict: 'child_id,word',
          ignoreDuplicates: true,
        }
      )

      if (error) {
        if (error.code === '23505') {
          existing++
        } else {
          console.error('Error adding word:', error)
        }
      } else {
        added++
      }
    }

    return NextResponse.json({
      added,
      existing,
      skipped,
      total: wordsToAdd.length,
    })
  } catch (error) {
    console.error('Error in struggling-words POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: Star/unstar a word so Word Rescue focuses on it in coming sessions
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { wordId, focusRepeats } = body

    if (!wordId || typeof focusRepeats !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: wordId and focusRepeats' },
        { status: 400 }
      )
    }

    const clamped = Math.min(
      MAX_FOCUS_REPEATS,
      Math.max(0, Math.round(focusRepeats))
    )

    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership through the child
    const { data: existing } = await supabase
      .from('struggling_words')
      .select('id, current_stage, children!inner(user_id)')
      .eq('id', wordId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 })
    }

    const owner = existing.children as unknown as { user_id: string }
    if (owner.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const update: Record<string, unknown> = { focus_repeats: clamped }

    // Starring a mastered word puts it back in rotation — otherwise the star
    // would be silently ignored, since sessions skip mastered words.
    if (clamped > 0 && existing.current_stage === 'mastered') {
      update.current_stage = 'blooming'
      update.mastered_at = null
    }

    const { data: word, error } = await supabase
      .from('struggling_words')
      .update(update)
      .eq('id', wordId)
      .select()
      .single()

    if (error) {
      console.error('Error updating focus:', error)
      return NextResponse.json(
        { error: 'Failed to update word' },
        { status: 500 }
      )
    }

    return NextResponse.json({ word })
  } catch (error) {
    console.error('Error in struggling-words PATCH:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: Remove a word by ID (via query param)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const wordId = searchParams.get('id')

    if (!wordId) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
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

    // Get the word and verify ownership through child
    const { data: word } = await supabase
      .from('struggling_words')
      .select('id, child_id, children!inner(user_id)')
      .eq('id', wordId)
      .single()

    if (!word) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 })
    }

    const childrenData = word.children as unknown as { user_id: string }
    if (childrenData.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete the word
    const { error } = await supabase
      .from('struggling_words')
      .delete()
      .eq('id', wordId)

    if (error) {
      console.error('Error deleting word:', error)
      return NextResponse.json(
        { error: 'Failed to delete word' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in struggling-words DELETE:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
