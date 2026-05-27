import { EXP_BLOCKS } from '@/lib/constants';

interface ExpBarProps {
  exp: number; // 0~100
}

export default function ExpBar({ exp }: ExpBarProps) {
  const filledBlocks = Math.floor((exp / 100) * EXP_BLOCKS);

  return (
    <div
      className="flex gap-[2px] p-1 bg-white border-2 border-black"
      style={{ boxShadow: '2px 2px 0 #000' }}
    >
      {Array.from({ length: EXP_BLOCKS }).map((_, i) => (
        <div
          key={i}
          className="w-3 h-4"
          style={{
            background: i < filledBlocks ? '#BE56D9' : 'transparent',
            border: '1px solid #000',
          }}
        />
      ))}
    </div>
  );
}