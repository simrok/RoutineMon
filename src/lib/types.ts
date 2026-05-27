export type GhostColor = 'white' | 'cyan' | 'green' | 'yellow' | 'red';

export type MonStage = 'EGG' | 'BABY' | 'CHILD' | 'ADULT';

export type MonSpecies = 'cat' | 'panda' | 'unknown';

export interface Player {
  id: string;
  nickname: string;
  color: GhostColor;
  pin: string;
  contribution: number;
  routines: Routine[];
}

export interface Routine {
  id: string;
  emoji: string;
  name: string;
  photoUrl?: string;
  uploadedAt?: string;
}

export interface Mon {
  species: MonSpecies;
  stage: MonStage;
  level: number;
  exp: number;
  name: string;
}

export interface Room {
  code: string;
  maxPlayers: number;
  players: Player[];
  mon: Mon;
  dailyQuestProgress: number;
  partyQuest: PartyQuest | null;
}

export interface PartyQuest {
  active: boolean;
  mission: string;
  acceptedAt?: number;
  expiresAt?: number;
  completed: string[];
}