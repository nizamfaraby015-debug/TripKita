import { FormEvent, useCallback, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  MapPin,
  Minus,
  Phone,
  Plus,
  User,
  Users,
} from 'lucide-react';
import {
  ADMIN_WHATSAPP_INTL,
  BookingFormData,
  BookingFormErrors,
  LatLngLiteral,
  RouteMetrics,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  getTodayLocalISO,
} from '../types/booking';
import { PlacesAutocompleteInput } from './PlacesAutocompleteInput';
import { RouteMapPanel } from './RouteMapPanel';
import { WhatsAppIcon } from './WhatsAppIcon';

interface BookingFormProps {
  formData: BookingFormData;
  mapsAvailable: boolean;
  onChange: (updated: BookingFormData) => void;
}

export function BookingForm({
  formData,
  mapsAvailable,
  onChange,
}: BookingFormProps) {
  const [errors, setErrors] = useState<BookingFormErrors>({});
  const [routeMetrics, setRouteMetrics] = useState<RouteMetrics | null>(null);
  const [submittedPayload, setSubmittedPayload] = useState<{
    message: string;
    url: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const waAnchorRef = useRef<HTMLAnchorElement | null>(null);
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

  const handleSwapLocations = () => {
    onChange({
      ...formData,
      penjemputan: formData.tujuan,
      penjemputanCoord: formData.tujuanCoord,
      tujuan: formData.penjemputan,
      tujuanCoord: formData.penjemputanCoord,
    });
  };

  const handleUseCurrentLocation = useCallback(
    (coord: LatLngLiteral) => {
      onChange({
        ...formData,
        penjemputan: `Lokasi Saya (${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)})`,
        penjemputanCoord: coord,
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next.penjemputan;
        return next;
      });
    },
    [formData, onChange]
  );

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

    const message = buildWhatsAppMessage(formData, routeMetrics);
    const url = buildWhatsAppUrl(message);

    setErrors({});
    setCopied(false);
    setSubmittedPayload({ message, url });

    requestAnimationFrame(() => {
      if (waAnchorRef.current) {
        waAnchorRef.current.href = url;
        waAnchorRef.current.click();
      }
    });
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

  return (
    <section
      id="booking"
      className="relative z-20 -mt-8 sm:-mt-10 pb-12 sm:pb-16 scroll-mt-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
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

        <div className="bg-white rounded-2xl border border-emerald-950/10 shadow-xl shadow-forest-950/10 p-4 sm:p-6 lg:p-7">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Column: Interactive Google Map (GrabCar Route View) */}
            <div className="lg:col-span-6 flex">
              {mapsAvailable ? (
                <RouteMapPanel
                  pickupCoord={formData.penjemputanCoord}
                  destinationCoord={formData.tujuanCoord}
                  pickupLabel={formData.penjemputan}
                  destinationLabel={formData.tujuan}
                  routeMetrics={routeMetrics}
                  onRouteComputed={setRouteMetrics}
                  onUseCurrentLocation={handleUseCurrentLocation}
                />
              ) : (
                <div className="w-full min-h-[260px] lg:min-h-[500px] rounded-2xl border border-emerald-950/10 bg-forest-50 flex flex-col items-center justify-center p-6 text-center">
                  <MapPin className="w-10 h-10 text-grab-600 mb-3" aria-hidden="true" />
                  <p className="font-display font-bold text-base text-forest-900">
                    Peta Rute TripKita
                  </p>
                  <p className="mt-1 text-sm text-slate-600 max-w-xs">
                    Peta Google Maps sedang disiapkan. Anda tetap dapat mengisi alamat penjemputan dan tujuan di formulir samping.
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Clean Online Booking Form */}
            <div className="lg:col-span-6 flex flex-col justify-between">
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Pickup & Destination with Swap */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-forest-50/75 border border-emerald-950/10 space-y-3">
                  <PlacesAutocompleteInput
                    id="field-penjemputan"
                    name="penjemputan"
                    label="Lokasi penjemputan"
                    placeholder="Ketik nama tempat, alamat, atau bandara"
                    value={formData.penjemputan}
                    pinColorClass="text-grab-600"
                    error={errors.penjemputan}
                    errorId="err-penjemputan"
                    mapsAvailable={mapsAvailable}
                    onTextChange={(val) =>
                      onChange({
                        ...formData,
                        penjemputan: val,
                        penjemputanCoord: null,
                      })
                    }
                    onPlaceSelected={(address, coord) => {
                      onChange({
                        ...formData,
                        penjemputan: address,
                        penjemputanCoord: coord,
                      });
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.penjemputan;
                        return next;
                      });
                    }}
                  />
                  {errors.penjemputan && (
                    <p id="err-penjemputan" className="text-xs font-medium text-red-600 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{errors.penjemputan}</span>
                    </p>
                  )}

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

                  <PlacesAutocompleteInput
                    id="field-tujuan"
                    name="tujuan"
                    label="Tujuan perjalanan"
                    placeholder="Ketik kota, alamat, atau destinasi tujuan"
                    value={formData.tujuan}
                    pinColorClass="text-gold-600"
                    error={errors.tujuan}
                    errorId="err-tujuan"
                    mapsAvailable={mapsAvailable}
                    onTextChange={(val) =>
                      onChange({
                        ...formData,
                        tujuan: val,
                        tujuanCoord: null,
                      })
                    }
                    onPlaceSelected={(address, coord) => {
                      onChange({
                        ...formData,
                        tujuan: address,
                        tujuanCoord: coord,
                      });
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.tujuan;
                        return next;
                      });
                    }}
                  />
                  {errors.tujuan && (
                    <p id="err-tujuan" className="text-xs font-medium text-red-600 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{errors.tujuan}</span>
                    </p>
                  )}
                </div>

                {/* Tanggal & Jam */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="field-tanggal"
                      className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5"
                    >
                      Tanggal perjalanan <span className="text-grab-600">*</span>
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
                      Jam penjemputan <span className="text-grab-600">*</span>
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
            </div>
          </div>

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
                  <h2 className="font-display font-bold text-base text-forest-900">
                    Pesan Booking Siap Dikirim ke WhatsApp Admin
                  </h2>
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
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
