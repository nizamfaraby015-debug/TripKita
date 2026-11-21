import { useState } from 'react';

interface TripKitaLogoProps {
  variant?: 'dark' | 'light';
  className?: string;
  sizeClass?: string;
}

const LOGO_IMAGE_PATH = '/assets/aistudio/Logo_Perjalanan_TripKita_Hijau_145002ac.webp';

export function TripKitaLogo({
  variant = 'dark',
  className = '',
  sizeClass = 'h-12 sm:h-14',
}: TripKitaLogoProps) {
  const [imgError, setImgError] = useState(false);
  const isLight = variant === 'light';

  if (imgError) {
    return (
      <span
        className={`font-display text-2xl font-extrabold tracking-tight leading-none whitespace-nowrap shrink-0 ${
          isLight ? 'text-white' : 'text-forest-900'
        } ${className}`}
      >
        Trip<span className={isLight ? 'text-emerald-400' : 'text-grab-600'}>Kita</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center shrink-0 ${
        isLight ? 'bg-white rounded-xl px-4 py-2 shadow-lg shadow-black/25' : ''
      } ${className}`}
    >
      <img
        src={LOGO_IMAGE_PATH}
        alt="TripKita – Perjalanan Jadi Lebih Mudah"
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeClass} w-auto object-contain select-none`}
      />
    </span>
  );
}
