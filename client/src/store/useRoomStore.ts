import { create } from 'zustand'
import type { Player, Room } from '../types'

// 슬롯별 디폴트 색상 (1=흰색, 2=초록, 3=파랑, 4=노랑, 5=빨강)
const DEFAULT_PLAYER_COLORS: { [slot: number]: string } = {
  1: 'white',
  2: 'green',
  3: 'blue',
  4: 'yellow',
  5: 'red',
}

interface RoomStore {
  // 현재 방 정보
  room: Room | null
  // 현재 로그인한 플레이어
  myPlayer: Player | null
  // 방의 전체 플레이어 목록
  players: Player[]
  // 슬롯별 캐릭터 색상 (사용자가 바꾸면 업데이트됨)
  playerColors: { [slot: number]: string }
  // 방 신설 중 임시 저장 (닉네임/PIN 설정 완료 전까지 DB에 방이 없는 상태)
  pendingMaxPlayers: number

  // 액션
  setRoom: (room: Room) => void
  setMyPlayer: (player: Player) => void
  setPlayers: (players: Player[]) => void
  setPlayerColor: (slot: number, color: string) => void
  setPendingMaxPlayers: (n: number) => void
  reset: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  myPlayer: null,
  players: [],
  playerColors: { ...DEFAULT_PLAYER_COLORS },
  pendingMaxPlayers: 5,

  setRoom: (room) => set({ room }),
  setMyPlayer: (player) => set({ myPlayer: player }),
  setPlayers: (players) => set({ players }),
  setPlayerColor: (slot, color) =>
    set((state) => ({
      playerColors: { ...state.playerColors, [slot]: color },
    })),
  setPendingMaxPlayers: (n) => set({ pendingMaxPlayers: n }),
  reset: () =>
    set({
      room: null,
      myPlayer: null,
      players: [],
      playerColors: { ...DEFAULT_PLAYER_COLORS },
      pendingMaxPlayers: 5,
    }),
}))
