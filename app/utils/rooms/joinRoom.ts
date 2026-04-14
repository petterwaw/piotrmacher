export type JoinRoomPayload = {
  code: string
}

export async function joinRoom(payload: JoinRoomPayload) {
  const response = await fetch('/api/rooms/join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return response
}
