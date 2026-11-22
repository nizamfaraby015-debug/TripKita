import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { PartnerRegistrationForm } from '../components/mitra/PartnerRegistrationForm';
import { TripKitaLogo } from '../components/TripKitaLogo';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  PartnerPublicStatusRecord,
  getLastPartnerRegNumberLocal,
  lookupPartnerStatusFirestore,
} from '../services/firestoreOpsService';
import {
  getDemoPartnerByRegistrationNumber,
  getLastDemoRegistrationNumber,
} from '../services/partnerDemoService';
import {
  PARTNERSHIP_TYPE_LABELS,
  PARTNER_SERVICE_LABELS,
  PARTNER_STATUS_LABELS,
  PartnerVerificationStatus,
  VEHICLE_AVAILABILITY_LABELS,
} from '../types/partner';

const HERO_PARTNER_IMAGE = '/src/assets/images/indonesian_innova_carter_1795254866924.jpg';

const BENEFITS = [
  {
    icon: TrendingUp,
    title: 'Mendapatkan peluang order',
    description:
      'Terhubung dengan permintaan perjalanan antar kota, bandara, hingga carter harian dari pengguna TripKita.',
  },
  {
    icon: Users,
    title: 'Tidak perlu mencari pelanggan sendiri',
    description:
      'Tim dan sistem TripKita membantu menjembatani kebutuhan pelanggan langsung ke armada mitra yang tersedia.',
  },
  {
    icon: ShieldCheck,
    title: 'Komisi dan sistem kerja transparan',
    description:
      'Rincian pembagian komisi dan kesepakatan kerja disampaikan secara jelas sebelum perjalanan dijalankan.',
  },
  {
    icon: CalendarClock,
    title: 'Bebas mengatur ketersediaan kendaraan',
    description:
      'Anda memegang kendali penuh atas jadwal aktif maupun status ketersediaan unit kendaraan Anda.',
  },
  {
    icon: Car,
    title: 'Bergabung tanpa harus memiliki banyak armada',
    description:
      'Pemilik satu unit mobil maupun pengemudi berpengalaman memiliki peluang yang sama untuk bergabung.',
  },
];

