'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StarryBackground from '@/components/StarryBackground';
import Logo from '@/components/Logo';
import PixelButton from '@/components/PixelButton';
import PixelInput from '@/components/PixelInput';
import GhostSprite from '@/components/GhostSprite';
import { BackButton, HomeButton } from '@/components/NavButtons';
import { GHOST_COLORS } from '@/lib/constants';
import { GhostColor, Routine } from '@/lib/types';
import { useRoomStore } from '@/stores/useRoomStore';

const ROUTINE_EMOJIS = ['🏃', '📚', '💧', '🍎', '🧘', '🎨', '📝', '🌅'];

export default function CustomPage() {
  const router = useRouter();
  const { room, currentPlayerId, updatePlayerNickname, updatePlayerColor, updatePlayerRoutines } =
    useRoomStore();

  const currentPlayer = room?.players.find((p) => p.id === currentPlayerId);

  const [nickname, setNickname] = useState('');
  const [selectedColor, setSelectedColor] = useState<GhostColor>('cyan');
  const [routines, setRoutines] = useState<Routine[]>([]);

  useEffect(() => {
    if (currentPlayer) {
      setNickname(currentPlayer.nickname);
      setSelectedColor(currentPlayer.color);
      const filled = [...currentPlayer.routines];
      while (filled.length < 4) {
        filled.push({
          id: `r${filled.length + 1}`,
          emoji: '',
          name: '',
        });
      }
      setRoutines(filled);
    }
  }, [currentPlayer]);

  const handleSave = () => {
    if (!currentPlayerId) return;
    updatePlayerNickname(currentPlayerId, nickname);
    updatePlayerColor(currentPlayerId, selectedColor);
    updatePlayerRoutines(currentPlayerId, routines);
    alert('저장되었습니다! 🎉');
    router.push('/room');
  };

  const updateRoutine = (index: number, emoji: string, name: string) => {
    const newRoutines = [...routines];
    newRoutines[index] = { ...newRoutines[index], emoji, name };
    setRoutines(newRoutines);
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center px-4 py-4">
      <StarryBackground />
      <BackButton to="/room" />
      <HomeButton />

      <div className="mt-2 mb-6">
        <Logo size="small" />
      </div>

      <div
        className="w-full max-w-md p-6 border-2 border-black"
        style={{
          background: 'rgba(5, 4, 20, 0.92)',
          boxShadow: '4px 4px 0 #000',
        }}
      >
        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 border-4 border-black rounded-xl">
            <GhostSprite color={selectedColor} size={110} />
          </div>
        </div>

        <div className="mb-6">
          <p className="font-pixel text-cyan text-xs mb-2">NICKNAME (최대 7글자)</p>
          <PixelInput
            value={nickname}
            onChange={setNickname}
            maxLength={7}
            className="w-full text-center"
          />
        </div>

        <div className="mb-6">
          <p className="font-pixel text-cyan text-xs mb-3">COLOR</p>
          <div className="flex gap-3 justify-center">
            {(['white', 'cyan', 'green', 'yellow', 'red'] as GhostColor[]).map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-10 h-10 rounded-full border-2 border-black transition-all ${
                  selectedColor === color ? 'scale-110 ring-4 ring-white' : ''
                }`}
                style={{ backgroundColor: GHOST_COLORS[color] }}
              />
            ))}
          </div>
        </div>

        <div className="mb-6">
          <p className="font-pixel text-cyan text-xs mb-3">ROUTINE 01 ~ 04</p>
          {routines.map((routine, index) => (
            <div key={index} className="flex items-center gap-3 mb-3">
              <button
                onClick={() => {
                  const emoji = ROUTINE_EMOJIS[Math.floor(Math.random() * ROUTINE_EMOJIS.length)];
                  updateRoutine(index, emoji, routine.name);
                }}
                className="w-10 h-10 bg-purple border-2 border-black flex items-center justify-center text-xl"
                style={{ boxShadow: '2px 2px 0 #000' }}
              >
                {routine.emoji || '?'}
              </button>
              <PixelInput
                value={routine.name}
                onChange={(name) => updateRoutine(index, routine.emoji, name)}
                className="flex-1"
                placeholder="루틴 이름"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-4">
          <PixelButton onClick={handleSave} color="blue" size="lg" glow>
            SAVE
          </PixelButton>
        </div>
      </div>
    </main>
  );
}