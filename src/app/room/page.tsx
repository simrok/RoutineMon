'use client';

import { useRouter } from 'next/navigation';
import StarryBackground from '@/components/StarryBackground';
import Logo from '@/components/Logo';
import PixelButton from '@/components/PixelButton';
import { RightMenu, HelpButton } from '@/components/NavButtons';
import GameConsole from '@/components/GameConsole';
import ExpBar from '@/components/ExpBar';
import PlayerSlotCard from '@/components/PlayerSlotCard';
import QuestStars from '@/components/QuestStars';
import { useRoomStore } from '@/stores/useRoomStore';
import { MAX_PLAYERS } from '@/lib/constants';

export default function RoomPage() {
  const router = useRouter();
  const { room, currentPlayerId } = useRoomStore();

  if (!room) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <StarryBackground />
        <p className="font-pixel text-white">로딩 중...</p>
      </main>
    );
  }

  // 기여도 기준 정렬
  const sortedPlayers = [...room.players].sort(
    (a, b) => b.contribution - a.contribution
  );
  const getRank = (playerId: string): 1 | 2 | 3 | undefined => {
    const index = sortedPlayers.findIndex((p) => p.id === playerId);
    if (index === 0) return 1;
    if (index === 1) return 2;
    if (index === 2) return 3;
    return undefined;
  };

  const handleStart = () => {
    router.push('/upload');
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center px-4 py-4 pr-20">
      <StarryBackground />
      <RightMenu />

      <div className="mt-2 mb-4">
        <Logo size="small" />
      </div>

      <div className="w-full max-w-md flex gap-4 mb-6">
        <div className="flex-1">
          <GameConsole monStage={room.mon.stage} monName={room.mon.name} />
        </div>

        <div className="flex flex-col gap-3 pt-6">
          <div className="flex items-center gap-2">
            <div className="bg-white border-[3px] border-mint px-5 py-3 rounded-3xl font-pixel text-xl text-purple shadow-[4px_4px_0_#000]">
              Zz
            </div>
            <HelpButton />
          </div>

          <div
            className="border-2 border-black px-4 py-3 rounded-xl"
            style={{ background: 'rgba(126,99,191,0.85)' }}
          >
            <p className="font-pixel text-yellow text-sm mb-1">
              LV. {room.mon.level}
            </p>
            <p className="font-pixel text-yellow text-sm">
              STEP. {room.mon.stage}
            </p>
          </div>

          <div>
            <ExpBar exp={room.mon.exp} />
            <p className="font-pixel text-[10px] text-white mt-1">
              EXP {room.mon.exp}%
            </p>
          </div>
        </div>
      </div>

      <div
        className="w-full max-w-md p-3 mb-4 border-2 border-black"
        style={{
          background: 'rgba(126,99,191,0.72)',
          boxShadow: '4px 4px 0 #000',
        }}
      >
        <p className="font-pixel text-white text-xs mb-2 text-center">PLAYERS</p>
        <div className="flex justify-center gap-2 flex-wrap">
          {Array.from({ length: MAX_PLAYERS }).map((_, i) => {
            const player = room.players[i];
            const isMe = player?.id === currentPlayerId;
            return (
              <PlayerSlotCard
                key={i}
                player={player}
                rank={player ? getRank(player.id) : undefined}
                isMe={isMe}
              />
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <PixelButton onClick={handleStart} color="lavender" size="lg" glow>
          START
        </PixelButton>
      </div>

      <div
        className="w-full max-w-md p-3 mb-4 border-2 border-black"
        style={{
          background: 'rgba(126,99,191,0.72)',
          boxShadow: '4px 4px 0 #000',
        }}
      >
        <p className="font-galmuri text-white text-xs mb-2 text-center">
          🌟 일일 퀘스트 진행도
        </p>
        <div className="flex justify-center">
          <QuestStars
            total={room.players.length}
            completed={room.dailyQuestProgress}
          />
        </div>
      </div>

      <div
        className="w-full max-w-md p-3 border-2 border-black"
        style={{
          background: 'rgba(5, 4, 20, 0.92)',
          boxShadow: '4px 4px 0 #000',
        }}
      >
        <p className="font-galmuri text-gray-400 text-xs text-center">
          현재 파티 퀘스트가 활성화되지 않았습니다
        </p>
      </div>
    </main>
  );
}