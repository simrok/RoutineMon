import { create } from 'zustand'
import type { Player, Room } from '../types'

interface RoomStore {
  // 현재 방 정보
  room: Room | null
  // 현재 로그인한 플레이어
  myPlayer: Player | null
  // 방의 전체 플레이어 목록
  players: Player[]

  // 액션
  setRoom: (room: Room) => void
  setMyPlayer: (player: Player) => void
  setPlayers: (players: Player[]) => void
  reset: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  myPlayer: null,
  players: [],

  setRoom: (room) => set({ room }),
  setMyPlayer: (player) => set({ myPlayer: player }),
  setPlayers: (players) => set({ players }),
  reset: () => set({ room: null, myPlayer: null, players: [] }),
}))