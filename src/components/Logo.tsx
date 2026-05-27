import Image from 'next/image';

interface LogoProps {
  size?: 'small' | 'large';
}

export default function Logo({ size = 'large' }: LogoProps) {
  const imgWidth = size === 'large' ? 280 : 180;
  const imgHeight = size === 'large' ? 90 : 60;

  return (
    <div className="text-center flex flex-col items-center">
      <Image
        src="/assets/logo/1.png"
        alt="RoutineMon"
        width={imgWidth}
        height={imgHeight}
        style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
        priority
      />
      <p className={`font-galmuri ${size === 'large' ? 'text-sm' : 'text-[10px]'} text-white mt-1 opacity-80`}>
        같이 루틴 키울래? 루틴몬
      </p>
    </div>
  );
}