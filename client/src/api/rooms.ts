import { API_BASE as BASE_URL } from '../config'

// [방 생성] POST /api/rooms
export const createRoom = async (maxPlayers: number): Promise<{ roomCode: string; roomId: number }> => {
  const res = await fetch(`${BASE_URL}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxPlayers }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return { roomCode: json.data.roomCode, roomId: json.data.roomId }
}

// [방 정보 조회] GET /api/rooms/:roomCode
export const getRoom = async (roomCode: string) => {
  const res = await fetch(`${BASE_URL}/rooms/${roomCode}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data
}

// [플레이어 등록] POST /api/rooms/:roomCode/players
export const registerPlayer = async (
  roomCode: string,
  slotNumber: number,
  nickname: string,
  pin: string,
) => {
  const res = await fetch(`${BASE_URL}/rooms/${roomCode}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slotNumber, nickname, pin }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return { player: json.data } // { playerId, slotNumber, nickname }
}

// [PIN 인증 - 재입장] POST /api/rooms/:roomCode/players/:slotNumber/verify
export const verifyPin = async (
  roomCode: string,
  slotNumber: number,
  pin: string,
) => {
  const res = await fetch(`${BASE_URL}/rooms/${roomCode}/players/${slotNumber}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return { player: json.data }
}
