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

interface PendingPlayer {
  nickname: string
  pin: string
  slotNumber: number
}

interface RoomStore {
  // 현재 방 정보
  room: Room | null
  // 현재 로그인한 플레이어
  myPlayer: Player | null
  // 로그인 시 입력한 PIN (CharacterCustomPage에서 재사용)
  myPin: string | null
  // 방의 전체 플레이어 목록
  players: Player[]
  // 슬롯별 캐릭터 색상 (사용자가 바꾸면 업데이트됨)
  playerColors: { [slot: number]: string }
  // 방 신설 중 임시 저장
  pendingMaxPlayers: number
  // 닉네임/PIN 임시 저장 (루틴 설정 완료 시 DB에 한 번에 저장)
  pendingPlayer: PendingPlayer | null

  // 액션
  setRoom: (room: Room) => void
  setMyPlayer: (player: Player) => void
  setMyPin: (pin: string | null) => void
  setPlayers: (players: Player[]) => void
  setPlayerColor: (slot: number, color: string) => void
  setPendingMaxPlayers: (n: number) => void
  setPendingPlayer: (p: PendingPlayer | null) => void
  reset: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  myPlayer: null,
  myPin: null,
  players: [],
  playerColors: { ...DEFAULT_PLAYER_COLORS },
  pendingMaxPlayers: 5,
  pendingPlayer: null,

  setRoom: (room) => set({ room }),
  setMyPlayer: (player) => set({ myPlayer: player }),
  setMyPin: (pin) => set({ myPin: pin }),
  setPlayers: (players) => set({ players }),
  setPlayerColor: (slot, color) =>
    set((state) => ({
      playerColors: { ...state.playerColors, [slot]: color },
    })),
  setPendingMaxPlayers: (n) => set({ pendingMaxPlayers: n }),
  setPendingPlayer: (p) => set({ pendingPlayer: p }),
  reset: () =>
    set({
      room: null,
      myPlayer: null,
      myPin: null,
      players: [],
      playerColors: { ...DEFAULT_PLAYER_COLORS },
      pendingMaxPlayers: 5,
      pendingPlayer: null,
    }),
}))
