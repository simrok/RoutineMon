import Image from 'next/image';
import { GhostColor } from '@/lib/types';

interface GhostSpriteProps {
  color: GhostColor;
  size?: number;
}

const GHOST_IMAGE_MAP: Record<GhostColor, string> = {
  white: '/assets/player/player_basic.png',
  cyan: '/assets/player/player_blue.png',
  green: '/assets/player/player_green.png',
  yellow: '/assets/player/player_yellow.png',
  red: '/assets/player/player_red.png',
};

export default function GhostSprite({ color, size = 60 }: GhostSpriteProps) {
  return (
    <Image
      src={GHOST_IMAGE_MAP[color]}
      alt={`ghost-${color}`}
      width={size}
      height={size}
      style={{
        imageRendering: 'pixelated',
        objectFit: 'contain',
      }}
      priority
    />
  );
}