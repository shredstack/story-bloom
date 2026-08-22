import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeReadingPreferences } from '@/lib/reading/defaults'

/**
 * Per-child reading guide + typography preferences (spec §6.7).
 *
 * The column is sparse: it stores only the keys a parent has actually changed.
 * The client merges whatever comes back over DEFAULT_READING_PREFERENCES, so
 * adding a new preference never needs a migration or a backfill.
 */

/** Confirms the signed-in user owns this child. Mirrors /api/struggling-words. */
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
    .select('id, user_id, reading_level, default_text_size, reading_preferences')
    .eq('id', childId)
    .single()

  if (!child || child.user_id !== user.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  }

  return { supabase, child }
}

// GET: read a child's stored (sparse) preferences.
export async function GET(request: NextRequest) {
  try {
    const childId = new URL(request.url).searchParams.get('childId')
    if (!childId) {
      return NextResponse.json(
        { error: 'Missing required parameter: childId' },
        { status: 400 }
      )
    }

    const { error, child } = await authorizeChild(childId)
    if (error) return error

    return NextResponse.json({
      preferences: sanitizeReadingPreferences(child!.reading_preferences),
      readingLevel: child!.reading_level ?? null,
      defaultTextSize: child!.default_text_size ?? null,
    })
  } catch (err) {
    console.error('Error in reading-preferences GET:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: merge a partial update into the stored preferences.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { childId, preferences, replace } = body ?? {}

    if (!childId) {
      return NextResponse.json(
        { error: 'Missing required field: childId' },
        { status: 400 }
      )
    }

    const { error, supabase, child } = await authorizeChild(childId)
    if (error) return error

    // Sanitize BEFORE merging so a malformed or newer-client key can never be
    // written into the column.
    // `replace: true` is how "reset to defaults" clears the column — a plain
    // merge of `{}` would be a no-op.
    const incoming = sanitizeReadingPreferences(preferences)
    const merged = replace
      ? incoming
      : { ...sanitizeReadingPreferences(child!.reading_preferences), ...incoming }

    const { error: updateError } = await supabase!
      .from('children')
      .update({ reading_preferences: merged })
      .eq('id', childId)

    if (updateError) {
      console.error('Error saving reading preferences:', updateError)
      return NextResponse.json(
        { error: 'Failed to save preferences' },
        { status: 500 }
      )
    }

    return NextResponse.json({ preferences: merged })
  } catch (err) {
    console.error('Error in reading-preferences PATCH:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
