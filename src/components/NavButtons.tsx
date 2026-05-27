'use client';

import { useRouter } from 'next/navigation';

export function HomeButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        if (confirm('처음 시작 화면으로 나갈까요?')) {
          router.push('/');
        }
      }}
      className="absolute top-4 right-4 w-12 h-12 bg-btn-pink border-2 border-black flex items-center justify-center text-xl z-10"
      style={{ boxShadow: '4px 4px 0 #000' }}
      aria-label="홈"
    >
      🏠
    </button>
  );
}

export function BackButton({ to }: { to?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        if (to) {
          router.push(to);
        } else {
          router.back();
        }
      }}
      className="absolute top-4 left-4 w-12 h-12 bg-white border-2 border-black flex items-center justify-center font-pixel text-xl z-10"
      style={{ boxShadow: '4px 4px 0 #000' }}
      aria-label="뒤로"
    >
      ◀
    </button>
  );
}

export function HelpButton() {
  return (
    <button
      className="w-8 h-8 bg-yellow border-2 border-black flex items-center justify-center font-pixel text-sm rounded-full"
      style={{ boxShadow: '2px 2px 0 #000' }}
      aria-label="도움말"
    >
      ?
    </button>
  );
}

export function RightMenu() {
  const router = useRouter();
  const menus = [
    {
      icon: '🏠',
      color: 'bg-btn-pink',
      onClick: () => {
        if (confirm('처음 시작 화면으로 나갈까요?')) {
          router.push('/');
        }
      },
    },
    { icon: '📖', color: 'bg-btn-blue', onClick: () => router.push('/dex') },
    { icon: '👤', color: 'bg-btn-mint', onClick: () => router.push('/custom') },
    { icon: '⚙️', color: 'bg-yellow', onClick: () => alert('설정 (준비중)') },
  ];

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
      {menus.map((menu, i) => (
        <button
          key={i}
          onClick={menu.onClick}
          className={`w-12 h-12 ${menu.color} border-2 border-black flex items-center justify-center text-xl`}
          style={{ boxShadow: '4px 4px 0 #000' }}
        >
          {menu.icon}
        </button>
      ))}
    </div>
  );
}