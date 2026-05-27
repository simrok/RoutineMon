'use client';

import { useState } from 'react';
import StarryBackground from '@/components/StarryBackground';
import Logo from '@/components/Logo';
import { HomeButton, BackButton, HelpButton } from '@/components/NavButtons';
import GhostSprite from '@/components/GhostSprite';
import UploadFrame from '@/components/UploadFrame';
import { useRoomStore } from '@/stores/useRoomStore';
import { GHOST_COLORS, MAX_PLAYERS, EXP_PER_DAILY } from '@/lib/constants';
import clsx from 'clsx';

type TabType = 'CREATE LOG' | 'DAILY' | 'PARTY';

export default function UploadPage() {
  const { room, currentPlayerId, uploadRoutinePhoto, addExp, incrementDailyQuest } =
    useRoomStore();
  const [activeTab, setActiveTab] = useState<TabType>('DAILY');

  if (!room) return null;

  const tabs: { name: TabType; color: string }[] = [
    { name: 'CREATE LOG', color: 'bg-btn-mint' },
    { name: 'DAILY', color: 'bg-btn-blue' },
    { name: 'PARTY', color: 'bg-btn-lavender' },
  ];

  const handleUpload = (playerId: string, file: File) => {
    const photoUrl = URL.createObjectURL(file);
    const player = room.players.find((p) => p.id === playerId);
    const firstEmptyRoutine = player?.routines.find((r) => !r.photoUrl);

    if (firstEmptyRoutine) {
      uploadRoutinePhoto(playerId, firstEmptyRoutine.id, photoUrl);

      // 2장 업로드 체크 (간단 버전: 무조건 진행도 + EXP)
      const uploadedCount = (player?.routines.filter((r) => r.photoUrl).length || 0) + 1;
      if (uploadedCount === 2) {
        incrementDailyQuest();
        addExp(EXP_PER_DAILY);
        alert(`일일 퀘스트 진행! +EXP ${EXP_PER_DAILY}%`);
      } else {
        alert(`${file.name} 업로드 완료! (${uploadedCount}/2)`);
      }
    } else {
      alert('모든 루틴 슬롯이 채워졌어요!');
    }
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center px-4 py-4">
      <StarryBackground />
      <BackButton to="/room" />
      <HomeButton />

      <div className="mt-2 mb-4 flex items-center gap-2">
        <Logo size="small" />
        <HelpButton />
      </div>

      <div className="w-full max-w-md flex gap-1 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={clsx(
              'flex-1 font-pixel text-[10px] py-2 border-2 border-black transition-all',
              activeTab === tab.name ? `${tab.color} text-black` : 'bg-gray-600 text-gray-300'
            )}
            style={{ boxShadow: '2px 2px 0 #000' }}
          >
            {tab.name}
          </button>
        ))}
      </div>

      <div className="w-full max-w-md flex justify-center gap-2 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={clsx(
              'w-4 h-4 rounded-full border-2 border-black',
              i === 0 && 'bg-pink',
              i === 1 && 'bg-purple',
              i > 1 && 'bg-white'
            )}
          />
        ))}
      </div>

      <div
        className="w-full max-w-md p-3 border-2 border-black"
        style={{
          background: 'rgba(5, 4, 20, 0.92)',
          boxShadow: '4px 4px 0 #000',
        }}
      >
        <div className="flex flex-col gap-3">
          {Array.from({ length: MAX_PLAYERS }).map((_, i) => {
            const player = room.players[i];
            const isMe = player?.id === currentPlayerId;

            if (!player) {
              return (
                <div key={i} className="flex items-center gap-2 opacity-30">
                  <div className="w-12 h-12 border-2 border-gray-500 flex items-center justify-center">
                    <span className="text-xl">+</span>
                  </div>
                  <span className="font-galmuri text-xs text-gray-500">빈 슬롯</span>
                </div>
              );
            }

            const uploadedRoutine = player.routines.find((r) => r.photoUrl);

            return (
              <div key={i} className="flex items-center gap-2">
                <div className="flex flex-col items-center w-14">
                  <GhostSprite color={player.color} size={40} />
                  <p
                    className="font-galmuri text-[10px] mt-1 truncate w-full text-center"
                    style={{ color: GHOST_COLORS[player.color] || '#fff' }}
                  >
                    {player.nickname}
                  </p>
                </div>

                <div className="bg-white border-2 border-mint px-2 py-1 rounded-full font-pixel text-[10px] text-purple">
                  Zzz
                </div>

                <div className="ml-auto">
                  <UploadFrame
                    color={player.color}
                    disabled={activeTab === 'PARTY'}
                    isMe={isMe}
                    photoUrl={uploadedRoutine?.photoUrl}
                    uploadedAt={uploadedRoutine?.uploadedAt}
                    onUpload={(file) => handleUpload(player.id, file)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="font-galmuri text-white text-[10px] mt-3 opacity-70 text-center">
        본인 프레임에만 사진을 업로드할 수 있어요
      </p>
    </main>
  );
}