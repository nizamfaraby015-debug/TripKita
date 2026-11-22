import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Car } from 'lucide-react';
import { ADMIN_WHATSAPP_INTL } from '../types/booking';
import { TripKitaLogo } from './TripKitaLogo';
import { WhatsAppIcon } from './WhatsAppIcon';

const FOOTER_IMAGE_PATH = '/src/assets/images/indonesian_hero_zenix_1795254866708.jpg';

export function Footer() {
  const [imgError, setImgError] = useState(false);

  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-[#032015] via-[#063B27] to-[#0B6B44] text-white border-t border-emerald-900/60">
      {!imgError ? (
        <img
          src={FOOTER_IMAGE_PATH}
          alt="Armada Toyota Kijang Innova Zenix TripKita"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-45"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-end pr-12 opacity-15"
        >
          <Car className="w-36 h-36 text-emerald-200" />
        </div>
      )}

      {/* Executive Emerald Gradient Overlay matching HeroSection */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#032015]/95 via-[#063B27]/80 to-[#063B27]/45"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
            <TripKitaLogo variant="light" sizeClass="h-11 sm:h-12" />
            <div className="flex flex-col">
              <span className="font-display font-bold text-sm sm:text-base text-white">
                TripKita — <span className="text-gold-400">Teman Perjalanan Anda.</span>
              </span>
              <span className="text-xs sm:text-sm text-emerald-100/80">
                Booking mobil cepat dan langsung terhubung ke admin.
              </span>
            </div>
          </div>

          <a
            href={`https://wa.me/${ADMIN_WHATSAPP_INTL}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Hubungi WhatsApp Admin TripKita"
            className="min-h-[48px] px-5 py-3 rounded-xl bg-gradient-to-r from-[#00A84B] to-[#008A3C] hover:from-[#009944] hover:to-[#007834] text-white font-display font-bold text-sm inline-flex items-center gap-2.5 shadow-lg shadow-black/25 border border-white/15 transition-all whitespace-nowrap shrink-0"
          >
            <WhatsAppIcon className="w-5 h-5 shrink-0" />
            <span>WhatsApp Admin</span>
          </a>
        </div>

        <div className="mt-6 pt-4 border-t border-white/15 flex flex-wrap items-center justify-center sm:justify-between gap-3 text-xs text-emerald-100/80">
          <div className="flex items-center gap-3">
            <Link
              to="/mitra"
              className="font-semibold hover:text-gold-400 transition-colors whitespace-nowrap"
            >
              Daftar Jadi Mitra
            </Link>
            <span aria-hidden="true" className="text-white/30">·</span>
            <Link
              to="/admin"
              className="font-semibold hover:text-gold-400 transition-colors whitespace-nowrap"
            >
              Dashboard Admin
            </Link>
          </div>
          <span>TripKita — Online Booking Mobil</span>
        </div>
      </div>
    </footer>
  );
}
