import { create } from 'zustand';
import { Room, Player, Routine, MonStage, GhostColor } from '@/lib/types';
import { MOCK_ROOM } from '@/lib/mock';

interface RoomStore {
  // 상태
  room: Room | null;
  currentPlayerId: string | null;

  // 액션 - 방
  initRoom: (room: Room) => void;
  setCurrentPlayer: (playerId: string) => void;

  // 액션 - 플레이어
  updatePlayerNickname: (playerId: string, nickname: string) => void;
  updatePlayerColor: (playerId: string, color: GhostColor) => void;
  updatePlayerRoutines: (playerId: string, routines: Routine[]) => void;

  // 액션 - 루틴몬
  addExp: (amount: number) => void;
  updateMonName: (name: string) => void;

  // 액션 - 사진 업로드
  uploadRoutinePhoto: (
    playerId: string,
    routineId: string,
    photoUrl: string
  ) => void;

  // 액션 - 퀘스트
  incrementDailyQuest: () => void;
  resetDailyQuest: () => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  // 초기값
  room: MOCK_ROOM,
  currentPlayerId: 'p1', // 임시: 첫 번째 플레이어가 본인

  initRoom: (room) => set({ room }),

  setCurrentPlayer: (playerId) => set({ currentPlayerId: playerId }),

  updatePlayerNickname: (playerId, nickname) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          players: state.room.players.map((p) =>
            p.id === playerId ? { ...p, nickname } : p
          ),
        },
      };
    }),

  updatePlayerColor: (playerId, color) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          players: state.room.players.map((p) =>
            p.id === playerId ? { ...p, color } : p
          ),
        },
      };
    }),

  updatePlayerRoutines: (playerId, routines) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          players: state.room.players.map((p) =>
            p.id === playerId ? { ...p, routines } : p
          ),
        },
      };
    }),

  addExp: (amount) =>
    set((state) => {
      if (!state.room) return state;
      let newExp = state.room.mon.exp + amount;
      let newLevel = state.room.mon.level;
      let newStage: MonStage = state.room.mon.stage;

      // 레벨업 처리
      if (newExp >= 100) {
        newExp = newExp - 100;
        newLevel += 1;

        // 단계 진화
        if (newLevel > 2) {
          newLevel = 1;
          const stageOrder: MonStage[] = ['EGG', 'BABY', 'CHILD', 'ADULT'];
          const currentIndex = stageOrder.indexOf(newStage);
          if (currentIndex < stageOrder.length - 1) {
            newStage = stageOrder[currentIndex + 1];
          } else {
            // ADULT 끝나면 다시 EGG로 (랜덤 부화)
            newStage = 'EGG';
          }
        }
      }

      return {
        room: {
          ...state.room,
          mon: {
            ...state.room.mon,
            exp: newExp,
            level: newLevel,
            stage: newStage,
          },
        },
      };
    }),

  updateMonName: (name) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          mon: { ...state.room.mon, name },
        },
      };
    }),

  uploadRoutinePhoto: (playerId, routineId, photoUrl) =>
    set((state) => {
      if (!state.room) return state;
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;

      return {
        room: {
          ...state.room,
          players: state.room.players.map((p) =>
            p.id === playerId
              ? {
                  ...p,
                  routines: p.routines.map((r) =>
                    r.id === routineId
                      ? { ...r, photoUrl, uploadedAt: timeStr }
                      : r
                  ),
                }
              : p
          ),
        },
      };
    }),

  incrementDailyQuest: () =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          dailyQuestProgress: state.room.dailyQuestProgress + 1,
        },
      };
    }),

  resetDailyQuest: () =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          dailyQuestProgress: 0,
        },
      };
    }),
}));