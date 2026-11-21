import { useState } from 'react';
import { ArrowDown, Car } from 'lucide-react';
import { TripKitaLogo } from './TripKitaLogo';

const HERO_IMAGE_PATH = '/src/assets/images/indonesian_hero_zenix_1795254866708.jpg';

export function HeroSection() {
  const [imgError, setImgError] = useState(false);

  return (
    <>
      {/* Top White Bar — Logo on pure white left, "Booking Sekarang" right */}
      <header className="bg-white border-b border-emerald-950/10 sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          <a
            href="#booking"
            aria-label="TripKita Beranda"
            className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-grab-500 rounded-lg"
          >
            <TripKitaLogo variant="dark" sizeClass="h-11 sm:h-14" />
          </a>

          <a
            href="#booking"
            className="min-h-[44px] px-4 sm:px-5 py-2.5 rounded-xl bg-grab-600 hover:bg-grab-700 active:bg-grab-700 text-white font-display font-bold text-sm sm:text-base inline-flex items-center gap-2 shadow-sm shadow-grab-600/20 transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-grab-500 focus-visible:ring-offset-2"
          >
            <span>Booking Sekarang</span>
            <ArrowDown className="w-4 h-4 shrink-0" aria-hidden="true" />
          </a>
        </div>
      </header>

      {/* Full-Bleed Deep Forest Emerald Hero with Car Backdrop */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#032015] via-[#063B27] to-[#0B6B44] text-white">
        {!imgError ? (
          <img
            src={HERO_IMAGE_PATH}
            alt="Armada Toyota Kijang Innova Zenix TripKita di jalan pesisir Indonesia"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover object-center opacity-50"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-end pr-12 opacity-15"
          >
            <Car className="w-48 h-48 text-emerald-200" />
          </div>
        )}

        {/* Executive Emerald Gradient Overlay for crisp text contrast while keeping car visible */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#032015]/95 via-[#063B27]/80 to-[#063B27]/35"
        />

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-16 sm:pt-14 sm:pb-20">
          <div className="max-w-2xl">
            <h1 className="font-display font-extrabold text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.15] tracking-tight text-white text-balance">
              TripKita — <span className="text-gold-400">Teman Perjalanan Anda.</span>
            </h1>

            <p className="mt-3 text-sm sm:text-base text-emerald-100/90 leading-relaxed max-w-xl">
              Pilih lokasi penjemputan dan tujuan di peta, isi jadwal perjalanan, lalu kirim booking langsung ke WhatsApp admin.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
