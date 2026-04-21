export type CreateRoomPayload = {
  name: string
  eventId?: string
}

export async function createRoom(payload: CreateRoomPayload) {
  const response = await fetch('/api/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return response
}