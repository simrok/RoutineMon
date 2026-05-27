import { ReactNode } from 'react';

interface SpeechBubbleProps {
  children: ReactNode;
  color?: string;
}

export default function SpeechBubble({
  children,
  color = '#6D40FF',
}: SpeechBubbleProps) {
  return (
    <div className="relative inline-block">
      <div
        className="bg-white border-2 px-3 py-1 rounded-full font-pixel text-xs"
        style={{ borderColor: '#7FE7D8', color }}
      >
        {children}
      </div>
      {/* 꼬리 */}
      <div
        className="absolute -bottom-2 left-4 w-0 h-0"
        style={{
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '8px solid #7FE7D8',
        }}
      />
    </div>
  );
}