export function PartnerPortalPage() {
  const [imgError, setImgError] = useState(false);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<PartnerPublicStatusRecord | null>(
    null
  );
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupNotFound, setLookupNotFound] = useState(false);

  const performLookup = useCallback(async (regNumber: string) => {
    const clean = regNumber.trim().toUpperCase();
    if (!clean) return;
    setLookupLoading(true);
    setLookupNotFound(false);
    try {
      if (isFirebaseConfigured) {
        const found = await lookupPartnerStatusFirestore(clean);
        setLookupResult(found);
        setLookupNotFound(!found);
      } else {
        const demoFound = getDemoPartnerByRegistrationNumber(clean);
        setLookupResult(
          demoFound
            ? {
                registrationNumber: demoFound.registrationNumber,
                status: demoFound.status,
                partnershipType: demoFound.partnershipType,
                services: demoFound.services,
                vehicleBrandType: demoFound.vehicleBrandType,
                availability: demoFound.availability,
                rejectionReason: demoFound.rejectionReason,
                createdAt: demoFound.createdAt,
                updatedAt: demoFound.updatedAt,
              }
            : null
        );
        setLookupNotFound(!demoFound);
      }
    } catch {
      setLookupResult(null);
      setLookupNotFound(true);
    } finally {
      setLookupLoading(false);
    }
  }, []);

  useEffect(() => {
    const lastReg = isFirebaseConfigured
      ? getLastPartnerRegNumberLocal()
      : getLastDemoRegistrationNumber();
    if (lastReg) {
      setLookupQuery(lastReg);
      void performLookup(lastReg);
    }
  }, [performLookup]);

  const handleLookupSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void performLookup(lookupQuery);
  };

  const renderStatusBadge = (status: PartnerVerificationStatus) => {
    if (status === 'DISETUJUI') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-display font-bold text-xs">
          <CheckCircle2 className="w-4 h-4 text-grab-600" aria-hidden="true" />
          <span>{PARTNER_STATUS_LABELS[status]}</span>
        </span>
      );
    }
    if (status === 'DITOLAK') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-100 text-red-900 font-display font-bold text-xs">
          <XCircle className="w-4 h-4 text-red-600" aria-hidden="true" />
          <span>{PARTNER_STATUS_LABELS[status]}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-100 text-amber-900 font-display font-bold text-xs">
        <ClipboardCheck className="w-4 h-4 text-amber-700" aria-hidden="true" />
        <span>{PARTNER_STATUS_LABELS[status]}</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6FAF8] text-slate-900">
      {!isFirebaseConfigured && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-950 px-4 py-2 text-xs text-center">
          <strong>Mode Demo (Simulasi Sementara):</strong> Sistem portal mitra masih menggunakan data simulasi di browser (<code>localStorage</code>).
        </div>
      )}

      {/* Top White Bar */}
      <header className="bg-white border-b border-emerald-950/10 sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          <Link
            to="/"
            aria-label="Kembali ke Beranda TripKita"
            className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-grab-500 rounded-lg"
          >
            <TripKitaLogo variant="dark" sizeClass="h-11 sm:h-13" />
          </Link>

          <nav className="flex items-center gap-3 sm:gap-6">
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-forest-900 transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Halaman Utama</span>
            </Link>
            <a
              href="#cek-status"
              className="text-xs sm:text-sm font-semibold text-forest-900 hover:text-grab-600 transition-colors whitespace-nowrap"
            >
              Cek Status
            </a>
            <a
              href="#form-mitra"
              className="min-h-[42px] px-4 py-2 rounded-xl bg-grab-600 hover:bg-grab-700 text-white font-display font-bold text-xs sm:text-sm inline-flex items-center whitespace-nowrap shadow-sm shadow-grab-600/20 transition-colors"
            >
              Daftar Sekarang
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#032015] via-[#063B27] to-[#0B6B44] text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7">
                <span className="text-xs font-display font-bold tracking-wide text-gold-400 uppercase">
                  Jaringan Mitra Transportasi
                </span>
                <h1 className="mt-2 font-display font-extrabold text-[clamp(2rem,4vw,3rem)] leading-[1.12] tracking-tight text-white text-balance">
                  Jadi Mitra TripKita
                </h1>
                <p className="mt-3.5 text-sm sm:text-base text-emerald-100/90 leading-relaxed max-w-xl">
                  Bergabung dengan jaringan mitra transportasi TripKita dan dapatkan peluang pelanggan dari berbagai wilayah.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <a
                    href="#form-mitra"
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#00A84B] to-[#008A3C] hover:from-[#009944] hover:to-[#007834] text-white font-display font-bold text-sm inline-flex items-center gap-2 shadow-lg shadow-black/20 transition-all"
                  >
                    <span>Isi Formulir Pendaftaran</span>
                  </a>
                  <a
                    href="#cek-status"
                    className="min-h-[48px] px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-display font-semibold text-sm inline-flex items-center gap-2 transition-colors"
                  >
                    <span>Cek Status Pendaftaran</span>
                  </a>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="relative h-56 sm:h-64 rounded-2xl overflow-hidden border border-white/15 bg-forest-900 shadow-xl">
                  {!imgError ? (
                    <img
                      src={HERO_PARTNER_IMAGE}
                      alt="Armada Mitra Transportasi TripKita"
                      referrerPolicy="no-referrer"
                      onError={() => setImgError(true)}
                      className="w-full h-full object-cover object-center"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                      <Car className="w-12 h-12 text-gold-400 mb-2" aria-hidden="true" />
                      <p className="font-display font-bold text-base">Mitra TripKita</p>
                    </div>
                  )}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#032015]/70 via-transparent to-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Manfaat Bergabung */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-14">
          <div className="max-w-2xl mb-8">
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-forest-900">
              Keuntungan Bergabung sebagai Mitra
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600">
              Dirancang agar pemilik kendaraan maupun pengemudi dapat berkembang bersama layanan TripKita.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {BENEFITS.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={benefit.title}
                  className="bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-forest-50 border border-emerald-950/10 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-grab-600" aria-hidden="true" />
                    </div>
                    <h3 className="font-display font-bold text-base text-forest-900">
                      0{index + 1}. {benefit.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Formulir Pendaftaran Mitra Bertahap */}
        <section id="form-mitra" className="mx-auto max-w-4xl px-4 sm:px-6 pb-12 sm:pb-14 scroll-mt-24">
          <PartnerRegistrationForm
            onSubmitted={(record) => {
              setLookupQuery(record.registrationNumber);
              setLookupResult({
                registrationNumber: record.registrationNumber,
                status: record.status,
                partnershipType: record.partnershipType,
                services: record.services,
                vehicleBrandType: record.vehicleBrandType,
                availability: record.availability,
                rejectionReason: record.rejectionReason,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
              });
              setLookupNotFound(false);
            }}
          />
        </section>

        {/* Cek Status Pendaftaran (Tanpa PII) */}
        <section id="cek-status" className="mx-auto max-w-4xl px-4 sm:px-6 pb-16 scroll-mt-24">
          <div className="bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="font-display font-extrabold text-xl text-forest-900">
                  Cek Status Pendaftaran Mitra
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Masukkan nomor pendaftaran Anda untuk melihat status verifikasi terbaru dari admin TripKita.
                </p>
              </div>
              <Sparkles className="w-5 h-5 text-gold-600 shrink-0 hidden sm:block" aria-hidden="true" />
            </div>

            <form onSubmit={handleLookupSubmit} className="mt-5 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  aria-label="Nomor Pendaftaran Mitra"
                  placeholder="Contoh: MTR-261122-4812"
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                  className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-grab-500/25 focus:border-grab-600"
                />
              </div>
              <button
                type="submit"
                disabled={lookupLoading}
                className="min-h-[46px] px-5 py-2.5 rounded-xl bg-forest-900 hover:bg-forest-800 disabled:opacity-60 text-white font-display font-bold text-sm cursor-pointer transition-colors whitespace-nowrap inline-flex items-center justify-center gap-2"
              >
                {lookupLoading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                <span>Periksa Status</span>
              </button>
            </form>

            {lookupNotFound && (
              <div className="mt-5 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900">
                Nomor pendaftaran <strong>{lookupQuery.toUpperCase()}</strong> tidak ditemukan atau belum terdaftar.
              </div>
            )}

            {lookupResult && (
              <div className="mt-5 p-5 rounded-xl bg-forest-50/70 border border-emerald-950/10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs text-slate-500">Nomor Pendaftaran</span>
                    <span className="font-mono font-bold text-base text-forest-900">
                      {lookupResult.registrationNumber}
                    </span>
                  </div>
                  {renderStatusBadge(lookupResult.status)}
                </div>

                {lookupResult.status === 'DITOLAK' && lookupResult.rejectionReason && (
                  <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-900">
                    <strong>Alasan Penolakan:</strong> {lookupResult.rejectionReason}
                  </div>
                )}

                {lookupResult.status === 'DISETUJUI' && (
                  <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-950">
                    Pendaftaran Anda telah disetujui oleh admin TripKita. Anda siap menerima penawaran penugasan perjalanan sesuai area operasional.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-700 pt-2 border-t border-emerald-950/10">
                  <div>
                    <span className="text-slate-500">Kemitraan:</span>{' '}
                    <strong className="text-forest-900">
                      {PARTNERSHIP_TYPE_LABELS[lookupResult.partnershipType]}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Armada Terdaftar:</span>{' '}
                    <strong className="text-forest-900">
                      {lookupResult.vehicleBrandType}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Ketersediaan:</span>{' '}
                    <strong className="text-forest-900">
                      {VEHICLE_AVAILABILITY_LABELS[lookupResult.availability]}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Layanan:</span>{' '}
                    <strong className="text-forest-900">
                      {lookupResult.services
                        .map((svc) => PARTNER_SERVICE_LABELS[svc])
                        .join(', ')}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-forest-950 text-emerald-100/80 border-t border-forest-800 py-6 px-4">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
          <span>TripKita — Teman Perjalanan Anda (Portal Mitra)</span>
          <Link to="/" className="text-gold-400 hover:underline font-semibold">
            Kembali ke Pemesanan Pelanggan
          </Link>
        </div>
      </footer>
    </div>
  );
}
