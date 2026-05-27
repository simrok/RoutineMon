'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StarryBackground from '@/components/StarryBackground';
import Logo from '@/components/Logo';
import PixelButton from '@/components/PixelButton';
import PixelInput from '@/components/PixelInput';
import { HomeButton } from '@/components/NavButtons';
import { PIN_LENGTH } from '@/lib/constants';

export default function PinCheckPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');

  const handleStart = () => {
    if (pin.length !== PIN_LENGTH) {
      alert(`PIN ${PIN_LENGTH}자리를 입력해주세요!`);
      return;
    }
    // TODO: 실제 PIN 검증 로직 (Firebase 연결 후)
    router.push('/room');
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center px-4 py-8">
      <StarryBackground />
      <HomeButton />

      <div className="mt-4 mb-6">
        <Logo size="small" />
      </div>

      <div
        className="w-full max-w-md p-6 border-2 border-cyan"
        style={{
          background: 'rgba(5, 4, 20, 0.92)',
          boxShadow: '4px 4px 0 #000',
        }}
      >
        <p className="font-pixel text-cyan text-xs mb-1">PIN</p>
        <p className="font-galmuri text-green text-[10px] mb-4">
          (등록한 {PIN_LENGTH}자리 PIN을 입력하세요)
        </p>

        <div className="flex flex-col items-center gap-4">
          <PixelInput
            value={pin}
            onChange={(v) => {
              if (/^\d*$/.test(v)) setPin(v);
            }}
            maxLength={PIN_LENGTH}
            type="password"
            className="text-center text-2xl tracking-widest w-40"
          />

          <PixelButton
            onClick={handleStart}
            color="blue"
            size="lg"
            disabled={pin.length !== PIN_LENGTH}
            glow={pin.length === PIN_LENGTH}
          >
            START
          </PixelButton>
        </div>
      </div>
    </main>
  );
}