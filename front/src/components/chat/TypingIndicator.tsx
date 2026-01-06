'use client';

import Image from 'next/image';
import { useThemeStore } from '@/stores/theme-store';

export function TypingIndicator() {
  const theme = useThemeStore((state) => state.theme);
  const logoSrc = theme === 'dark'
    ? '/clave-logo-icon_darkmode.png'
    : '/clave-logo-icon.png';

  return (
    <div className="flex justify-start">
      <div className="rounded-2xl px-6 ml-3">
        <div className="flex items-center justify-center">
          <Image
            src={logoSrc}
            alt="Loading"
            width={30}
            height={30}
            style={{
              animation: 'pulse-scale 1.5s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
}
