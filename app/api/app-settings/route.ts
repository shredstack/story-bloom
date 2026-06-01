import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_APP_SETTINGS } from '@/lib/types'

// GET: Get user's app settings (creates default if not exists)
export async function GET() {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try to get existing settings
    let { data: settings } = await supabase
      .from('app_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // If no settings exist, create with defaults
    if (!settings) {
      const { data: newSettings, error } = await supabase
        .from('app_settings')
        .insert({
          user_id: user.id,
          ...DEFAULT_APP_SETTINGS,
        })
        .select()
        .single()

      if (error) {
        // Handle race condition where another request may have created it
        if (error.code === '23505') {
          const { data: existingSettings } = await supabase
            .from('app_settings')
            .select('*')
            .eq('user_id', user.id)
            .single()
          settings = existingSettings
        } else {
          console.error('Error creating settings:', error)
          return NextResponse.json(
            { error: 'Failed to create settings' },
            { status: 500 }
          )
        }
      } else {
        settings = newSettings
      }
    }

    // Transform settings to include has_parent_pin and exclude sensitive fields
    const { parent_pin_hash, pin_reset_token, pin_reset_token_expires_at, ...safeSettings } = settings
    const settingsResponse = {
      ...safeSettings,
      has_parent_pin: !!parent_pin_hash,
    }

    return NextResponse.json({ settings: settingsResponse })
  } catch (error) {
    console.error('Error in app-settings GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: Update user's app settings
export async function PATCH(request: NextRequest) {
  try {
    const updates = await request.json()

    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate allowed fields
    const allowedFields = [
      'mastery_correct_threshold',
      'mastery_require_different_days',
      'cash_reward_enabled',
      'cash_per_mastered_word',
      'cash_milestone_bonus_enabled',
      'cash_milestone_10_words',
      'cash_milestone_25_words',
      'cash_milestone_50_words',
      'weekly_cash_cap',
      'words_per_session',
      'show_word_coach_automatically',
      'scavenger_hunt_enabled',
      'cash_per_scavenger_find',
      'scavenger_completion_bonus',
      'scavenger_completion_min_found',
      'scavenger_prompts_per_session',
      'scavenger_ai_confidence_floor',
    ]

    const validUpdates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        validUpdates[key] = value
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Ensure settings exist (upsert)
    const { data: existingSettings } = await supabase
      .from('app_settings')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!existingSettings) {
      // Create with defaults + updates
      const { data: settings, error } = await supabase
        .from('app_settings')
        .insert({
          user_id: user.id,
          ...DEFAULT_APP_SETTINGS,
          ...validUpdates,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating settings:', error)
        return NextResponse.json(
          { error: 'Failed to create settings' },
          { status: 500 }
        )
      }

      return NextResponse.json({ settings })
    }

    // Update existing settings
    const { data: settings, error } = await supabase
      .from('app_settings')
      .update(validUpdates)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating settings:', error)
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error in app-settings PATCH:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
