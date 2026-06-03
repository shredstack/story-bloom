import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createClient } from '@/lib/supabase/server'
import { verifyScavengerPhoto } from '@/lib/services/scavenger-verifier'
import { recordEngagement } from '@/lib/services/scavenger-progress'
import { SCAVENGER_HUNT_DEFAULTS } from '@/lib/types'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

const BUCKET = 'scavenger-hunt-photos'

// Week start (Monday) — mirrors the cash-rewards / word-rescue logic.
function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date)
  const dayOfWeek = d.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

// POST: submit a photo for a prompt and get an AI verdict (+ cash if it matches)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params

    const formData = await request.formData()
    const photo = formData.get('photo') as File | null
    const promptId = formData.get('promptId') as string | null

    if (!photo || !promptId) {
      return NextResponse.json(
        { error: 'Missing required fields: photo and promptId' },
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

    // Verify session exists and the user owns it (via the child).
    const { data: session } = await supabase
      .from('scavenger_hunt_sessions')
      .select(
        'id, child_id, prompts_attempted, prompts_found, find_cash_earned, cash_earned, completed_at, children!inner(user_id)'
      )
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const childrenData = session.children as unknown as { user_id: string }
    if (childrenData.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (session.completed_at) {
      return NextResponse.json(
        { error: 'This hunt is already finished.' },
        { status: 400 }
      )
    }

    // Rate limit: at most ~1 verify every 2s per child (anti-spam).
    const { data: lastFind } = await supabase
      .from('scavenger_hunt_finds')
      .select('created_at')
      .eq('child_id', session.child_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastFind?.created_at) {
      const elapsed = Date.now() - new Date(lastFind.created_at).getTime()
      if (elapsed < 1500) {
        return NextResponse.json(
          { error: 'One sec — checking the last photo!' },
          { status: 429 }
        )
      }
    }

    // Load the prompt's hidden verification criteria.
    const { data: prompt } = await supabase
      .from('scavenger_hunt_prompts')
      .select('id, prompt_text, target_description, example_objects')
      .eq('id', promptId)
      .single()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    // Existing attempts for this prompt in this session.
    const { data: priorFinds } = await supabase
      .from('scavenger_hunt_finds')
      .select('id, is_match')
      .eq('session_id', sessionId)
      .eq('prompt_id', promptId)

    const attemptCount = priorFinds?.length || 0
    const alreadyMatched = (priorFinds || []).some((f) => f.is_match)

    if (attemptCount >= SCAVENGER_HUNT_DEFAULTS.maxAttemptsPerPrompt) {
      return NextResponse.json(
        {
          error: "That's lots of tries! Skip it or get a new one.",
          attemptsExceeded: true,
        },
        { status: 400 }
      )
    }

    const attemptNumber = attemptCount + 1

    // Re-encode the photo: auto-orient, resize, JPEG. sharp drops metadata by
    // default, which strips EXIF (including GPS) — see Phase 4 (no location/PII).
    const inputBuffer = Buffer.from(await photo.arrayBuffer())
    let processedBuffer: Buffer
    try {
      processedBuffer = await sharp(inputBuffer)
        .rotate()
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer()
    } catch (e) {
      console.error('Error processing scavenger photo:', e)
      return NextResponse.json(
        { error: "That photo didn't work — try taking it again!" },
        { status: 400 }
      )
    }

    // Upload to the private bucket.
    // Path: ${user_id}/${child_id}/${sessionId}/${findId}.jpg
    const findId = crypto.randomUUID()
    const storagePath = `${user.id}/${session.child_id}/${sessionId}/${findId}.jpg`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, processedBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading scavenger photo:', uploadError)
      return NextResponse.json(
        { error: 'Could not save your photo. Try again!' },
        { status: 500 }
      )
    }

    // AI verdict (always resolves; failures come back as a retry-friendly default).
    const verdict = await verifyScavengerPhoto({
      imageBase64: processedBuffer.toString('base64'),
      mimeType: 'image/jpeg',
      promptText: prompt.prompt_text,
      targetDescription: prompt.target_description,
      exampleObjects: prompt.example_objects || [],
    })

    // Settings that gate cash.
    const { data: settings } = await supabase
      .from('app_settings')
      .select(
        'cash_reward_enabled, scavenger_hunt_enabled, cash_per_scavenger_find, scavenger_ai_confidence_floor, weekly_cash_cap'
      )
      .eq('user_id', user.id)
      .single()

    const floor =
      settings?.scavenger_ai_confidence_floor ??
      SCAVENGER_HUNT_DEFAULTS.confidenceFloor
    const cashPerFind =
      settings?.cash_per_scavenger_find ?? SCAVENGER_HUNT_DEFAULTS.cashPerFind
    const weeklyCap = settings?.weekly_cash_cap ?? 20

    // Borderline (below floor) is treated as "try again", not a hard fail.
    const countsAsMatch = verdict.isMatch && verdict.confidence >= floor

    // Cash: only on a counted match, when enabled, first match per prompt, capped.
    let cashEarned = 0
    let weeklyCapReached = false

    const weekStartDate = getWeekStartDate()

    if (
      countsAsMatch &&
      !alreadyMatched &&
      settings?.cash_reward_enabled &&
      settings?.scavenger_hunt_enabled !== false
    ) {
      const { data: weekRow } = await supabase
        .from('cash_rewards')
        .select('cash_earned')
        .eq('child_id', session.child_id)
        .eq('week_start_date', weekStartDate)
        .maybeSingle()

      const currentWeekCash = parseFloat(String(weekRow?.cash_earned || 0))
      const remaining = Math.max(0, weeklyCap - currentWeekCash)

      if (remaining <= 0) {
        weeklyCapReached = true
      } else {
        cashEarned = Math.min(cashPerFind, remaining)
        if (cashEarned >= remaining) weeklyCapReached = true
      }
    }

    // Record the find.
    const { data: find, error: findError } = await supabase
      .from('scavenger_hunt_finds')
      .insert({
        id: findId,
        session_id: sessionId,
        prompt_id: promptId,
        child_id: session.child_id,
        prompt_text: prompt.prompt_text,
        photo_storage_path: storagePath,
        attempt_number: attemptNumber,
        is_match: countsAsMatch,
        ai_confidence: verdict.confidence,
        ai_reasoning: verdict.reasoning,
        ai_kid_message: verdict.kidMessage,
        ai_model: verdict.model,
        ai_flagged: verdict.flagged,
        cash_earned: cashEarned,
      })
      .select()
      .single()

    if (findError) {
      console.error('Error recording scavenger find:', findError)
      return NextResponse.json(
        { error: 'Could not save your find. Try again!' },
        { status: 500 }
      )
    }

    // Update session counters. A "found" counts only the first match for a prompt.
    const isFirstMatchForPrompt = countsAsMatch && !alreadyMatched
    await supabase
      .from('scavenger_hunt_sessions')
      .update({
        prompts_attempted: session.prompts_attempted + 1,
        prompts_found: session.prompts_found + (isFirstMatchForPrompt ? 1 : 0),
        find_cash_earned:
          parseFloat(String(session.find_cash_earned || 0)) + cashEarned,
        cash_earned: parseFloat(String(session.cash_earned || 0)) + cashEarned,
      })
      .eq('id', sessionId)

    // Adaptive progress: count the exposure on the first attempt for this clue this
    // session, and the find on the first verified match. May trigger mastery (3 finds,
    // no outstanding "tricky" repeats) inside the RPC. Best-effort — never blocks play.
    await recordEngagement(supabase, {
      childId: session.child_id,
      promptId,
      countShown: attemptCount === 0,
      found: isFirstMatchForPrompt,
    })

    // Feed the weekly cash record (same row + cap as word-rescue and the bonus).
    if (cashEarned > 0) {
      try {
        await supabase.rpc('upsert_scavenger_cash_reward', {
          p_child_id: session.child_id,
          p_week_start_date: weekStartDate,
          p_cash_earned: cashEarned,
        })
      } catch (e) {
        console.error('Scavenger cash reward RPC failed:', e)
      }
    }

    return NextResponse.json({
      isMatch: countsAsMatch,
      confidence: verdict.confidence,
      reasoning: verdict.reasoning,
      kidMessage: verdict.kidMessage,
      flagged: verdict.flagged,
      model: verdict.model,
      cashEarned,
      weeklyCapReached,
      attemptNumber,
      findId: find.id,
    })
  } catch (error) {
    console.error('Error in scavenger-hunt verify:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const maxDuration = 60
