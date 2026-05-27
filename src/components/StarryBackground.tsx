import Image from 'next/image';

export default function StarryBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <Image
        src="/assets/backgroundImage/background.png"
        alt="background"
        fill
        style={{ objectFit: 'cover' }}
        priority
      />
    </div>
  );
}