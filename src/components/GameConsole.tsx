import MonPlaceholder from './MonPlaceholder';
import { MonStage } from '@/lib/types';

interface GameConsoleProps {
  monStage: MonStage;
  monName: string;
}

export default function GameConsole({ monStage, monName }: GameConsoleProps) {
  return (
    <div className="relative">
      {/* 게임기 본체 */}
      <div
        className="p-4 border-[6px] border-mint rounded-xl"
        style={{
          background: '#1a1433',
          boxShadow: `
            0 0 0 8px #2B2137,
            0 0 0 10px #00F0FF,
            6px 6px 0 6px #000000,
            inset 0 0 30px rgba(0, 240, 255, 0.3)
          `,
        }}
      >
        {/* 화면 */}
        <div
          className="relative aspect-square rounded-lg overflow-hidden border-4 border-black mb-4"
          style={{
            background: '#F5A6D6',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <MonPlaceholder stage={monStage} size={110} />
          </div>

          {/* 화면 상단 빛 효과 */}
          <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white/30 to-transparent" />
          
          {/* CRT 스캔라인 효과 */}
          <div 
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              background: 'repeating-linear-gradient(transparent, transparent 4px, rgba(0,0,0,0.3) 4px, rgba(0,0,0,0.3) 6px)'
            }}
          />
        </div>

        {/* 컨트롤 버튼 */}
        <div className="flex justify-center gap-6">
          <div className="w-5 h-5 rounded-full bg-mint border-2 border-black shadow-inner" />
          <div className="w-5 h-5 rounded-full bg-mint border-2 border-black shadow-inner" />
          <div className="w-5 h-5 rounded-full bg-mint border-2 border-black shadow-inner" />
        </div>
      </div>

      {/* 루틴몬 이름 */}
      <p className="font-pixel text-cyan text-center mt-3 text-sm tracking-wider">
        {monName}
      </p>
    </div>
  );
}