import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AccessoryType } from '@/lib/types';

interface RouteParams {
  params: Promise<{ petId: string }>;
}

// GET: Fetch all equipped accessories for a pet
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { petId } = await params;
    const supabase = await createClient();

    // Verify ownership
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user owns the pet's child
    const { data: pet, error: petError } = await supabase
      .from('pets')
      .select('id, child_id, children!inner(user_id)')
      .eq('id', petId)
      .single();

    if (petError || !pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    const petData = pet as any;
    const childUserId = petData.children?.user_id;
    if (childUserId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch equipped accessories with accessory details
    const { data: equipped, error } = await supabase
      .from('pet_equipped_accessories')
      .select('*, accessory:accessories(*)')
      .eq('pet_id', petId);

    if (error) {
      console.error('Error fetching equipped accessories:', error);
      return NextResponse.json(
        { error: 'Failed to fetch equipped accessories' },
        { status: 500 }
      );
    }

    return NextResponse.json({ equippedAccessories: equipped || [] });
  } catch (error) {
    console.error('Error in pet accessories GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

interface EquipAccessoryBody {
  accessoryId: string;
  slot: AccessoryType;
}

// POST: Equip an accessory on a pet
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { petId } = await params;
    const body: EquipAccessoryBody = await request.json();
    const { accessoryId, slot } = body;

    if (!accessoryId || !slot) {
      return NextResponse.json(
        { error: 'Missing accessoryId or slot' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify ownership
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pet and verify ownership
    const { data: pet, error: petError } = await supabase
      .from('pets')
      .select('id, child_id, children!inner(user_id)')
      .eq('id', petId)
      .single();

    if (petError || !pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    const petData = pet as any;
    const childId = petData.child_id;
    const childUserId = petData.children?.user_id;
    if (childUserId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify child owns this accessory
    const { data: childAccessory } = await supabase
      .from('child_accessories')
      .select('id, accessory:accessories(*)')
      .eq('child_id', childId)
      .eq('accessory_id', accessoryId)
      .single();

    if (!childAccessory) {
      return NextResponse.json(
        { error: 'Accessory not unlocked for this child' },
        { status: 400 }
      );
    }

    // Verify the accessory matches the slot
    const accessory = childAccessory.accessory as any;
    if (accessory && accessory.type !== slot) {
      return NextResponse.json(
        { error: 'Accessory type does not match slot' },
        { status: 400 }
      );
    }

    // Upsert the equipped accessory (replace any existing in this slot)
    const { data: equipped, error } = await supabase
      .from('pet_equipped_accessories')
      .upsert(
        {
          pet_id: petId,
          accessory_id: accessoryId,
          slot,
          equipped_at: new Date().toISOString(),
        },
        { onConflict: 'pet_id,slot' }
      )
      .select('*, accessory:accessories(*)')
      .single();

    if (error) {
      console.error('Error equipping accessory:', error);
      return NextResponse.json(
        { error: 'Failed to equip accessory' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Accessory equipped!',
      equippedAccessory: equipped,
    });
  } catch (error) {
    console.error('Error in pet accessories POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

interface UnequipAccessoryBody {
  slot: AccessoryType;
}

// DELETE: Unequip an accessory from a pet
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { petId } = await params;
    const body: UnequipAccessoryBody = await request.json();
    const { slot } = body;

    if (!slot) {
      return NextResponse.json({ error: 'Missing slot' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify ownership
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user owns the pet's child
    const { data: pet, error: petError } = await supabase
      .from('pets')
      .select('id, child_id, children!inner(user_id)')
      .eq('id', petId)
      .single();

    if (petError || !pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    const petData = pet as any;
    const childUserId = petData.children?.user_id;
    if (childUserId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete the equipped accessory for this slot
    const { error } = await supabase
      .from('pet_equipped_accessories')
      .delete()
      .eq('pet_id', petId)
      .eq('slot', slot);

    if (error) {
      console.error('Error unequipping accessory:', error);
      return NextResponse.json(
        { error: 'Failed to unequip accessory' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Accessory unequipped!' });
  } catch (error) {
    console.error('Error in pet accessories DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
