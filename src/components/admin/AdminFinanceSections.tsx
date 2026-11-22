import { FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Percent,
  Receipt,
  Wallet,
} from 'lucide-react';
import {
  CASH_STATUS_BADGE_MAP,
  DEPOSIT_STATUS_BADGE_MAP,
} from './adminBadges';
import {
  OperationalBookingRecord,
  TRIP_TYPE_LABELS,
  formatIndonesianDate,
} from '../../types/booking';
import {
  CommissionSettings,
  PartnerCommissionSummary,
  WeeklyCommissionDeposit,
} from '../../types/partner';
import {
  calculateCommission10Percent,
  formatRupiah,
} from '../../services/partnerDemoService';

interface AdminTransactionsSectionProps {
  bookings: OperationalBookingRecord[];
  onSaveTransaction: (
    bookingId: string,
    params: {
      agreedFareRp: number;
      tollFeeRp: number;
      parkingFeeRp: number;
      extraFeeRp: number;
      partnerConfirmedCash: boolean;
      adminVerifiedCash: boolean;
    }
  ) => void;
}

export function AdminTransactionsSection({
  bookings,
  onSaveTransaction,
}: AdminTransactionsSectionProps) {
  const [selectedId, setSelectedId] = useState<string>(
    bookings[0]?.bookingId || ''
  );

  const selected =
    bookings.find((b) => b.bookingId === selectedId) ?? bookings[0] ?? null;

  const [agreedFare, setAgreedFare] = useState('0');
  const [tollFee, setTollFee] = useState('0');
  const [parkingFee, setParkingFee] = useState('0');
  const [extraFee, setExtraFee] = useState('0');
  const [partnerConfirmed, setPartnerConfirmed] = useState(false);
  const [adminVerified, setAdminVerified] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    setAgreedFare(
      String(
        selected.agreedFareRp > 0
          ? selected.agreedFareRp
          : selected.internalEstimatedFareRp
      )
    );
    setTollFee(String(selected.tollFeeRp || 0));
    setParkingFee(String(selected.parkingFeeRp || 0));
    setExtraFee(String(selected.extraFeeRp || 0));
    setPartnerConfirmed(selected.partnerConfirmedCash);
    setAdminVerified(selected.cashPaymentStatus === 'DIBAYAR');
    setSavedNotice(null);
  }, [selected?.bookingId]);

  const fareNum = Math.max(0, Number(agreedFare) || 0);
  const tollNum = Math.max(0, Number(tollFee) || 0);
  const parkingNum = Math.max(0, Number(parkingFee) || 0);
  const extraNum = Math.max(0, Number(extraFee) || 0);
  const totalCash = fareNum + tollNum + parkingNum + extraNum;
  const previewCommission = calculateCommission10Percent(fareNum);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    onSaveTransaction(selected.bookingId, {
      agreedFareRp: fareNum,
      tollFeeRp: tollNum,
      parkingFeeRp: parkingNum,
      extraFeeRp: extraNum,
      partnerConfirmedCash: partnerConfirmed,
      adminVerifiedCash: partnerConfirmed ? adminVerified : false,
    });
    setSavedNotice(
      `Pencatatan cash untuk ${selected.bookingCode} berhasil diperbarui.`
    );
  };

  return (
    <div className="space-y-5">
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-xs sm:text-sm text-forest-900 flex items-start gap-2.5">
        <Banknote className="w-5 h-5 text-grab-600 shrink-0 mt-0.5" />
        <div>
          <strong>Sistem Pembayaran Cash Langsung ke Mitra:</strong> Pelanggan membayar tunai langsung ke mitra di lapangan. Mitra wajib mengonfirmasi penerimaan cash sebelum admin menandai transaksi berstatus <strong>DIBAYAR</strong>. Biaya tol, parkir, dan pengeluaran tambahan tidak dikenakan komisi 10%.
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 bg-white rounded-2xl border border-emerald-950/10 p-5">
          <h2 className="font-display font-bold text-base text-forest-900 pb-3 border-b border-slate-100">
            Rekap Transaksi Cash Per Booking
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-3 font-semibold">Kode</th>
                  <th className="py-2 pr-3 font-semibold">Mitra</th>
                  <th className="py-2 pr-3 font-semibold text-right">Tarif Jasa</th>
                  <th className="py-2 pr-3 font-semibold text-right">Tol/Parkir/+</th>
                  <th className="py-2 pr-3 font-semibold text-right">Total Cash</th>
                  <th className="py-2 font-semibold">Status Cash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => {
                  const badge = CASH_STATUS_BADGE_MAP[b.cashPaymentStatus];
                  const isSel = selected?.bookingId === b.bookingId;
                  const extraSum = b.tollFeeRp + b.parkingFeeRp + b.extraFeeRp;
                  return (
                    <tr
                      key={b.bookingId}
                      onClick={() => setSelectedId(b.bookingId)}
                      className={`cursor-pointer transition-colors ${
                        isSel ? 'bg-forest-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 pr-3 font-mono text-xs font-bold text-forest-900 whitespace-nowrap">
                        {b.bookingCode}
                        <span className="block font-sans font-normal text-[11px] text-slate-500">
                          {TRIP_TYPE_LABELS[b.tripType]}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-800 whitespace-nowrap">
                        {b.assignedPartnerName || '-'}
                      </td>
                      <td className="py-3 pr-3 text-right font-semibold tabular-nums whitespace-nowrap">
                        {formatRupiah(b.agreedFareRp)}
                      </td>
                      <td className="py-3 pr-3 text-right text-slate-600 tabular-nums whitespace-nowrap">
                        {formatRupiah(extraSum)}
                      </td>
                      <td className="py-3 pr-3 text-right font-bold text-forest-900 tabular-nums whitespace-nowrap">
                        {formatRupiah(b.totalCashDueRp)}
                      </td>
                      <td className="py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-5 bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-6">
          {selected ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <span className="font-mono text-xs text-slate-500">
                  {selected.bookingCode}
                </span>
                <h3 className="font-display font-bold text-base text-forest-900">
                  Input Rincian Cash — {selected.customerName}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Tarif Jasa (Dasar Komisi 10%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={5000}
                    value={agreedFare}
                    onChange={(e) => setAgreedFare(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold tabular-nums focus:outline-none focus:border-grab-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Biaya Tol (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={tollFee}
                    onChange={(e) => setTollFee(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-sm tabular-nums focus:outline-none focus:border-grab-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Biaya Parkir (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={parkingFee}
                    onChange={(e) => setParkingFee(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-sm tabular-nums focus:outline-none focus:border-grab-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-forest-900 mb-1">
                    Biaya Tambahan (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={extraFee}
                    onChange={(e) => setExtraFee(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-sm tabular-nums focus:outline-none focus:border-grab-600"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-forest-50 border border-emerald-950/10 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Cash Dibayar Pelanggan:</span>
                  <strong className="text-sm text-forest-900 tabular-nums">
                    {formatRupiah(totalCash)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Komisi Platform 10% (Tarif Jasa):</span>
                  <strong className="text-sm text-grab-700 tabular-nums">
                    {formatRupiah(previewCommission)}
                  </strong>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={partnerConfirmed}
                    onChange={(e) => {
                      setPartnerConfirmed(e.target.checked);
                      if (!e.target.checked) setAdminVerified(false);
                    }}
                    className="mt-0.5 accent-grab-600"
                  />
                  <span>
                    <strong className="text-forest-900 block">
                      Mitra Sudah Konfirmasi Terima Cash
                    </strong>
                    <span className="text-slate-600">
                      Status berubah menjadi <em>PERLU_VERIFIKASI</em> jika mitra sudah mengonfirmasi penerimaan tunai.
                    </span>
                  </span>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-3 rounded-xl border ${
                    partnerConfirmed
                      ? 'border-emerald-200 bg-emerald-50/50 cursor-pointer'
                      : 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!partnerConfirmed}
                    checked={partnerConfirmed && adminVerified}
                    onChange={(e) => setAdminVerified(e.target.checked)}
                    className="mt-0.5 accent-grab-600"
                  />
                  <span>
                    <strong className="text-forest-900 block">
                      Admin Verifikasi Cash Lunas (DIBAYAR)
                    </strong>
                    <span className="text-slate-600">
                      Hanya dapat dicentang setelah ada konfirmasi penerimaan cash dari mitra.
                    </span>
                  </span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-forest-900 hover:bg-forest-800 text-white font-display font-bold text-xs sm:text-sm cursor-pointer transition-colors"
              >
                Simpan Rincian Transaksi Cash
              </button>

              {savedNotice && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-grab-600 shrink-0" />
                  <span>{savedNotice}</span>
                </div>
              )}
            </form>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">
              Pilih booking untuk mencatat transaksi cash.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface AdminCommissionSectionProps {
  summaries: PartnerCommissionSummary[];
  commissionSettings: CommissionSettings;
  onSaveMinFee: (minFeeRp: number) => void;
  onCreateBillForPartner: (partner: PartnerCommissionSummary) => void;
}

export function AdminCommissionSection({
  summaries,
  commissionSettings,
  onSaveMinFee,
  onCreateBillForPartner,
}: AdminCommissionSectionProps) {
  const [minFeeInput, setMinFeeInput] = useState(
    String(commissionSettings.minimumPlatformFeeRp)
  );
  const [savedFlag, setSavedFlag] = useState(false);

  useEffect(() => {
    setMinFeeInput(String(commissionSettings.minimumPlatformFeeRp));
  }, [commissionSettings.minimumPlatformFeeRp]);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    onSaveMinFee(Math.max(0, Number(minFeeInput) || 0));
    setSavedFlag(true);
    setTimeout(() => setSavedFlag(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-forest-900 mb-2">
            <Percent className="w-5 h-5 text-grab-600" />
            <h2 className="font-display font-bold text-base">
              Aturan Resmi Komisi TripKita: 10%
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Komisi platform TripKita resmi sebesar <strong>10% dari Tarif Jasa</strong> untuk setiap booking berstatus <strong>SELESAI</strong> (dihitung satu kali per booking). Biaya tol, parkir, dan biaya tambahan di luar tarif jasa tidak dipotong komisi.
          </p>

          <form onSubmit={handleSave} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-forest-900 mb-1">
                Persentase Komisi Resmi
              </label>
              <input
                type="text"
                readOnly
                value="10% (Tarif Jasa — Tetap)"
                className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-forest-900"
              />
            </div>
            <div>
              <label
                htmlFor="comm-min-fee"
                className="block text-xs font-semibold text-forest-900 mb-1"
              >
                Catatan Biaya Minimum Referensi (Rp)
              </label>
              <input
                id="comm-min-fee"
                type="number"
                min={0}
                step={5000}
                value={minFeeInput}
                onChange={(e) => setMinFeeInput(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold tabular-nums focus:outline-none focus:border-grab-600"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="min-h-[40px] px-4 py-2 rounded-xl bg-forest-900 hover:bg-forest-800 text-white font-display font-bold text-xs cursor-pointer"
              >
                Simpan Pengaturan
              </button>
              {savedFlag && (
                <span className="text-xs font-semibold text-grab-700 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Tersimpan
                </span>
              )}
            </div>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-6">
          <h2 className="font-display font-bold text-base text-forest-900 pb-3 border-b border-slate-100">
            Rekap Komisi 10% Per Mitra (Booking Selesai)
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-3 font-semibold">Mitra</th>
                  <th className="py-2 pr-3 font-semibold text-right">Order Selesai</th>
                  <th className="py-2 pr-3 font-semibold text-right">Total Tarif Jasa</th>
                  <th className="py-2 pr-3 font-semibold text-right">Komisi 10%</th>
                  <th className="py-2 pr-3 font-semibold text-right">Belum Disetor</th>
                  <th className="py-2 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaries.map((s) => (
                  <tr key={s.partnerId} className="hover:bg-forest-50/40">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-forest-900">
                        {s.partnerName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {s.vehicleLabel}
                      </div>
                      {s.bookingCodes.length > 0 && (
                        <div className="text-[10px] font-mono text-slate-400">
                          {s.bookingCodes.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {s.completedBookingsCount}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums whitespace-nowrap">
                      {formatRupiah(s.totalServiceFareRp)}
                    </td>
                    <td className="py-3 pr-3 text-right font-bold text-forest-900 tabular-nums whitespace-nowrap">
                      {formatRupiah(s.totalCommission10PercentRp)}
                    </td>
                    <td className="py-3 pr-3 text-right font-bold text-amber-800 tabular-nums whitespace-nowrap">
                      {formatRupiah(s.unpaidDepositRp)}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {s.unpaidDepositRp > 0 ? (
                        <button
                          type="button"
                          onClick={() => onCreateBillForPartner(s)}
                          className="min-h-[32px] px-2.5 py-1 rounded-lg bg-grab-600 hover:bg-grab-700 text-white font-display font-bold text-[11px] cursor-pointer"
                        >
                          Buat Setoran
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Lunas</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AdminWeeklyDepositsSectionProps {
  deposits: WeeklyCommissionDeposit[];
  summaries: PartnerCommissionSummary[];
  onCreateDeposit: (params: {
    partner: PartnerCommissionSummary;
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    dueDate: string;
  }) => void;
  onSubmitProof: (
    depositId: string,
    transferProofRef: string,
    paidAmountRp: number,
    transferNote: string
  ) => void;
  onVerifyDeposit: (depositId: string) => void;
}

export function AdminWeeklyDepositsSection({
  deposits,
  summaries,
  onCreateDeposit,
  onSubmitProof,
  onVerifyDeposit,
}: AdminWeeklyDepositsSectionProps) {
  const [selectedDepositId, setSelectedDepositId] = useState<string>(
    deposits[0]?.depositId || ''
  );
  const [proofRef, setProofRef] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');

  // Create new weekly deposit form
  const [newPartnerId, setNewPartnerId] = useState(
    summaries.find((s) => s.unpaidDepositRp > 0)?.partnerId ||
      summaries[0]?.partnerId ||
      ''
  );
  const [periodLabel, setPeriodLabel] = useState('Minggu Berjalan');
  const [periodStart, setPeriodStart] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [periodEnd, setPeriodEnd] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));

  const selectedDeposit =
    deposits.find((d) => d.depositId === selectedDepositId) ??
    deposits[0] ??
    null;

  useEffect(() => {
    if (!selectedDeposit) return;
    setProofRef(selectedDeposit.transferProofRef || '');
    setPaidAmount(
      String(
        selectedDeposit.paidAmountRp > 0
          ? selectedDeposit.paidAmountRp
          : selectedDeposit.totalCommissionRp
      )
    );
    setTransferNote(selectedDeposit.transferNote || '');
  }, [selectedDeposit?.depositId]);

  const effectiveNewPartnerId = summaries.some((s) => s.partnerId === newPartnerId)
    ? newPartnerId
    : summaries.find((s) => s.unpaidDepositRp > 0)?.partnerId ||
      summaries[0]?.partnerId ||
      '';

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    const target = summaries.find((s) => s.partnerId === effectiveNewPartnerId);
    if (!target) return;
    onCreateDeposit({
      partner: target,
      periodLabel,
      periodStart,
      periodEnd,
      dueDate,
    });
  };

  const handleSubmitProofForm = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDeposit) return;
    onSubmitProof(
      selectedDeposit.depositId,
      proofRef,
      Number(paidAmount) || selectedDeposit.totalCommissionRp,
      transferNote
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs sm:text-sm text-amber-950 flex items-start gap-2.5">
        <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong>Catatan Keamanan Demo:</strong> Input bukti transfer hanya mencatat <strong>nomor referensi / nama berkas teks</strong> (tidak menyimpan foto struk/dokumen sensitif ke <code>localStorage</code>).
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Deposit History Table */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-emerald-950/10 p-5 space-y-5">
          <div>
            <h2 className="font-display font-bold text-base text-forest-900 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-grab-600" />
              <span>Daftar Setoran Mingguan Mitra</span>
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-3 font-semibold">ID &amp; Mitra</th>
                    <th className="py-2 pr-3 font-semibold">Jatuh Tempo</th>
                    <th className="py-2 pr-3 font-semibold text-right">Komisi 10%</th>
                    <th className="py-2 pr-3 font-semibold text-right">Sisa</th>
                    <th className="py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deposits.map((dep) => {
                    const badge = DEPOSIT_STATUS_BADGE_MAP[dep.status];
                    const isSel = selectedDeposit?.depositId === dep.depositId;
                    return (
                      <tr
                        key={dep.depositId}
                        onClick={() => setSelectedDepositId(dep.depositId)}
                        className={`cursor-pointer transition-colors ${
                          isSel ? 'bg-forest-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 pr-3">
                          <div className="font-mono text-xs font-bold text-forest-900">
                            {dep.depositId} · {dep.partnerName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {dep.periodLabel} ({dep.bookingCodes.length} booking)
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-xs text-slate-700 whitespace-nowrap">
                          {formatIndonesianDate(dep.dueDate)}
                        </td>
                        <td className="py-3 pr-3 text-right font-semibold tabular-nums whitespace-nowrap">
                          {formatRupiah(dep.totalCommissionRp)}
                        </td>
                        <td className="py-3 pr-3 text-right font-bold text-amber-800 tabular-nums whitespace-nowrap">
                          {formatRupiah(dep.remainingDueRp)}
                        </td>
                        <td className="py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create New Deposit Form */}
          <form
            onSubmit={handleCreate}
            className="pt-4 border-t border-slate-100 space-y-3"
          >
            <div className="text-xs font-display font-bold text-forest-900 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-grab-600" />
              <span>Terbitkan Tagihan Setoran Mingguan Baru</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={effectiveNewPartnerId}
                onChange={(e) => setNewPartnerId(e.target.value)}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm focus:outline-none focus:border-grab-600"
              >
                {summaries.map((s) => (
                  <option key={s.partnerId} value={s.partnerId}>
                    {s.partnerName} (Sisa: {formatRupiah(s.unpaidDepositRp)})
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Label Periode (mis. Pekan 4 Nov)"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-grab-600"
              />
              <input
                type="date"
                aria-label="Mulai periode"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-grab-600"
              />
              <input
                type="date"
                aria-label="Jatuh tempo setoran"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setPeriodEnd(e.target.value);
                }}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-grab-600"
              />
            </div>
            <button
              type="submit"
              className="min-h-[40px] px-4 py-2 rounded-xl bg-forest-900 hover:bg-forest-800 text-white font-display font-bold text-xs cursor-pointer"
            >
              Buat Tagihan Setoran
            </button>
          </form>
        </div>

        {/* Right: Proof & Admin Verification */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-6">
          {selectedDeposit ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <span className="font-mono text-xs text-slate-500">
                    {selectedDeposit.depositId}
                  </span>
                  <h3 className="font-display font-bold text-base text-forest-900">
                    {selectedDeposit.partnerName}
                  </h3>
                  <span className="text-xs text-slate-600">
                    {selectedDeposit.periodLabel} · Jatuh tempo{' '}
                    {formatIndonesianDate(selectedDeposit.dueDate)}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                    DEPOSIT_STATUS_BADGE_MAP[selectedDeposit.status].className
                  }`}
                >
                  {DEPOSIT_STATUS_BADGE_MAP[selectedDeposit.status].label}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-forest-50 border border-emerald-950/10 space-y-1 text-xs">
                <div>
                  <strong>Booking Terhitung:</strong>{' '}
                  <span className="font-mono">
                    {selectedDeposit.bookingCodes.join(', ') || '-'}
                  </span>
                </div>
                <div>
                  <strong>Total Tarif Jasa:</strong>{' '}
                  {formatRupiah(selectedDeposit.totalServiceFareRp)}
                </div>
                <div>
                  <strong>Total Komisi (10%):</strong>{' '}
                  <span className="font-bold text-forest-900">
                    {formatRupiah(selectedDeposit.totalCommissionRp)}
                  </span>
                </div>
                <div>
                  <strong>Sudah Disetor:</strong>{' '}
                  {formatRupiah(selectedDeposit.paidAmountRp)}
                </div>
              </div>

              <form onSubmit={handleSubmitProofForm} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-forest-900 mb-1">
                    Nomor Referensi Transfer / Nama File (Teks)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: TRF-BCA-20261121-009"
                    value={proofRef}
                    onChange={(e) => setProofRef(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-grab-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-forest-900 mb-1">
                    Nominal Ditransfer (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold tabular-nums focus:outline-none focus:border-grab-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-forest-900 mb-1">
                    Catatan Transfer
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Transfer via BCA Mobile a.n. Mitra"
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-grab-600"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="submit"
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-white hover:bg-forest-50 border border-slate-300 text-forest-900 font-display font-bold text-xs cursor-pointer"
                  >
                    Catat Bukti Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => onVerifyDeposit(selectedDeposit.depositId)}
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-grab-600 hover:bg-grab-700 text-white font-display font-bold text-xs cursor-pointer"
                  >
                    Tandai Sudah Diverifikasi
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">
              Pilih data setoran untuk melihat detail atau verifikasi transfer.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
