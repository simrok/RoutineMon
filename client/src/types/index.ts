// 방
export interface Room {
  roomId: number;
  roomCode: string;
  roomName: string;
  maxPlayers: number;
  currentPlayers: number;
  createdAt: string;
}

// 플레이어
export interface Player {
  playerId: number;
  roomId: number;
  slotNumber: number;
  nickname: string;
  characterType: string;
}

// 루틴
export interface Routine {
  routineId: number;
  playerId: number;
  content: string;
  orderIndex: number;
}

// 오늘 업로드 현황
export interface DailyUpload {
  uploadId: number;
  playerId: number;
  nickname: string;
  routineId: number;
  routineContent: string;
  imageUrl: string;
  uploadedAt: string;
}

// 파티 퀘스트
export interface PartyQuest {
  partyQuestId: number;
  title: string;
  description: string;
  targetCount: number;
  currentCount: number;
  status: 'active' | 'completed' | 'failed';
  expiresAt: string;
}

// 몬
export interface Mon {
  monId: number;
  monName: string;
  stage: number;
  currentExp: number;
  maxExp: number;
  imageUrl: string;
}

// 기여도 랭킹
export interface RankingEntry {
  playerId: number;
  nickname: string;
  characterType: string;
  contributionCount: number;
  rank: number;
}