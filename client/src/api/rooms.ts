import type { Room, Player } from '../types'

// 나중에 axios.post('http://localhost:4000/api/rooms') 로 교체
export const createRoom = async (roomName: string): Promise<{ roomCode: string }> => {
  console.log('createRoom:', roomName)
  return { roomCode: '123456' }
}

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
  }
}

// 나중에 axios.post(`http://localhost:4000/api/rooms/${roomCode}/players`) 로 교체
export const joinRoom = async (
  roomCode: string,
  nickname: string,
  characterType: string
): Promise<{ player: Player; pinCode: string }> => {
  console.log('joinRoom:', roomCode, nickname, characterType)
  return {
    player: {
      playerId: 1,
      roomId: 1,
      slotNumber: 1,
      nickname,
      characterType,
    },
    pinCode: '1234',
  }
}

// 나중에 axios.post(`http://localhost:4000/api/rooms/${roomCode}/players/${slotNumber}/verify`) 로 교체
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