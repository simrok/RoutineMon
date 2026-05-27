import Image from 'next/image';
import { MonStage } from '@/lib/types';

interface MonPlaceholderProps {
  stage: MonStage;
  species?: 'cat' | 'panda' | 'dino';
  size?: number;
}

export default function MonPlaceholder({
  stage,
  species = 'cat',
  size = 90,
}: MonPlaceholderProps) {
  // EGG는 무조건 egg.png
  if (stage === 'EGG') {
    return (
      <Image
        src="/assets/routinemon/egg.png"
        alt="egg"
        width={size}
        height={size}
        style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
        priority
      />
    );
  }

  // BABY/CHILD/ADULT → 종에 따라 다른 이미지
  const stageToNum: Record<MonStage, number> = {
    EGG: 1,
    BABY: 1,
    CHILD: 2,
    ADULT: 3,
  };
  const num = stageToNum[stage];

  return (
    <Image
      src={`/assets/routinemon/${species}/${species}${num}.png`}
      alt={`${species}-${stage}`}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
      priority
    />
  );
}