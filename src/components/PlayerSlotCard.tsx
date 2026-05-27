import GhostSprite from './GhostSprite';
import { GhostColor } from '@/lib/types';

interface PlayerSlotCardProps {
  player?: {
    nickname: string;
    color: GhostColor;
    contribution: number;
  };
  rank?: 1 | 2 | 3;
  isMe?: boolean;
}

export default function PlayerSlotCard({
  player,
  rank,
  isMe,
}: PlayerSlotCardProps) {
  // 빈 슬롯
  if (!player) {
    return (
      <div
        className="w-16 h-24 border-2 border-black flex flex-col items-center justify-center"
        style={{
          background: 'rgba(224, 209, 255, 0.6)',
          boxShadow: '2px 2px 0 #000',
        }}
      >
        <span className="font-pixel text-2xl text-black opacity-50">+</span>
      </div>
    );
  }

  const rankLabel = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : null;

  return (
    <div className="flex flex-col items-center">
      {/* 카드 */}
      <div
        className="w-16 h-20 border-2 border-black flex flex-col items-center justify-center relative"
        style={{
          background: isMe ? '#7FE7D8' : 'rgba(224, 209, 255, 0.92)',
          boxShadow: '2px 2px 0 #000',
        }}
      >
        {rankLabel && (
          <span className="absolute -top-2 -right-1 font-pixel text-[8px] bg-yellow border border-black px-1">
            {rankLabel}
          </span>
        )}
        <GhostSprite color={player.color} size={40} />
      </div>
      {/* 닉네임 */}
      <div
        className="w-16 mt-1 bg-white border-2 border-black px-1 py-[2px] text-center"
        style={{ boxShadow: '2px 2px 0 #000' }}
      >
        <p className="font-galmuri text-black text-[10px] truncate">
          {player.nickname}
        </p>
      </div>
    </div>
  );
}