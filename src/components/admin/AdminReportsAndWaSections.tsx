import { ChangeEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  MessageSquare,
  Upload,
} from 'lucide-react';
import {
  ADMIN_WHATSAPP_INTL,
  OperationalBookingRecord,
  buildWhatsAppUrl,
} from '../../types/booking';
import {
  PartnerRegistration,
  WeeklyCommissionDeposit,
} from '../../types/partner';
import {
  WHATSAPP_TEMPLATE_LIST,
  WhatsAppTemplateId,
  buildTemplateBookingMasukAdmin,
  buildTemplateKonfirmasiPelanggan,
  buildTemplatePenagihanKomisiMingguan,
  buildTemplatePenawaranMitra,
} from '../../services/whatsappTemplates';
import {
  GOOGLE_SHEETS_TABS,
  GoogleSheetsTabName,
  buildAllSixTabsPreview,
  buildBookingsCsv,
  buildCommissionCsv,
  buildPartnersCsv,
  buildPeriodReportCsv,
  getGoogleSheetsConnectionStatus,
  parseAndValidateBookingsCsvImport,
  syncTabViaGoogleSheetsAdapter,
  triggerCsvDownload,
} from '../../services/googleSheetsService';
import { formatRupiah } from '../../services/partnerDemoService';

interface AdminWhatsAppTemplatesSectionProps {
  bookings: OperationalBookingRecord[];
  partners: PartnerRegistration[];
  deposits: WeeklyCommissionDeposit[];
}

