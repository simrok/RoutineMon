'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StarryBackground from '@/components/StarryBackground';
import Logo from '@/components/Logo';
import PixelButton from '@/components/PixelButton';
import PixelInput from '@/components/PixelInput';
import GhostSprite from '@/components/GhostSprite';
import SpeechBubble from '@/components/SpeechBubble';

export default function HomePage() {
  const router = useRouter();
  const [selectedPlayers, setSelectedPlayers] = useState<number>(0);
  const [roomCode, setRoomCode] = useState('');

  const handleCreateRoom = () => {
    if (selectedPlayers === 0) {
      alert('인원수를 선택해주세요!');
      return;
    }
    router.push('/setup');
  };

  const handleJoinRoom = () => {
    if (roomCode.length < 6) {
      alert('방 코드 6자리를 입력해주세요!');
      return;
    }
    router.push('/pin-check');
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center px-4 py-8">
      <StarryBackground />

      {/* 홈 버튼 (우상단) */}
      <button
        className="absolute top-4 right-4 w-12 h-12 bg-btn-pink border-2 border-black flex items-center justify-center font-pixel text-xl"
        style={{ boxShadow: '4px 4px 0 #000' }}
      >
        🏠
      </button>

      {/* 로고 */}
      <div className="mt-8 mb-6">
        <Logo size="large" />
      </div>

      {/* 안내 박스 */}
      <div
        className="w-full max-w-md p-4 mb-6 border-2 border-black"
        style={{
          background: 'rgba(224, 209, 255, 0.92)',
          boxShadow: '4px 4px 0 #000',
        }}
      >
        <p className="font-galmuri text-black text-sm text-center mb-3">
          친구들과 함께 루틴을 만들고<br />
          루틴몬을 키워보세요!
        </p>
        <div className="flex justify-center items-end gap-2">
          <div className="flex flex-col items-center">
            <SpeechBubble color="#6D40FF">안녕!</SpeechBubble>
            <div className="mt-1">
              <GhostSprite color="cyan" size={50} />
            </div>
          </div>
          <GhostSprite color="yellow" size={50} />
          <GhostSprite color="green" size={50} />
        </div>
      </div>

      {/* Select Players */}
      <div
        className="w-full max-w-md p-4 mb-4 border-2 border-black"
        style={{
          background: 'rgba(224, 209, 255, 0.92)',
          boxShadow: '4px 4px 0 #000',
        }}
      >
        <p className="font-pixel text-black text-xs mb-3 text-center">
          SELECT PLAYERS
        </p>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((num) => (
            <button
              key={num}
              onClick={() => setSelectedPlayers(num)}
              className={`
                w-10 h-10 font-pixel text-sm border-2 border-black
                ${selectedPlayers === num ? 'bg-cyan' : 'bg-white'}
                hover:scale-105 transition-transform
              `}
              style={{ boxShadow: '2px 2px 0 #000' }}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* CREATE ROOM 버튼 */}
      <div className="mb-8">
        <PixelButton onClick={handleCreateRoom} color="lavender" size="lg">
          CREATE ROOM
        </PixelButton>
      </div>

      {/* 방 코드 입력 */}
      <div className="w-full max-w-md flex flex-col items-center gap-3">
        <p className="font-galmuri text-cyan text-sm">
          방 코드를 입력하세요
        </p>
        <PixelInput
          value={roomCode}
          onChange={(v) => setRoomCode(v.toUpperCase())}
          placeholder="ABC123"
          maxLength={6}
          className="w-48 text-lg tracking-widest"
        />
        <PixelButton onClick={handleJoinRoom} color="blue" size="lg">
          START
        </PixelButton>
      </div>
    </main>
  );
}