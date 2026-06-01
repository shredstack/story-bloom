import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'scavenger-hunt-photos'
const SIGNED_URL_TTL = 60 * 60 * 24 * 7 // 7 days

// GET: list finds with signed photo URLs.
//   ?childId=  (required)  ?sessionId=  (optional filter)
//   ?view=kid|parent       kid (default) hides flagged/parent-rejected finds.
//   ?matchedOnly=true      only verified matches (used by the "My Finds" gallery)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const childId = searchParams.get('childId')
    const sessionId = searchParams.get('sessionId')
    const view = searchParams.get('view') === 'parent' ? 'parent' : 'kid'
    const matchedOnly = searchParams.get('matchedOnly') === 'true'

    if (!childId) {
      return NextResponse.json(
        { error: 'Missing required parameter: childId' },
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

    // Verify ownership.
    const { data: child } = await supabase
      .from('children')
      .select('id, user_id, name')
      .eq('id', childId)
      .single()

    if (!child || child.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    let query = supabase
      .from('scavenger_hunt_finds')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    const { data: finds, error } = await query

    if (error) {
      console.error('Error fetching scavenger finds:', error)
      return NextResponse.json(
        { error: 'Failed to fetch finds' },
        { status: 500 }
      )
    }

    let visible = finds || []

    // The kid-facing gallery is a scrapbook of safe, verified finds only.
    if (view === 'kid') {
      visible = visible.filter(
        (f) => !f.ai_flagged && f.parent_override !== 'rejected'
      )
    }
    if (matchedOnly) {
      visible = visible.filter((f) => f.is_match && f.parent_override !== 'rejected')
    }

    // Attach short-lived signed URLs.
    const withUrls = await Promise.all(
      visible.map(async (find) => {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(find.photo_storage_path, SIGNED_URL_TTL)
        return { ...find, photo_url: signed?.signedUrl || null }
      })
    )

    return NextResponse.json({ finds: withUrls, childName: child.name })
  } catch (error) {
    console.error('Error in scavenger-hunt finds GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
