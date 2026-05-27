import { Room } from './types';

export const MOCK_ROOM: Room = {
  code: 'ABC123',
  maxPlayers: 5,
  players: [
    {
      id: 'p1',
      nickname: '서영',
      color: 'cyan',
      pin: '1234',
      contribution: 80,
      routines: [
        { id: 'r1', emoji: '🏃', name: '운동' },
        { id: 'r2', emoji: '📚', name: '독서' },
        { id: 'r3', emoji: '💧', name: '물 마시기' },
        { id: 'r4', emoji: '🧘', name: '명상' },
      ],
    },
    {
      id: 'p2',
      nickname: '민지',
      color: 'pink' as any,
      pin: '0000',
      contribution: 60,
      routines: [],
    },
    {
      id: 'p3',
      nickname: '지훈',
      color: 'green',
      pin: '0000',
      contribution: 40,
      routines: [],
    },
  ],
  mon: {
    species: 'unknown',
    stage: 'EGG',
    level: 1,
    exp: 30,
    name: '루몬',
  },
  dailyQuestProgress: 1,
  partyQuest: null,
};