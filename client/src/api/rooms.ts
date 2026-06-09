import type { Room, Player } from '../types'

// [방 신설] POST /api/rooms
// 나중에 axios.post('http://localhost:4000/api/rooms', { maxPlayers }) 로 교체
export const createRoom = async (maxPlayers: number): Promise<{ roomCode: string }> => {
  console.log('createRoom:', maxPlayers)
  return { roomCode: '123456' }
}

// [방 참가 전 유효성 확인] GET /api/rooms/:roomCode
// 나중에 axios.get(`http://localhost:4000/api/rooms/${roomCode}`) 로 교체
export const getRoom = async (roomCode: string): Promise<Room> => {
  console.log('getRoom:', roomCode)
  return {
    roomId: 1,
    roomCode,
    roomName: '루틴몬 테스트 방',
    maxPlayers: 5,
    currentPlayers: 2,
    createdAt: new Date().toISOString(),
    players: [
      { slotNumber: 1, nickname: '서영', hasPin: true },
      { slotNumber: 3, nickname: '민지', hasPin: true },
    ],
  }
}

// [플레이어 등록] POST /api/rooms/:roomCode/players
// 나중에 axios.post(`http://localhost:4000/api/rooms/${roomCode}/players`, { slotNumber, nickname, pin }) 로 교체
export const registerPlayer = async (
  roomCode: string,
  slotNumber: number,
  nickname: string,
  pin: string,
): Promise<{ player: Player }> => {
  console.log('registerPlayer:', roomCode, slotNumber, nickname)
  return {
    player: {
      playerId: 1,
      roomId: 1,
      slotNumber,
      nickname,
      characterType: 'rabbit',
    },
  }
}

// [PIN 인증 - 재입장] POST /api/rooms/:roomCode/players/:slotNumber/verify
// 나중에 axios.post(`http://localhost:4000/api/rooms/${roomCode}/players/${slotNumber}/verify`, { pin }) 로 교체
export const verifyPin = async (
  roomCode: string,
  slotNumber: number,
  pin: string
): Promise<{ player: Player }> => {
  console.log('verifyPin:', roomCode, slotNumber, pin)
  return {
    player: {
      playerId: 1,
      roomId: 1,
      slotNumber,
      nickname: '테스트유저',
      characterType: 'rabbit',
    },
  }
}
