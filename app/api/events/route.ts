import { getActiveEvents } from '@/app/utils/events/getActiveEvents'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const events = await getActiveEvents()
    return NextResponse.json({ events })
  } catch {
    return NextResponse.json({ events: [] })
  }
}