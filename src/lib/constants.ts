import { GhostColor } from './types';

export const GHOST_COLORS: Record<GhostColor, string> = {
  white: '#FFFFFF',
  cyan: '#00F0FF',
  green: '#00E090',
  yellow: '#FFF200',
  red: '#FF1A1A',
};

export const GHOST_OUTLINE = '#2B2137';
export const GHOST_HIGHLIGHT = '#D4C5F0';
export const GHOST_BLUSH = '#FFA2CF';

export const MAX_PLAYERS = 5;
export const MAX_NICKNAME_LENGTH = 7;
export const PIN_LENGTH = 4;
export const ROOM_CODE_LENGTH = 6;

export const EXP_PER_DAILY = 20;
export const EXP_PER_PARTY = 5;
export const EXP_BLOCKS = 10;

export const PARTY_QUEST_HOURS = [1, 7, 13, 19];
export const PARTY_QUEST_DURATION_MS = 2 * 60 * 60 * 1000;