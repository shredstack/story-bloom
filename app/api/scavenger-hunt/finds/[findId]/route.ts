import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ findId: string }>
}

const BUCKET = 'scavenger-hunt-photos'

function getWeekStartDate(date: Date): string {
  const d = new Date(date)
  const dayOfWeek = d.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

// Load a find and confirm the requesting user owns it (via the child).
async function loadOwnedFind(
  supabase: Awaited<ReturnType<typeof createClient>>,
  findId: string,
  userId: string
) {
  const { data: find } = await supabase
    .from('scavenger_hunt_finds')
    .select('*, children!inner(user_id)')
    .eq('id', findId)
    .single()

  if (!find) return { error: 'not_found' as const }
  const childrenData = find.children as unknown as { user_id: string }
  if (childrenData.user_id !== userId) return { error: 'forbidden' as const }
  return { find }
}

// PATCH: parent override a verdict ({ override: 'approved' | 'rejected' }).
// Reversing a paid-out match adjusts the weekly cash tally (only if not yet paid).
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { findId } = await params
    const { override } = await request.json()

    if (override !== 'approved' && override !== 'rejected') {
      return NextResponse.json(
        { error: "override must be 'approved' or 'rejected'" },
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

    const result = await loadOwnedFind(supabase, findId, user.id)
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Find not found' }, { status: 404 })
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const find = result.find!

    const findCash = parseFloat(String(find.cash_earned || 0))
    const wasCounted = find.parent_override !== 'rejected'
    const willCount = override !== 'rejected'
    const delta = (willCount ? findCash : 0) - (wasCounted ? findCash : 0)

    // Adjust the weekly cash record if there's a change and the week isn't paid yet.
    if (delta !== 0 && findCash > 0) {
      const weekStart = getWeekStartDate(new Date(find.created_at))
      const { data: weekRow } = await supabase
        .from('cash_rewards')
        .select('id, cash_earned, is_paid')
        .eq('child_id', find.child_id)
        .eq('week_start_date', weekStart)
        .maybeSingle()

      if (weekRow && !weekRow.is_paid) {
        const newCash = Math.max(
          0,
          parseFloat(String(weekRow.cash_earned || 0)) + delta
        )
        await supabase
          .from('cash_rewards')
          .update({ cash_earned: newCash })
          .eq('id', weekRow.id)

        // Keep the session totals consistent too.
        const { data: sess } = await supabase
          .from('scavenger_hunt_sessions')
          .select('prompts_found, find_cash_earned, cash_earned')
          .eq('id', find.session_id)
          .single()

        if (sess) {
          await supabase
            .from('scavenger_hunt_sessions')
            .update({
              prompts_found: Math.max(
                0,
                (sess.prompts_found || 0) + (willCount ? 1 : -1)
              ),
              find_cash_earned: Math.max(
                0,
                parseFloat(String(sess.find_cash_earned || 0)) + delta
              ),
              cash_earned: Math.max(
                0,
                parseFloat(String(sess.cash_earned || 0)) + delta
              ),
            })
            .eq('id', find.session_id)
        }
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('scavenger_hunt_finds')
      .update({ parent_reviewed: true, parent_override: override })
      .eq('id', findId)
      .select()
      .single()

    if (updateError) {
      console.error('Error overriding find:', updateError)
      return NextResponse.json({ error: 'Failed to update find' }, { status: 500 })
    }

    return NextResponse.json({ find: updated })
  } catch (error) {
    console.error('Error in scavenger-hunt find PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: parent control to remove a photo (and its find row).
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { findId } = await params

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await loadOwnedFind(supabase, findId, user.id)
    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Find not found' }, { status: 404 })
    }
    if (result.error === 'forbidden') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const find = result.find!

    // Remove the storage object first, then the row.
    if (find.photo_storage_path) {
      await supabase.storage.from(BUCKET).remove([find.photo_storage_path])
    }

    const { error: deleteError } = await supabase
      .from('scavenger_hunt_finds')
      .delete()
      .eq('id', findId)

    if (deleteError) {
      console.error('Error deleting find:', deleteError)
      return NextResponse.json({ error: 'Failed to delete find' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error in scavenger-hunt find DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
