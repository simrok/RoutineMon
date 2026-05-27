'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StarryBackground from '@/components/StarryBackground';
import Logo from '@/components/Logo';
import PixelButton from '@/components/PixelButton';
import PixelInput from '@/components/PixelInput';
import { HomeButton } from '@/components/NavButtons';
import { MAX_NICKNAME_LENGTH, PIN_LENGTH } from '@/lib/constants';

export default function SetupPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [nicknameOk, setNicknameOk] = useState<null | boolean>(null);
  const [pin, setPin] = useState('');
  const [pinOk, setPinOk] = useState<null | boolean>(null);

  const handleNicknameConfirm = () => {
    if (nickname.trim().length === 0) {
      setNicknameOk(false);
      return;
    }
    if (nickname.length > MAX_NICKNAME_LENGTH) {
      setNicknameOk(false);
      return;
    }
    setNicknameOk(true);
  };

  const handlePinConfirm = () => {
    if (pin.length !== PIN_LENGTH || !/^\d+$/.test(pin)) {
      setPinOk(false);
      return;
    }
    setPinOk(true);
  };

  const canStart = nicknameOk === true && pinOk === true;

  const handleStart = () => {
    if (!canStart) return;
    router.push('/room');
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center px-4 py-8">
      <StarryBackground />
      <HomeButton />

      <div className="mt-4 mb-6">
        <Logo size="small" />
      </div>

      {/* 검정 패널 */}
      <div
        className="w-full max-w-md p-6 border-2 border-cyan"
        style={{
          background: 'rgba(5, 4, 20, 0.92)',
          boxShadow: '4px 4px 0 #000',
        }}
      >
        {/* 닉네임 */}
        <div className="mb-6">
          <p className="font-pixel text-cyan text-xs mb-1">NICKNAME</p>
          <p className="font-galmuri text-green text-[10px] mb-2">
            (최대 {MAX_NICKNAME_LENGTH}글자)
          </p>
          <div className="flex gap-2 items-center">
            <PixelInput
              value={nickname}
              onChange={(v) => {
                setNickname(v);
                setNicknameOk(null);
              }}
              maxLength={MAX_NICKNAME_LENGTH}
              className="flex-1"
            />
            <PixelButton
              onClick={handleNicknameConfirm}
              color="mint"
              size="sm"
            >
              CONFIRM
            </PixelButton>
            {nicknameOk === true && (
              <span className="font-pixel text-yellow text-xs">ok</span>
            )}
            {nicknameOk === false && (
              <span className="font-pixel text-red text-xs">fail</span>
            )}
          </div>
        </div>

        {/* PIN */}
        <div className="mb-6">
          <p className="font-pixel text-cyan text-xs mb-1">PIN</p>
          <p className="font-galmuri text-green text-[10px] mb-2">
            (숫자 {PIN_LENGTH}자리)
          </p>
          <div className="flex gap-2 items-center">
            <PixelInput
              value={pin}
              onChange={(v) => {
                if (/^\d*$/.test(v)) {
                  setPin(v);
                  setPinOk(null);
                }
              }}
              maxLength={PIN_LENGTH}
              type="password"
              className="flex-1"
            />
            <PixelButton onClick={handlePinConfirm} color="mint" size="sm">
              CONFIRM
            </PixelButton>
            {pinOk === true && (
              <span className="font-pixel text-yellow text-xs">ok</span>
            )}
            {pinOk === false && (
              <span className="font-pixel text-red text-xs">fail</span>
            )}
          </div>
        </div>

        {/* START 버튼 */}
        <div className="flex justify-center mt-4">
          <PixelButton
            onClick={handleStart}
            color="blue"
            size="lg"
            disabled={!canStart}
            glow={canStart}
          >
            START
          </PixelButton>
        </div>
      </div>
    </main>
  );
}