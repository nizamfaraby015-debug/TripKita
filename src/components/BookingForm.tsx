import { FormEvent, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Minus,
  Phone,
  Plus,
  RefreshCw,
  User,
  Users,
} from 'lucide-react';
import {
  ADMIN_WHATSAPP_INTL,
  BookingFormData,
  BookingFormErrors,
  RouteMetrics,
  TRIP_TYPE_LABELS,
  TripType,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  getTodayLocalISO,
} from '../types/booking';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  IdempotentBookingIdentifiers,
  buildBookingFingerprint,
  createIdempotentBookingIdentifiers,
  saveBookingToFirestore,
} from '../services/bookingService';
import { recordDemoBookingFromForm } from '../services/partnerDemoService';
import { WhatsAppIcon } from './WhatsAppIcon';

interface BookingFormProps {
  formData: BookingFormData;
  onChange: (updated: BookingFormData) => void;
}

const TRIP_TYPE_OPTIONS: Array<{ id: TripType; label: string }> = [
  { id: 'SEKALI_JALAN', label: TRIP_TYPE_LABELS.SEKALI_JALAN },
  { id: 'ANTAR_TUNGGU', label: TRIP_TYPE_LABELS.ANTAR_TUNGGU },
  { id: 'PULANG_PERGI', label: TRIP_TYPE_LABELS.PULANG_PERGI },
  { id: 'CARTER', label: TRIP_TYPE_LABELS.CARTER },
  { id: 'RENTAL_SOPIR', label: TRIP_TYPE_LABELS.RENTAL_SOPIR },
];

