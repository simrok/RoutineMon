'use client';

import { ReactNode } from 'react';
import clsx from 'clsx';

interface PixelButtonProps {
  children: ReactNode;
  onClick?: () => void;
  color?: 'mint' | 'blue' | 'pink' | 'lavender' | 'yellow';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  glow?: boolean;
}

export default function PixelButton({
  children,
  onClick,
  color = 'mint',
  size = 'md',
  disabled = false,
  glow = false,
}: PixelButtonProps) {
  const colorMap = {
    mint: 'bg-btn-mint',
    blue: 'bg-btn-blue',
    pink: 'bg-btn-pink',
    lavender: 'bg-btn-lavender',
    yellow: 'bg-yellow',
  };

  const sizeMap = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-5 py-2 text-sm',
    lg: 'px-8 py-3 text-base',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'font-pixel text-black border-2 border-black transition-all',
        'hover:scale-105 active:scale-95',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        colorMap[color],
        sizeMap[size],
        glow && 'shadow-[0_0_15px_rgba(142,232,216,0.8)]'
      )}
      style={{
        imageRendering: 'pixelated',
        boxShadow: glow
          ? '0 0 15px rgba(142, 232, 216, 0.8), 4px 4px 0 #000'
          : '4px 4px 0 #000',
      }}
    >
      {children}
    </button>
  );
}