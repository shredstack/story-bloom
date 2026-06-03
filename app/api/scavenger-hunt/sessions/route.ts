import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  mapReadingLevelToScavenger,
  scavengerLevelsAtOrBelow,
  type ScavengerLocation,
} from '@/lib/types'
import {
  selectScavengerPrompts,
  previousSessionEngagedPromptIds,
  toClientPrompt,
} from '@/lib/services/scavenger-prompts'

interface CreateSessionBody {
  childId: string
  locationSet?: ScavengerLocation
}

const VALID_LOCATIONS: ScavengerLocation[] = ['indoor', 'outdoor', 'either']

// POST: Create a new Scavenger Hunt session
export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionBody = await request.json()
    const { childId } = body
    const locationSet: ScavengerLocation = VALID_LOCATIONS.includes(
      body.locationSet as ScavengerLocation
    )
      ? (body.locationSet as ScavengerLocation)
      : 'either'

    if (!childId) {
      return NextResponse.json(
        { error: 'Missing required field: childId' },
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

    // Verify user owns this child (and grab reading level from the profile)
    const { data: child } = await supabase
      .from('children')
      .select('id, user_id, reading_level')
      .eq('id', childId)
      .single()

    if (!child || child.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Game settings (enabled flag + prompts per session)
    const { data: settings } = await supabase
      .from('app_settings')
      .select('scavenger_hunt_enabled, scavenger_prompts_per_session')
      .eq('user_id', user.id)
      .single()

    if (settings && settings.scavenger_hunt_enabled === false) {
      return NextResponse.json(
        { error: 'Scavenger Hunt is turned off. Ask a parent to enable it.' },
        { status: 403 }
      )
    }

    const promptsPerSession = settings?.scavenger_prompts_per_session || 8

    // Reading level comes from the child's profile (not a per-game setting).
    const level = mapReadingLevelToScavenger(child.reading_level)
    const levels = scavengerLevelsAtOrBelow(level)
    // Pre-K children (lowest reading level) get a picture hint with each clue.
    const withImages = level === 'pre_k'

    // Soft anti-repeat: avoid prompts engaged in the immediately previous hunt.
    // (Per-child progress now drives the rest of the adaptive selection.)
    const softExcludePromptIds = await previousSessionEngagedPromptIds(
      supabase,
      childId
    )

    const prompts = await selectScavengerPrompts(supabase, {
      childId,
      locationSet,
      levels,
      limit: promptsPerSession,
      softExcludePromptIds,
    })

    if (prompts.length === 0) {
      return NextResponse.json(
        { error: 'No hunt prompts available right now. Try a different spot!' },
        { status: 400 }
      )
    }

    // Create the session
    const { data: session, error: sessionError } = await supabase
      .from('scavenger_hunt_sessions')
      .insert({
        child_id: childId,
        location_set: locationSet,
        prompts_total: prompts.length,
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Error creating scavenger hunt session:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      session,
      prompts: prompts.map((p) => toClientPrompt(p, { withImages })),
    })
  } catch (error) {
    console.error('Error in scavenger-hunt sessions POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
