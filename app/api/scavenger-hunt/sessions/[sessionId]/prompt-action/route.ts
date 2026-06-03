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
  previousSessionEngagedPromptIds,
  toClientPrompt,
} from '@/lib/services/scavenger-prompts'
import { recordEngagement, flagStruggle } from '@/lib/services/scavenger-progress'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

interface PromptActionBody {
  promptId: string
  action: 'skip' | 'replace' | 'struggle'
  // Prompt ids already shown in this session, so a replacement is genuinely fresh.
  currentPromptIds?: string[]
}

const VALID_ACTIONS = ['skip', 'replace', 'struggle']

// Whether this prompt has already been engaged (a photo submitted) in this session,
// so a follow-up skip doesn't double-count the same clue's exposure.
async function hasPriorFind(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  promptId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('scavenger_hunt_finds')
    .select('id')
    .eq('session_id', sessionId)
    .eq('prompt_id', promptId)
    .limit(1)
    .maybeSingle()
  return !!data
}

// POST: skip a prompt (no photo, no cash) or replace it with a fresh one.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params
    const body: PromptActionBody = await request.json()
    const { promptId, action, currentPromptIds = [] } = body

    if (!promptId || !VALID_ACTIONS.includes(action)) {
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

    if (action === 'struggle') {
      // Kid tapped "This is tricky" — owe forced reappearances (and un-retire if
      // it had been mastered). Doesn't count as an engagement on its own.
      await flagStruggle(supabase, { childId: session.child_id, promptId })
      return NextResponse.json({ ok: true })
    }

    if (action === 'skip') {
      await supabase
        .from('scavenger_hunt_sessions')
        .update({ prompts_skipped: (session.prompts_skipped || 0) + 1 })
        .eq('id', sessionId)

      // Record the engagement: a skip is an exposure (and pays off a struggle
      // repeat), but only the first engagement with this clue this session counts.
      const countShown = !(await hasPriorFind(supabase, sessionId, promptId))
      await recordEngagement(supabase, {
        childId: session.child_id,
        promptId,
        countShown,
        found: false,
      })

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
    const withImages = level === 'pre_k'

    // Don't draw a prompt already in this session; softly avoid the previous hunt.
    const exclude = Array.from(
      new Set<string>([...currentPromptIds, promptId])
    )
    const softExclude = await previousSessionEngagedPromptIds(
      supabase,
      session.child_id
    )

    const [fresh] = await selectScavengerPrompts(supabase, {
      childId: session.child_id,
      locationSet: session.location_set as ScavengerLocation,
      levels,
      limit: 1,
      excludePromptIds: exclude,
      softExcludePromptIds: softExclude,
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

    return NextResponse.json({ nextPrompt: toClientPrompt(fresh, { withImages }) })
  } catch (error) {
    console.error('Error in scavenger-hunt prompt-action:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
