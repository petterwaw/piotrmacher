import { createServerSupabaseClient } from '@/app/utils/supabase/server'
import { createServiceRoleSupabaseClient } from '@/app/utils/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

function validateUsername(username: string) {
  return /^[a-zA-Z0-9_.]{3,24}$/.test(username)
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, created_at')
      .eq('id', user.id)
      .maybeSingle()

    return NextResponse.json({
      profile: {
        id: user.id,
        email: user.email ?? '',
        username: profile?.username ?? user.user_metadata?.username ?? 'User',
        createdAt: profile?.created_at ?? user.created_at,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Could not load profile.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as { username?: string } | null
    const username = body?.username?.trim() ?? ''

    if (!validateUsername(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-24 chars: letters, numbers, _ or .' },
        { status: 400 }
      )
    }

    const serviceSupabase = createServiceRoleSupabaseClient()
    const { data: existing } = await serviceSupabase
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .neq('id', user.id)
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      return NextResponse.json({ error: 'Username already exists.' }, { status: 409 })
    }

    const { error: profileUpdateError } = await serviceSupabase
      .from('profiles')
      .update({ username })
      .eq('id', user.id)

    if (profileUpdateError) {
      return NextResponse.json({ error: 'Could not update profile username.' }, { status: 500 })
    }

    const { error: metadataUpdateError } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        username,
      },
    })

    if (metadataUpdateError) {
      return NextResponse.json({ error: 'Could not sync auth username.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, username })
  } catch {
    return NextResponse.json({ error: 'Could not update profile.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as { confirm?: string } | null
    if (body?.confirm !== 'DELETE') {
      return NextResponse.json({ error: 'Type DELETE to confirm account removal.' }, { status: 400 })
    }

    const serviceSupabase = createServiceRoleSupabaseClient()

    const { data: hostedRooms } = await serviceSupabase
      .from('rooms')
      .select('id')
      .eq('host_id', user.id)

    const hostedRoomIds = (hostedRooms ?? []).map((room) => room.id)

    if (hostedRoomIds.length > 0) {
      await serviceSupabase.from('bets').delete().in('room_id', hostedRoomIds)
      await serviceSupabase.from('room_players').delete().in('room_id', hostedRoomIds)
      await serviceSupabase.from('rooms').delete().in('id', hostedRoomIds)
    }

    await serviceSupabase.from('bets').delete().eq('user_id', user.id)
    await serviceSupabase.from('room_players').delete().eq('user_id', user.id)
    await serviceSupabase.from('profiles').delete().eq('id', user.id)

    const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(user.id)

    if (deleteError) {
      return NextResponse.json({ error: 'Could not delete account.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not delete account.' }, { status: 500 })
  }
}
