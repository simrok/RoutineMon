'use client';

import { useState } from 'react';
import StarryBackground from '@/components/StarryBackground';
import Logo from '@/components/Logo';
import { BackButton, HomeButton } from '@/components/NavButtons';
import clsx from 'clsx';

type DexCategory = 'land' | 'sea' | 'rare';

interface DexEntry {
  no: number;
  name: string;
  collected: boolean;
  category: DexCategory;
}

const DEX_DATA: DexEntry[] = [
  { no: 1, name: '고냥', collected: true, category: 'land' },
  { no: 2, name: '판다', collected: true, category: 'land' },
  { no: 3, name: '여우', collected: false, category: 'land' },
  { no: 4, name: '토끼', collected: false, category: 'land' },
  { no: 5, name: '???', collected: false, category: 'land' },
  { no: 6, name: '돌고래', collected: true, category: 'sea' },
  { no: 7, name: '문어', collected: false, category: 'sea' },
  { no: 8, name: '거북이', collected: false, category: 'sea' },
  { no: 9, name: '???', collected: false, category: 'sea' },
  { no: 10, name: '???', collected: false, category: 'sea' },
  { no: 11, name: '???', collected: false, category: 'rare' },
  { no: 12, name: '???', collected: false, category: 'rare' },
  { no: 13, name: '???', collected: false, category: 'rare' },
  { no: 14, name: '???', collected: false, category: 'rare' },
  { no: 15, name: '???', collected: false, category: 'rare' },
];

export default function DexPage() {
  const [activeCategory, setActiveCategory] = useState<DexCategory>('land');

  const categories: { key: DexCategory; label: string }[] = [
    { key: 'land', label: '육지 동물' },
    { key: 'sea', label: '해양 동물' },
    { key: 'rare', label: '희귀 동물' },
  ];

  const filteredEntries = DEX_DATA.filter((e) => e.category === activeCategory);

  const getStarColor = (entry: DexEntry) => {
    if (!entry.collected) return '#D5D5D5';
    if (entry.category === 'sea') return '#D0FF20';
    return '#00F0D8';
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center px-4 py-4">
      <StarryBackground />
      <BackButton to="/room" />
      <HomeButton />

      <div className="mt-2 mb-4">
        <Logo size="small" />
      </div>

      <div
        className="w-full max-w-md p-4 border-2 border-black"
        style={{
          background: 'rgba(224, 209, 255, 0.92)',
          boxShadow: '4px 4px 0 #000',
        }}
      >
        <div className="flex gap-1 mb-4">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={clsx(
                'flex-1 font-galmuri text-xs py-2 border-2 border-black transition-all',
                activeCategory === cat.key
                  ? 'bg-dex-tab-pink text-black'
                  : 'bg-white/50 text-gray-500'
              )}
              style={{ boxShadow: '2px 2px 0 #000' }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div
          className="p-4 border-2 border-black"
          style={{
            background: '#40365F',
            boxShadow: 'inset 2px 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <div className="grid grid-cols-5 gap-3">
            {filteredEntries.map((entry) => (
              <div key={entry.no} className="flex flex-col items-center">
                <div
                  className="text-4xl mb-1"
                  style={{
                    color: getStarColor(entry),
                    textShadow: entry.collected
                      ? `0 0 8px ${getStarColor(entry)}`
                      : 'none',
                  }}
                >
                  ★
                </div>
                <p
                  className={clsx(
                    'font-galmuri text-[9px] text-center',
                    entry.collected ? 'text-white' : 'text-gray-500'
                  )}
                >
                  No.{entry.no}
                  <br />
                  {entry.name}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="font-pixel text-black text-xs">
            {filteredEntries.filter((e) => e.collected).length} /{' '}
            {filteredEntries.length} 수집
          </p>
        </div>
      </div>

      <p className="font-galmuri text-white text-[10px] mt-3 opacity-70 text-center">
        루틴몬을 키워서 도감을 완성해보세요!
      </p>
    </main>
  );
}