export function BookingForm({
  formData,
  onChange,
}: BookingFormProps) {
  const [errors, setErrors] = useState<BookingFormErrors>({});
  const routeMetrics: RouteMetrics | null = null;
  const [submittedPayload, setSubmittedPayload] = useState<{
    message: string;
    url: string;
    bookingCode: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [dbSaveState, setDbSaveState] = useState<{
    status: 'idle' | 'saving' | 'saved' | 'error';
    bookingCode: string | null;
    errorMessage: string | null;
  }>({
    status: 'idle',
    bookingCode: null,
    errorMessage: null,
  });

  const waAnchorRef = useRef<HTMLAnchorElement | null>(null);
  const activeSubmissionRef = useRef<{
    identifiers: IdempotentBookingIdentifiers;
    formData: BookingFormData;
    routeMetrics: RouteMetrics | null;
  } | null>(null);
  const isSavingRef = useRef(false);
  const todayISO = getTodayLocalISO();

  const updateField = <K extends keyof BookingFormData>(
    key: K,
    value: BookingFormData[K]
  ) => {
    onChange({ ...formData, [key]: value });
    if (key in errors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as keyof BookingFormErrors];
        return next;
      });
    }
  };

  const handleTripTypeChange = (nextType: TripType) => {
    onChange({
      ...formData,
      jenisPerjalanan: nextType,
    });
    setErrors({});
  };

  const handleSwapLocations = () => {
    onChange({
      ...formData,
      penjemputan: formData.tujuan,
      penjemputanCoord: null,
      tujuan: formData.penjemputan,
      tujuanCoord: null,
    });
  };

  const adjustPassengers = (delta: number) => {
    const current = parseInt(formData.penumpang, 10);
    const base = Number.isNaN(current) ? 1 : current;
    const next = Math.min(50, Math.max(1, base + delta));
    updateField('penumpang', String(next));
  };

  const validateForm = (): BookingFormErrors => {
    const nextErrors: BookingFormErrors = {};

    if (!formData.penjemputan.trim()) {
      nextErrors.penjemputan = 'Lokasi penjemputan wajib diisi.';
    }

    if (!formData.tujuan.trim()) {
      nextErrors.tujuan = 'Tujuan perjalanan wajib diisi.';
    }

    if (!formData.tanggal.trim()) {
      nextErrors.tanggal = 'Tanggal perjalanan wajib dipilih.';
    }

    if (!formData.jam.trim()) {
      nextErrors.jam = 'Jam penjemputan wajib diisi.';
    }

    if (
      formData.jenisPerjalanan === 'CARTER' ||
      formData.jenisPerjalanan === 'RENTAL_SOPIR'
    ) {
      if (!formData.durasiPemakaian.trim()) {
        nextErrors.durasiPemakaian = 'Durasi pemakaian wajib diisi.';
      }
    }

    const penumpangNum = parseInt(formData.penumpang, 10);
    if (!formData.penumpang.trim() || Number.isNaN(penumpangNum) || penumpangNum < 1) {
      nextErrors.penumpang = 'Jumlah penumpang minimal 1 orang.';
    }

    if (!formData.nama.trim()) {
      nextErrors.nama = 'Nama pemesan wajib diisi.';
    }

    const rawWa = formData.whatsapp.trim();
    const digitsOnly = rawWa.replace(/\D/g, '');
    if (!rawWa) {
      nextErrors.whatsapp = 'Nomor WhatsApp wajib diisi.';
    } else if (digitsOnly.length < 9 || digitsOnly.length > 15) {
      nextErrors.whatsapp = 'Masukkan nomor WhatsApp yang valid (9–15 digit).';
    }

    return nextErrors;
  };

  const persistBookingAsync = async (submission: {
    identifiers: IdempotentBookingIdentifiers;
    formData: BookingFormData;
    routeMetrics: RouteMetrics | null;
  }) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setDbSaveState({
      status: 'saving',
      bookingCode: submission.identifiers.bookingCode,
      errorMessage: null,
    });

    try {
      const outcome = await saveBookingToFirestore(
        submission.identifiers,
        submission.formData,
        submission.routeMetrics
      );

      if (
        activeSubmissionRef.current?.identifiers.bookingId !==
        submission.identifiers.bookingId
      ) {
        return;
      }

      if (outcome.ok) {
        setDbSaveState({
          status: 'saved',
          bookingCode: outcome.bookingCode,
          errorMessage: null,
        });
      } else {
        setDbSaveState({
          status: 'error',
          bookingCode: outcome.bookingCode,
          errorMessage:
            outcome.errorMessage ||
            'Penyimpanan booking ke database mengalami kendala.',
        });
      }
    } finally {
      isSavingRef.current = false;
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const firstErrorField = Object.keys(validationErrors)[0];
      const element = document.getElementById(`field-${firstErrorField}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
      return;
    }

    // Idempotensi: gunakan bookingId & bookingCode yang sama jika payload identik
    const fingerprint = buildBookingFingerprint(formData, routeMetrics);
    const existingSubmission = activeSubmissionRef.current;
    const isSameSubmission =
      existingSubmission?.identifiers.fingerprint === fingerprint;

    const submission = isSameSubmission
      ? existingSubmission
      : {
          identifiers: createIdempotentBookingIdentifiers(fingerprint),
          formData: { ...formData },
          routeMetrics: null,
        };

    activeSubmissionRef.current = submission;

    // Jika Firebase belum aktif (mode fallback offline/demo), catat ke state demo browser
    if (!isFirebaseConfigured) {
      recordDemoBookingFromForm({
        bookingId: submission.identifiers.bookingId,
        bookingCode: submission.identifiers.bookingCode,
        formData: submission.formData,
        routeMetrics: submission.routeMetrics,
      });
    }

    const message = buildWhatsAppMessage(
      formData,
      routeMetrics,
      submission.identifiers.bookingCode
    );
    const url = buildWhatsAppUrl(message);

    setErrors({});
    setCopied(false);
    setSubmittedPayload({
      message,
      url,
      bookingCode: submission.identifiers.bookingCode,
    });

    // Buka WhatsApp langsung dalam gesture klik pengguna agar tidak diblokir popup blocker
    if (waAnchorRef.current) {
      waAnchorRef.current.href = url;
      waAnchorRef.current.click();
    }

    const alreadySavedSamePayload =
      isSameSubmission && dbSaveState.status === 'saved';

    if (!alreadySavedSamePayload) {
      void persistBookingAsync(submission);
    }
  };

  const handleRetrySave = () => {
    if (!activeSubmissionRef.current || isSavingRef.current) return;
    void persistBookingAsync(activeSubmissionRef.current);
  };

  const handleCopyMessage = async () => {
    if (!submittedPayload) return;
    try {
      await navigator.clipboard.writeText(submittedPayload.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const inputBaseClass =
    'w-full min-h-[48px] pl-10 pr-3.5 py-2.5 rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-grab-500/25 focus:border-grab-600';

  const getBorderClass = (hasError?: string) =>
    hasError ? 'border-red-500 bg-red-50/30' : 'border-slate-300 hover:border-emerald-700/40';

  const isPP = formData.jenisPerjalanan === 'PULANG_PERGI';
  const isCharterOrRental =
    formData.jenisPerjalanan === 'CARTER' ||
    formData.jenisPerjalanan === 'RENTAL_SOPIR';

  return (
    <section
      id="booking"
      className="relative z-20 -mt-8 sm:-mt-10 pb-12 sm:pb-16 scroll-mt-20"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <a
          ref={waAnchorRef}
          href={submittedPayload?.url ?? `https://wa.me/${ADMIN_WHATSAPP_INTL}`}
          target="_blank"
          rel="noopener noreferrer"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        >
          Buka WhatsApp
        </a>

        <div className="bg-white rounded-2xl border border-emerald-950/10 shadow-xl shadow-forest-950/10 p-5 sm:p-7 lg:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Jenis Perjalanan Selector */}
            <div>
              <span className="block text-xs sm:text-sm font-semibold text-forest-900 mb-2">
                Jenis perjalanan <span className="text-grab-600">*</span>
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TRIP_TYPE_OPTIONS.map((option) => {
                  const active = formData.jenisPerjalanan === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleTripTypeChange(option.id)}
                      className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-display font-bold transition-colors cursor-pointer text-center ${
                        active
                          ? 'bg-forest-900 border-forest-900 text-white shadow-xs'
                          : 'bg-forest-50/75 border-emerald-950/10 text-forest-900 hover:border-grab-500 hover:bg-emerald-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pickup & Destination with Swap */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-forest-50/75 border border-emerald-950/10 space-y-3">
              <div>
                <label
                  htmlFor="field-penjemputan"
                  className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5"
                >
                  Lokasi penjemputan <span className="text-grab-600">*</span>
                </label>
                <div className="relative">
                  <MapPin
                    className="w-4 h-4 text-grab-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="field-penjemputan"
                    name="penjemputan"
                    type="text"
                    autoComplete="off"
                    placeholder="Ketik nama tempat, alamat, atau bandara"
                    value={formData.penjemputan}
                    onChange={(e) => {
                      onChange({
                        ...formData,
                        penjemputan: e.target.value,
                        penjemputanCoord: null,
                      });
                      if (errors.penjemputan) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.penjemputan;
                          return next;
                        });
                      }
                    }}
                    aria-invalid={Boolean(errors.penjemputan)}
                    aria-describedby={errors.penjemputan ? 'err-penjemputan' : undefined}
                    className={`${inputBaseClass} ${getBorderClass(errors.penjemputan)}`}
                  />
                </div>
                {errors.penjemputan && (
                  <p id="err-penjemputan" className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.penjemputan}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end -my-1">
                <button
                  type="button"
                  onClick={handleSwapLocations}
                  className="min-h-[36px] px-3 py-1 rounded-full bg-white hover:bg-emerald-50 border border-slate-300 hover:border-grab-500 text-forest-800 hover:text-grab-600 text-xs font-display font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Tukar titik</span>
                </button>
              </div>

              <div>
                <label
                  htmlFor="field-tujuan"
                  className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5"
                >
                  {isCharterOrRental ? 'Area / tujuan utama' : 'Tujuan perjalanan'}{' '}
                  <span className="text-grab-600">*</span>
                </label>
                <div className="relative">
                  <MapPin
                    className="w-4 h-4 text-gold-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="field-tujuan"
                    name="tujuan"
                    type="text"
                    autoComplete="off"
                    placeholder="Ketik kota, alamat, atau destinasi tujuan"
                    value={formData.tujuan}
                    onChange={(e) => {
                      onChange({
                        ...formData,
                        tujuan: e.target.value,
                        tujuanCoord: null,
                      });
                      if (errors.tujuan) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.tujuan;
                          return next;
                        });
                      }
                    }}
                    aria-invalid={Boolean(errors.tujuan)}
                    aria-describedby={errors.tujuan ? 'err-tujuan' : undefined}
                    className={`${inputBaseClass} ${getBorderClass(errors.tujuan)}`}
                  />
                </div>
                {errors.tujuan && (
                  <p id="err-tujuan" className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.tujuan}</span>
                  </p>
                )}
              </div>
            </div>

                {/* Tanggal & Jam Berangkat / Mulai */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="field-tanggal"
                      className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5"
                    >
                      {isPP
                        ? 'Tanggal keberangkatan'
                        : isCharterOrRental
                          ? 'Tanggal mulai'
                          : 'Tanggal perjalanan'}{' '}
                      <span className="text-grab-600">*</span>
                    </label>
                    <div className="relative">
                      <Calendar
                        className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="field-tanggal"
                        name="tanggal"
                        type="date"
                        min={todayISO}
                        value={formData.tanggal}
                        onChange={(e) => updateField('tanggal', e.target.value)}
                        aria-invalid={Boolean(errors.tanggal)}
                        aria-describedby={errors.tanggal ? 'err-tanggal' : undefined}
                        className={`${inputBaseClass} ${getBorderClass(errors.tanggal)} tabular-nums`}
                      />
                    </div>
                    {errors.tanggal && (
                      <p id="err-tanggal" className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{errors.tanggal}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="field-jam"
                      className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5"
                    >
                      {isPP
                        ? 'Jam keberangkatan'
                        : isCharterOrRental
                          ? 'Jam mulai'
                          : 'Jam penjemputan'}{' '}
                      <span className="text-grab-600">*</span>
                    </label>
                    <div className="relative">
                      <Clock
                        className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="field-jam"
                        name="jam"
                        type="time"
                        value={formData.jam}
                        onChange={(e) => updateField('jam', e.target.value)}
                        aria-invalid={Boolean(errors.jam)}
                        aria-describedby={errors.jam ? 'err-jam' : undefined}
                        className={`${inputBaseClass} ${getBorderClass(errors.jam)} tabular-nums`}
                      />
                    </div>
                    {errors.jam && (
                      <p id="err-jam" className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{errors.jam}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Detail Tambahan: CARTER & RENTAL DENGAN SOPIR (Durasi Pemakaian saja) */}
                {isCharterOrRental && (
                  <div className="p-3.5 sm:p-4 rounded-xl bg-forest-50/75 border border-emerald-950/10 space-y-3">
                    <div className="text-xs font-display font-bold text-forest-900">
                      Detail {TRIP_TYPE_LABELS[formData.jenisPerjalanan]}
                    </div>

                    <div>
                      <label
                        htmlFor="field-durasiPemakaian"
                        className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5"
                      >
                        Durasi pemakaian <span className="text-grab-600">*</span>
                      </label>
                      <div className="relative">
                        <Clock
                          className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          id="field-durasiPemakaian"
                          name="durasiPemakaian"
                          type="text"
                          placeholder="Contoh: 12 Jam atau 2 Hari"
                          value={formData.durasiPemakaian}
                          onChange={(e) => updateField('durasiPemakaian', e.target.value)}
                          aria-invalid={Boolean(errors.durasiPemakaian)}
                          className={`${inputBaseClass} ${getBorderClass(errors.durasiPemakaian)}`}
                        />
                      </div>
                      {errors.durasiPemakaian && (
                        <p className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{errors.durasiPemakaian}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Jumlah Penumpang & Nomor WhatsApp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="field-penumpang"
                      className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5"
                    >
                      Jumlah penumpang <span className="text-grab-600">*</span>
                    </label>
                    <div className="flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => adjustPassengers(-1)}
                        aria-label="Kurangi jumlah penumpang"
                        className="min-h-[48px] min-w-[44px] rounded-xl border border-slate-300 bg-forest-50 hover:bg-emerald-100/70 active:scale-[0.97] text-forest-900 flex items-center justify-center transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-grab-500"
                      >
                        <Minus className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <div className="relative flex-1">
                        <Users
                          className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          id="field-penumpang"
                          name="penumpang"
                          type="number"
                          min={1}
                          max={50}
                          inputMode="numeric"
                          value={formData.penumpang}
                          onChange={(e) => updateField('penumpang', e.target.value)}
                          aria-invalid={Boolean(errors.penumpang)}
                          aria-describedby={errors.penumpang ? 'err-penumpang' : undefined}
                          className={`${inputBaseClass} pl-9 pr-2 ${getBorderClass(errors.penumpang)} text-center font-semibold tabular-nums`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => adjustPassengers(1)}
                        aria-label="Tambah jumlah penumpang"
                        className="min-h-[48px] min-w-[44px] rounded-xl border border-slate-300 bg-forest-50 hover:bg-emerald-100/70 active:scale-[0.97] text-forest-900 flex items-center justify-center transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-grab-500"
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                    {errors.penumpang && (
                      <p id="err-penumpang" className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{errors.penumpang}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="field-whatsapp"
                      className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5"
                    >
                      Nomor WhatsApp <span className="text-grab-600">*</span>
                    </label>
                    <div className="relative">
                      <Phone
                        className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="field-whatsapp"
                        name="whatsapp"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="081234567890"
                        value={formData.whatsapp}
                        onChange={(e) => updateField('whatsapp', e.target.value)}
                        aria-invalid={Boolean(errors.whatsapp)}
                        aria-describedby={errors.whatsapp ? 'err-whatsapp' : undefined}
                        className={`${inputBaseClass} ${getBorderClass(errors.whatsapp)} tabular-nums`}
                      />
                    </div>
                    {errors.whatsapp && (
                      <p id="err-whatsapp" className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{errors.whatsapp}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Nama Pemesan */}
                <div>
                  <label
                    htmlFor="field-nama"
                    className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5"
                  >
                    Nama pemesan <span className="text-grab-600">*</span>
                  </label>
                  <div className="relative">
                    <User
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="field-nama"
                      name="nama"
                      type="text"
                      autoComplete="name"
                      placeholder="Contoh: Budi Santoso"
                      value={formData.nama}
                      onChange={(e) => updateField('nama', e.target.value)}
                      aria-invalid={Boolean(errors.nama)}
                      aria-describedby={errors.nama ? 'err-nama' : undefined}
                      className={`${inputBaseClass} ${getBorderClass(errors.nama)}`}
                    />
                  </div>
                  {errors.nama && (
                    <p id="err-nama" className="mt-1.5 text-xs font-medium text-red-600 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{errors.nama}</span>
                    </p>
                  )}
                </div>

                {/* Catatan Tambahan */}
                <div>
                  <label
                    htmlFor="field-catatan"
                    className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5"
                  >
                    Catatan tambahan <span className="font-normal text-slate-500">(opsional)</span>
                  </label>
                  <div className="relative">
                    <FileText
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none"
                      aria-hidden="true"
                    />
                    <textarea
                      id="field-catatan"
                      name="catatan"
                      rows={2}
                      placeholder="Contoh: Bawa 2 koper besar, jemput di lobby utama."
                      value={formData.catatan}
                      onChange={(e) => updateField('catatan', e.target.value)}
                      className={`${inputBaseClass} min-h-[76px] pt-3 border-slate-300 hover:border-emerald-700/40 resize-y`}
                    />
                  </div>
                </div>

                {/* Submit CTA */}
                <div className="pt-1">
                  <button
                    type="submit"
                    className="w-full min-h-[54px] px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#00A84B] to-[#008A3C] hover:from-[#009944] hover:to-[#007834] active:scale-[0.99] text-white font-display font-bold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md shadow-emerald-600/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-grab-500 focus-visible:ring-offset-2"
                  >
                    <WhatsAppIcon className="w-6 h-6 shrink-0" />
                    <span>KIRIM BOOKING VIA WHATSAPP</span>
                  </button>
                  <p className="mt-2.5 text-center text-xs text-slate-500">
                    Booking akan dikonfirmasi oleh admin TripKita.
                  </p>
                </div>
              </form>

          {/* Confirmation Fallback Panel (Zero tariffs displayed) */}
          {submittedPayload && (
            <div
              role="status"
              aria-live="polite"
              className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/75 p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2
                  className="w-5 h-5 text-grab-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display font-bold text-base text-forest-900">
                      Pesan Booking Siap Dikirim ke WhatsApp Admin
                    </h2>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 font-mono text-xs font-bold text-forest-900">
                      {submittedPayload.bookingCode}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mt-1">
                    Jika WhatsApp tidak terbuka otomatis, tekan tombol di bawah ini untuk langsung terhubung ke WhatsApp admin TripKita.
                  </p>

                  <pre className="mt-3 p-3.5 rounded-lg bg-white border border-emerald-200/80 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                    {submittedPayload.message}
                  </pre>

                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <a
                      href={submittedPayload.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[48px] px-5 py-3 rounded-xl bg-forest-900 hover:bg-forest-800 text-white font-display font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                    >
                      <WhatsAppIcon className="w-5 h-5 shrink-0" />
                      <span>Buka WhatsApp Sekarang</span>
                      <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                    </a>

                    <button
                      type="button"
                      onClick={handleCopyMessage}
                      className="min-h-[48px] px-5 py-3 rounded-xl bg-white hover:bg-forest-50 border border-slate-300 text-forest-900 font-display font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{copied ? 'Pesan Tersalin' : 'Salin Pesan Booking'}</span>
                    </button>
                  </div>

                  {/* Status penyimpanan database (non-blocking, tidak mengklaim sukses jika gagal) */}
                  {dbSaveState.status === 'saving' && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-grab-600 shrink-0" aria-hidden="true" />
                      <span>Menyimpan catatan booking ke sistem...</span>
                    </div>
                  )}

                  {dbSaveState.status === 'saved' && dbSaveState.bookingCode && (
                    <div className="mt-3 text-xs text-forest-800 font-medium">
                      Catatan booking tersimpan (Kode Referensi:{' '}
                      <span className="font-mono font-bold">{dbSaveState.bookingCode}</span>).
                    </div>
                  )}

                  {dbSaveState.status === 'error' && (
                    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>
                          Pesan WhatsApp tetap dapat dikirim, namun penyimpanan catatan booking ke database mengalami kendala.{' '}
                          {dbSaveState.errorMessage}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRetrySave}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 font-display font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Coba Simpan Ulang</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
