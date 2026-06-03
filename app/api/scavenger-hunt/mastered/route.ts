import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapReadingLevelToScavenger } from '@/lib/types'
import { getMasteredPrompts } from '@/lib/services/scavenger-progress'

// GET: the child's mastered (retired) clues for the kid-facing trophy shelf.
export async function GET(request: NextRequest) {
  try {
    const childId = request.nextUrl.searchParams.get('childId')
    if (!childId) {
      return NextResponse.json(
        { error: 'Missing required query param: childId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: child } = await supabase
      .from('children')
      .select('id, user_id, reading_level')
      .eq('id', childId)
      .single()

    if (!child || child.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Pre-K children see the picture on the shelf too.
    const withImages = mapReadingLevelToScavenger(child.reading_level) === 'pre_k'
    const mastered = await getMasteredPrompts(supabase, childId, { withImages })

    return NextResponse.json({ mastered })
  } catch (error) {
    console.error('Error in scavenger-hunt mastered GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
