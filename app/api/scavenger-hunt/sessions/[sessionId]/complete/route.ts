import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SCAVENGER_HUNT_DEFAULTS } from '@/lib/types'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

// Week start (Monday) — mirrors the cash-rewards / verify logic.
function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date)
  const dayOfWeek = d.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

// POST: finish the hunt, award the completion bonus, return a summary.
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: session } = await supabase
      .from('scavenger_hunt_sessions')
      .select('*, children!inner(user_id)')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const childrenData = session.children as unknown as { user_id: string }
    if (childrenData.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const promptsFound = session.prompts_found || 0
    const promptsTotal = session.prompts_total || 0
    const findCash = parseFloat(String(session.find_cash_earned || 0))

    // Idempotent: if already completed, just report the stored totals (no double-pay).
    if (session.completed_at) {
      const existingBonus = parseFloat(
        String(session.completion_bonus_earned || 0)
      )
      return NextResponse.json({
        promptsFound,
        promptsTotal,
        findCash,
        completionBonus: existingBonus,
        totalCash: parseFloat(String(session.cash_earned || 0)),
        weeklyCapReached: false,
        alreadyCompleted: true,
      })
    }

    const { data: settings } = await supabase
      .from('app_settings')
      .select(
        'cash_reward_enabled, scavenger_hunt_enabled, scavenger_completion_bonus, scavenger_completion_min_found, weekly_cash_cap'
      )
      .eq('user_id', user.id)
      .single()

    const minFound =
      settings?.scavenger_completion_min_found ??
      SCAVENGER_HUNT_DEFAULTS.completionMinFound
    const bonusAmount =
      settings?.scavenger_completion_bonus ??
      SCAVENGER_HUNT_DEFAULTS.completionBonus
    const weeklyCap = settings?.weekly_cash_cap ?? 20

    let completionBonus = 0
    let weeklyCapReached = false
    const weekStartDate = getWeekStartDate()

    const eligibleForBonus =
      promptsFound >= minFound &&
      settings?.cash_reward_enabled &&
      settings?.scavenger_hunt_enabled !== false

    if (eligibleForBonus) {
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
        completionBonus = Math.min(bonusAmount, remaining)
        if (completionBonus >= remaining) weeklyCapReached = true
      }
    }

    const totalCash = parseFloat(String(session.cash_earned || 0)) + completionBonus

    const { error: updateError } = await supabase
      .from('scavenger_hunt_sessions')
      .update({
        completed_at: new Date().toISOString(),
        completion_bonus_earned: completionBonus,
        cash_earned: totalCash,
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Error completing scavenger session:', updateError)
      return NextResponse.json(
        { error: 'Failed to complete session' },
        { status: 500 }
      )
    }

    if (completionBonus > 0) {
      try {
        await supabase.rpc('upsert_scavenger_cash_reward', {
          p_child_id: session.child_id,
          p_week_start_date: weekStartDate,
          p_cash_earned: completionBonus,
        })
      } catch (e) {
        console.error('Scavenger completion bonus RPC failed:', e)
      }
    }

    return NextResponse.json({
      promptsFound,
      promptsTotal,
      findCash,
      completionBonus,
      totalCash,
      weeklyCapReached,
    })
  } catch (error) {
    console.error('Error in scavenger-hunt complete:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