export function AdminWhatsAppTemplatesSection({
  bookings,
  partners,
  deposits,
}: AdminWhatsAppTemplatesSectionProps) {
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<WhatsAppTemplateId>('BOOKING_MASUK_ADMIN');
  const [selectedBookingId, setSelectedBookingId] = useState<string>(
    bookings[0]?.bookingId || ''
  );
  const [selectedDepositId, setSelectedDepositId] = useState<string>(
    deposits[0]?.depositId || ''
  );
  const [copied, setCopied] = useState(false);

  const booking =
    bookings.find((b) => b.bookingId === selectedBookingId) ?? bookings[0] ?? null;
  const partner =
    (booking?.assignedPartnerId
      ? partners.find((p) => p.id === booking.assignedPartnerId)
      : partners.find((p) => p.status === 'DISETUJUI')) ?? null;
  const deposit =
    deposits.find((d) => d.depositId === selectedDepositId) ?? deposits[0] ?? null;

  const { previewText, targetPhoneIntl, targetLabel } = useMemo(() => {
    if (selectedTemplateId === 'PENAGIHAN_KOMISI_MINGGUAN') {
      return {
        previewText: deposit
          ? buildTemplatePenagihanKomisiMingguan(deposit)
          : 'Belum ada data setoran mingguan untuk dibuatkan pesan.',
        targetPhoneIntl: deposit?.partnerWhatsapp || ADMIN_WHATSAPP_INTL,
        targetLabel: deposit ? `Mitra (${deposit.partnerName})` : 'Mitra',
      };
    }

    if (!booking) {
      return {
        previewText: 'Belum ada data booking untuk template ini.',
        targetPhoneIntl: ADMIN_WHATSAPP_INTL,
        targetLabel: 'Admin TripKita',
      };
    }

    if (selectedTemplateId === 'PENAWARAN_ORDER_MITRA') {
      return {
        previewText: buildTemplatePenawaranMitra(booking, partner),
        targetPhoneIntl: partner?.whatsapp || ADMIN_WHATSAPP_INTL,
        targetLabel: partner
          ? `Mitra (${partner.fullName})`
          : 'Mitra (Belum Dipilih)',
      };
    }

    if (selectedTemplateId === 'KONFIRMASI_BOOKING_PELANGGAN') {
      return {
        previewText: buildTemplateKonfirmasiPelanggan(booking, partner),
        targetPhoneIntl: booking.customerPhone,
        targetLabel: `Pelanggan (${booking.customerName})`,
      };
    }

    return {
      previewText: buildTemplateBookingMasukAdmin(booking),
      targetPhoneIntl: ADMIN_WHATSAPP_INTL,
      targetLabel: 'Admin TripKita',
    };
  }, [selectedTemplateId, booking, partner, deposit]);

  const waUrl = buildWhatsAppUrl(previewText, targetPhoneIntl);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-5 bg-white rounded-2xl border border-emerald-950/10 p-5 space-y-4">
        <h2 className="font-display font-bold text-base text-forest-900 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-grab-600" />
          <span>Pilih Template &amp; Sumber Data</span>
        </h2>

        <div className="space-y-2">
          {WHATSAPP_TEMPLATE_LIST.map((tpl) => {
            const active = selectedTemplateId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  setSelectedTemplateId(tpl.id);
                  setCopied(false);
                }}
                className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                  active
                    ? 'bg-forest-900 border-forest-900 text-white'
                    : 'bg-forest-50/70 border-emerald-950/10 text-forest-900 hover:border-grab-500'
                }`}
              >
                <div className="font-display font-bold text-xs sm:text-sm">
                  {tpl.title}
                </div>
                <div
                  className={`mt-1 text-xs ${
                    active ? 'text-emerald-100' : 'text-slate-600'
                  }`}
                >
                  {tpl.description}
                </div>
              </button>
            );
          })}
        </div>

        {selectedTemplateId === 'PENAGIHAN_KOMISI_MINGGUAN' ? (
          <div>
            <label className="block text-xs font-semibold text-forest-900 mb-1.5">
              Pilih Tagihan Setoran Mingguan
            </label>
            <select
              value={selectedDepositId}
              onChange={(e) => setSelectedDepositId(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm focus:outline-none focus:border-grab-600"
            >
              {deposits.map((d) => (
                <option key={d.depositId} value={d.depositId}>
                  {d.depositId} — {d.partnerName} ({formatRupiah(d.remainingDueRp)})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-forest-900 mb-1.5">
              Pilih Data Booking Pelanggan
            </label>
            <select
              value={selectedBookingId}
              onChange={(e) => setSelectedBookingId(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm focus:outline-none focus:border-grab-600"
            >
              {bookings.map((b) => (
                <option key={b.bookingId} value={b.bookingId}>
                  {b.bookingCode} — {b.customerName} ({b.assignedPartnerName || 'Belum ada mitra'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="xl:col-span-7 bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <span className="text-xs text-slate-500 block">Tujuan Kirim</span>
            <strong className="font-display text-base text-forest-900">
              {targetLabel} ({targetPhoneIntl})
            </strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-forest-50 border border-slate-300 text-forest-900 font-display font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>{copied ? 'Pesan Tersalin' : 'Salin Pesan'}</span>
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] px-4 py-2 rounded-xl bg-grab-600 hover:bg-grab-700 text-white font-display font-bold text-xs inline-flex items-center gap-1.5"
            >
              <span>Kirim WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <pre className="p-4 rounded-xl bg-forest-50/75 border border-emerald-950/10 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
          {previewText}
        </pre>
      </div>
    </div>
  );
}

interface AdminReportsSectionProps {
  bookings: OperationalBookingRecord[];
  partners: PartnerRegistration[];
  deposits: WeeklyCommissionDeposit[];
  onImportBookings: (
    records: OperationalBookingRecord[]
  ) =>
    | { addedCount: number; skippedCount: number }
    | Promise<{ addedCount: number; skippedCount: number }>;
}

export function AdminReportsAndSheetsSection({
  bookings,
  partners,
  deposits,
  onImportBookings,
}: AdminReportsSectionProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [importFeedback, setImportFeedback] = useState<{
    addedCount: number;
    skippedCount: number;
    errors: string[];
  } | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const sheetsStatus = getGoogleSheetsConnectionStatus();
  const tabsPreview = useMemo(
    () => buildAllSixTabsPreview({ bookings, partners, deposits }),
    [bookings, partners, deposits]
  );

  const handleExportBookings = () => {
    const csv = buildBookingsCsv(bookings);
    triggerCsvDownload(`tripkita_booking_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const handleExportPartners = () => {
    const csv = buildPartnersCsv(partners);
    triggerCsvDownload(`tripkita_mitra_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const handleExportCommission = () => {
    const csv = buildCommissionCsv(bookings, deposits);
    triggerCsvDownload(`tripkita_komisi_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const handleExportPeriod = () => {
    const csv = buildPeriodReportCsv({
      startDate,
      endDate,
      bookings,
      partners,
      deposits,
    });
    triggerCsvDownload(
      `tripkita_laporan_periode_${startDate || 'semua'}_${endDate || 'semua'}.csv`,
      csv
    );
  };

  const handleFileImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseAndValidateBookingsCsvImport(text);
      if (parsed.validRecords.length === 0) {
        setImportFeedback({
          addedCount: 0,
          skippedCount: 0,
          errors: parsed.errors,
        });
        return;
      }
      const outcome = await onImportBookings(parsed.validRecords);
      setImportFeedback({
        addedCount: outcome.addedCount,
        skippedCount: outcome.skippedCount,
        errors: parsed.errors,
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleAdapterSync = async (tabName: GoogleSheetsTabName) => {
    const csvPayload =
      tabName === 'Mitra'
        ? buildPartnersCsv(partners)
        : tabName === 'Komisi'
          ? buildCommissionCsv(bookings, deposits)
          : buildBookingsCsv(bookings);
    const res = await syncTabViaGoogleSheetsAdapter({ tabName, csvPayload });
    setSyncMessage(res.message);
  };

  return (
    <div className="space-y-6">
      {/* Connection Status Banner */}
      <div
        className={`rounded-2xl border p-4 text-xs sm:text-sm flex items-start gap-3 ${
          sheetsStatus.endpointConfigured
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : 'bg-amber-50 border-amber-200 text-amber-950'
        }`}
      >
        <FileSpreadsheet className="w-5 h-5 shrink-0 mt-0.5 text-grab-700" />
        <div>
          <strong className="block">{sheetsStatus.label}</strong>
          <span className="mt-0.5 block">{sheetsStatus.description}</span>
        </div>
      </div>

      {/* 6 Tab Google Sheets Preview */}
      <div className="bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-6">
        <h2 className="font-display font-bold text-base text-forest-900">
          Struktur 6 Tab Operasional Google Sheets TripKita
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          Format ekspor CSV dan adapter sinkronisasi disiapkan agar langsung selaras dengan 6 tab kerja operasional admin.
        </p>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {GOOGLE_SHEETS_TABS.map((tab) => {
            const metric =
              tab === 'Dashboard'
                ? `${tabsPreview.Dashboard.totalBooking} ringkasan`
                : tab === 'Booking'
                  ? `${tabsPreview.Booking} baris`
                  : tab === 'Mitra'
                    ? `${tabsPreview.Mitra} mitra`
                    : tab === 'Penugasan'
                      ? `${tabsPreview.Penugasan} aktif`
                      : tab === 'Komisi'
                        ? formatRupiah(tabsPreview.Komisi)
                        : `${tabsPreview['Template WA']} template`;

            return (
              <div
                key={tab}
                className="p-3.5 rounded-xl bg-forest-50/75 border border-emerald-950/10 flex flex-col justify-between gap-2"
              >
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500">
                    Tab Sheet
                  </span>
                  <strong className="font-display text-sm text-forest-900">
                    {tab}
                  </strong>
                </div>
                <div className="text-xs font-bold text-grab-700 tabular-nums">
                  {metric}
                </div>
                <button
                  type="button"
                  onClick={() => void handleAdapterSync(tab)}
                  className="text-[11px] font-semibold text-forest-900 hover:underline text-left cursor-pointer"
                >
                  Cek Adapter Sinkron →
                </button>
              </div>
            );
          })}
        </div>

        {syncMessage && (
          <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>{syncMessage}</span>
          </div>
        )}
      </div>

      {/* Export & Period Report + CSV Import */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-6 space-y-4">
          <h3 className="font-display font-bold text-base text-forest-900">
            Ekspor CSV Siap Impor Google Sheets
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={handleExportBookings}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-forest-900 hover:bg-forest-800 text-white font-display font-bold text-xs inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Ekspor CSV Booking</span>
            </button>
            <button
              type="button"
              onClick={handleExportPartners}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-forest-900 hover:bg-forest-800 text-white font-display font-bold text-xs inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Ekspor CSV Mitra</span>
            </button>
            <button
              type="button"
              onClick={handleExportCommission}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-forest-900 hover:bg-forest-800 text-white font-display font-bold text-xs inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Ekspor CSV Komisi</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="text-xs font-display font-bold text-forest-900">
              Ekspor Laporan Operasional Per Periode
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="date"
                aria-label="Tanggal mulai periode"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-grab-600"
              />
              <input
                type="date"
                aria-label="Tanggal akhir periode"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-grab-600"
              />
              <button
                type="button"
                onClick={handleExportPeriod}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-grab-600 hover:bg-grab-700 text-white font-display font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Ekspor Laporan Periode</span>
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-6 space-y-4">
          <h3 className="font-display font-bold text-base text-forest-900">
            Impor Data Operasional (.CSV)
          </h3>
          <p className="text-xs text-slate-600">
            Mendukung berkas CSV hasil ekspor TripKita atau Google Sheets tab Booking dengan validasi kolom wajib dan pencegahan duplikasi kode booking.
          </p>

          <label className="w-full min-h-[84px] rounded-xl border-2 border-dashed border-emerald-700/30 bg-forest-50/50 hover:bg-emerald-50 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors">
            <Upload className="w-5 h-5 text-grab-600 mb-1.5" />
            <span className="text-xs font-display font-bold text-forest-900">
              Pilih Berkas CSV Booking untuk Diimpor
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void handleFileImport(e)}
              className="sr-only"
            />
          </label>

          {importFeedback && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-forest-900">
                <CheckCircle2 className="w-4 h-4 text-grab-600 shrink-0" />
                <span>
                  Ditambahkan: {importFeedback.addedCount} · Dilewati (duplikat):{' '}
                  {importFeedback.skippedCount}
                </span>
              </div>
              {importFeedback.errors.length > 0 && (
                <ul className="list-disc pl-5 text-red-700 space-y-0.5">
                  {importFeedback.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
