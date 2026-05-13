import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  INTERACTION_EFFECTS,
  XP_PER_LEVEL,
  BEHAVIORS_BY_LEVEL,
  type InteractionType,
  type Pet,
  type PetType,
} from '@/lib/types'

interface RouteParams {
  params: Promise<{ petId: string }>
}

interface InteractBody {
  interactionType: InteractionType
  childName?: string
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { petId } = await params
    const body: InteractBody = await request.json()
    const { interactionType, childName } = body

    if (!interactionType || !['feed', 'play', 'pet', 'talk'].includes(interactionType)) {
      return NextResponse.json(
        { error: 'Invalid interaction type' },
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

    // Fetch pet with child info
    const { data: pet, error: petError } = await supabase
      .from('pets')
      .select('*, children(name)')
      .eq('id', petId)
      .single()

    if (petError || !pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 })
    }

    // Calculate stat changes
    const effects = INTERACTION_EFFECTS[interactionType]
    const newHappiness = Math.max(0, Math.min(100, pet.happiness + effects.happiness))
    const newEnergy = Math.max(0, Math.min(100, pet.energy + effects.energy))
    const newXP = pet.experience_points + effects.xp

    // Check for level up
    let newLevel = pet.level
    let newBehaviors = [...(pet.unlocked_behaviors || [])]

    for (let i = pet.level; i < XP_PER_LEVEL.length; i++) {
      if (newXP >= XP_PER_LEVEL[i]) {
        newLevel = i + 1
      } else {
        break
      }
    }

    // Unlock new behaviors if leveled up
    if (newLevel > pet.level) {
      const petBehaviors = BEHAVIORS_BY_LEVEL[pet.pet_type as PetType] || []
      for (let lvl = pet.level; lvl < newLevel && lvl < petBehaviors.length; lvl++) {
        const levelBehaviors = petBehaviors[lvl] || []
        for (const behavior of levelBehaviors) {
          if (!newBehaviors.includes(behavior)) {
            newBehaviors.push(behavior)
          }
        }
      }
    }

    // Generate pet response using Claude
    const petResponse = await generatePetResponse(
      pet as Pet,
      interactionType,
      childName || (pet.children as { name: string })?.name || 'friend'
    )

    // Update pet stats
    const { data: updatedPet, error: updateError } = await supabase
      .from('pets')
      .update({
        happiness: newHappiness,
        energy: newEnergy,
        experience_points: newXP,
        level: newLevel,
        unlocked_behaviors: newBehaviors,
        last_interacted_at: new Date().toISOString(),
      })
      .eq('id', petId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating pet:', updateError)
      return NextResponse.json(
        { error: 'Failed to update pet' },
        { status: 500 }
      )
    }

    // Record the interaction
    await supabase.from('pet_interactions').insert({
      pet_id: petId,
      interaction_type: interactionType,
      pet_response: petResponse,
      happiness_change: effects.happiness,
      energy_change: effects.energy,
      xp_gained: effects.xp,
    })

    const leveledUp = newLevel > pet.level

    return NextResponse.json({
      pet: updatedPet,
      response: petResponse,
      effects: {
        happiness: effects.happiness,
        energy: effects.energy,
        xp: effects.xp,
      },
      leveledUp,
      newBehaviors: leveledUp ? newBehaviors.filter(b => !pet.unlocked_behaviors?.includes(b)) : [],
    })
  } catch (error) {
    console.error('Error in pet interact:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function generatePetResponse(
  pet: Pet,
  interaction: InteractionType,
  childName: string
): Promise<string> {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const interactionVerb = {
      feed: 'gave you a yummy treat',
      play: 'wants to play with you',
      pet: 'is petting you gently',
      talk: 'wants to chat with you',
    }[interaction]

    const moodDescription =
      pet.happiness > 70
        ? 'very happy'
        : pet.happiness > 40
          ? 'content'
          : 'needs some love'

    const energyDescription =
      pet.energy > 70 ? 'energetic' : pet.energy > 40 ? 'relaxed' : 'sleepy'

    const prompt = `You are ${pet.name}, a ${pet.personality} ${pet.pet_type}.
${childName} just ${interactionVerb}.
Respond in 1-2 short, cute sentences from the pet's perspective.
The child is young (around 4-6 years old), so keep it simple, joyful, and encouraging.
Current mood: ${moodDescription}
Energy level: ${energyDescription}

Important: Just give the response directly, no quotes or attribution needed. Use simple words and be very friendly.`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    return textContent?.text || getDefaultResponse(pet, interaction)
  } catch (error) {
    console.error('Error generating pet response:', error)
    return getDefaultResponse(pet, interaction)
  }
}

function getDefaultResponse(pet: Pet, interaction: InteractionType): string {
  const responses: Record<InteractionType, string[]> = {
    feed: [
      `Yummy! Thank you so much! *happy ${pet.pet_type} sounds*`,
      `That was delicious! You're the best!`,
      `Mmmm, my favorite! *wiggles happily*`,
    ],
    play: [
      `Yay, let's play! This is so fun!`,
      `Wheee! I love playing with you!`,
      `*bounces excitedly* Again, again!`,
    ],
    pet: [
      `That feels so nice! *happy purrs*`,
      `I love cuddles! You're so gentle!`,
      `*snuggles closer* You're my favorite!`,
    ],
    talk: [
      `I love hearing your voice! Tell me more!`,
      `*listens happily* You're so smart!`,
      `That's so cool! I like talking with you!`,
    ],
  }

  const options = responses[interaction]
  return options[Math.floor(Math.random() * options.length)]
}
