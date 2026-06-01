import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  mapReadingLevelToScavenger,
  scavengerLevelsAtOrBelow,
  SCAVENGER_HUNT_DEFAULTS,
  type ScavengerLocation,
} from '@/lib/types'
import {
  selectScavengerPrompts,
  recentlyFoundPromptIds,
  toClientPrompt,
} from '@/lib/services/scavenger-prompts'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

interface PromptActionBody {
  promptId: string
  action: 'skip' | 'replace'
  // Prompt ids already shown in this session, so a replacement is genuinely fresh.
  currentPromptIds?: string[]
}

// POST: skip a prompt (no photo, no cash) or replace it with a fresh one.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params
    const body: PromptActionBody = await request.json()
    const { promptId, action, currentPromptIds = [] } = body

    if (!promptId || (action !== 'skip' && action !== 'replace')) {
      return NextResponse.json(
        { error: 'Missing or invalid fields: promptId, action' },
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

    const { data: session } = await supabase
      .from('scavenger_hunt_sessions')
      .select(
        'id, child_id, location_set, prompts_skipped, prompts_replaced, completed_at, children!inner(user_id, reading_level)'
      )
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const childData = session.children as unknown as {
      user_id: string
      reading_level: string
    }
    if (childData.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (session.completed_at) {
      return NextResponse.json(
        { error: 'This hunt is already finished.' },
        { status: 400 }
      )
    }

    if (action === 'skip') {
      await supabase
        .from('scavenger_hunt_sessions')
        .update({ prompts_skipped: (session.prompts_skipped || 0) + 1 })
        .eq('id', sessionId)

      return NextResponse.json({ ok: true })
    }

    // action === 'replace'
    if (
      (session.prompts_replaced || 0) >=
      SCAVENGER_HUNT_DEFAULTS.maxReplacementsPerSession
    ) {
      return NextResponse.json(
        {
          error: "You've used all your new ones — try a skip instead!",
          replacementsExhausted: true,
        },
        { status: 400 }
      )
    }

    const level = mapReadingLevelToScavenger(childData.reading_level)
    const levels = scavengerLevelsAtOrBelow(level)

    // Don't draw a prompt already in this session or recently found.
    const recentlyFound = await recentlyFoundPromptIds(supabase, session.child_id)
    const exclude = Array.from(
      new Set<string>([...currentPromptIds, promptId, ...recentlyFound])
    )

    const [fresh] = await selectScavengerPrompts(supabase, {
      locationSet: session.location_set as ScavengerLocation,
      levels,
      limit: 1,
      excludePromptIds: exclude,
    })

    if (!fresh) {
      return NextResponse.json(
        { error: 'No fresh prompts left — try a skip!', replacementsExhausted: true },
        { status: 400 }
      )
    }

    await supabase
      .from('scavenger_hunt_sessions')
      .update({ prompts_replaced: (session.prompts_replaced || 0) + 1 })
      .eq('id', sessionId)

    return NextResponse.json({ nextPrompt: toClientPrompt(fresh) })
  } catch (error) {
    console.error('Error in scavenger-hunt prompt-action:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
