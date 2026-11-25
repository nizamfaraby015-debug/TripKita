import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  ASSIGNMENT_STATUS_BADGE_MAP,
  BOOKING_STATUS_LABEL_MAP,
} from './adminBadges';
import {
  BookingStatus,
  OperationalBookingRecord,
  TRIP_TYPE_LABELS,
  TripType,
  WAIT_MODE_LABELS,
  formatIndonesianDate,
} from '../../types/booking';
import { PartnerRegistration } from '../../types/partner';
import { formatRupiah } from '../../services/partnerDemoService';

interface BookingFiltersState {
  search: string;
  date: string;
  status: 'ALL' | BookingStatus;
  tripType: 'ALL' | TripType;
  partnerId: 'ALL' | string;
}

interface BookingManagementSectionProps {
  bookings: OperationalBookingRecord[];
  approvedPartners: PartnerRegistration[];
  filters: BookingFiltersState;
  onFiltersChange: (next: BookingFiltersState) => void;
  onConfirmBooking: (
    bookingId: string,
    agreedFareRp: number
  ) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>;
  onCancelBooking: (bookingId: string, reason: string) => void;
  onDeleteBooking: (bookingId: string) => void | Promise<void>;
  onJumpToAssignment: (bookingId: string) => void;
}

export function AdminBookingsSection({
  bookings,
  approvedPartners,
  filters,
  onFiltersChange,
  onConfirmBooking,
  onCancelBooking,
  onDeleteBooking,
  onJumpToAssignment,
}: BookingManagementSectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    bookings[0]?.bookingId ?? null
  );
  const [fareInput, setFareInput] = useState<string>('');
  const [cancelReason, setCancelReason] = useState<string>('');
  const [confirmDeleteBookingId, setConfirmDeleteBookingId] = useState<string | null>(
    null
  );
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const filteredBookings = bookings.filter((b) => {
    if (filters.status !== 'ALL' && b.bookingStatus !== filters.status) return false;
    if (filters.tripType !== 'ALL' && b.tripType !== filters.tripType) return false;
    if (filters.date && b.travelDate !== filters.date) return false;
    if (
      filters.partnerId !== 'ALL' &&
      (b.assignedPartnerId || 'UNASSIGNED') !== filters.partnerId
    ) {
      return false;
    }
    const q = filters.search.trim().toLowerCase();
    if (!q) return true;
    return (
      b.bookingCode.toLowerCase().includes(q) ||
      b.customerName.toLowerCase().includes(q) ||
      b.pickupAddress.toLowerCase().includes(q) ||
      b.destinationAddress.toLowerCase().includes(q)
    );
  });

  const selectedBooking =
    filteredBookings.find((b) => b.bookingId === selectedId) ??
    filteredBookings[0] ??
    null;

  useEffect(() => {
    if (!selectedBooking) {
      setFareInput('');
      return;
    }
    setFareInput(
      String(
        selectedBooking.agreedFareRp > 0
          ? selectedBooking.agreedFareRp
          : selectedBooking.internalEstimatedFareRp
      )
    );
  }, [selectedBooking?.bookingId]);

  const handleSelectBooking = (b: OperationalBookingRecord) => {
    setSelectedId(b.bookingId);
    setFareInput(
      String(b.agreedFareRp > 0 ? b.agreedFareRp : b.internalEstimatedFareRp)
    );
    setCancelReason('');
    setConfirmDeleteBookingId(null);
    setFeedback(null);
  };

  const handleConfirmClick = async () => {
    if (!selectedBooking) return;
    const numericFare = Number(
      fareInput ||
        selectedBooking.agreedFareRp ||
        selectedBooking.internalEstimatedFareRp
    );
    const res = await onConfirmBooking(selectedBooking.bookingId, numericFare);
    if (res.ok) {
      setFeedback({
        type: 'success',
        text: `Booking ${selectedBooking.bookingCode} berhasil dikonfirmasi dengan tarif ${formatRupiah(
          numericFare
        )}.`,
      });
    } else {
      setFeedback({
        type: 'error',
        text: res.error || 'Gagal mengonfirmasi booking.',
      });
    }
  };

  const handleCancelClick = () => {
    if (!selectedBooking) return;
    onCancelBooking(
      selectedBooking.bookingId,
      cancelReason.trim() || 'Dibatalkan oleh admin TripKita'
    );
    setFeedback({
      type: 'success',
      text: `Booking ${selectedBooking.bookingCode} ditandai DIBATALKAN.`,
    });
    setCancelReason('');
  };

  const handleConfirmDeleteBooking = async (booking: OperationalBookingRecord) => {
    setDeletingBookingId(booking.bookingId);
    try {
      await onDeleteBooking(booking.bookingId);
      setConfirmDeleteBookingId(null);
      setSelectedId(null);
      setFeedback({
        type: 'success',
        text: `Booking ${booking.bookingCode} berhasil dihapus permanen.`,
      });
    } finally {
      setDeletingBookingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-emerald-950/10 p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Cari kode, nama, rute..."
              value={filters.search}
              onChange={(e) =>
                onFiltersChange({ ...filters, search: e.target.value })
              }
              className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-grab-600"
            />
          </div>

          <input
            type="date"
            aria-label="Filter tanggal keberangkatan"
            value={filters.date}
            onChange={(e) =>
              onFiltersChange({ ...filters, date: e.target.value })
            }
            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-grab-600"
          />

          <select
            aria-label="Filter status booking"
            value={filters.status}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                status: e.target.value as 'ALL' | BookingStatus,
              })
            }
            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm focus:outline-none focus:border-grab-600"
          >
            <option value="ALL">Semua Status Booking</option>
            <option value="NEW">Baru (NEW)</option>
            <option value="ASSIGNED">Ditugaskan (ASSIGNED)</option>
            <option value="CONFIRMED">Dikonfirmasi (CONFIRMED)</option>
            <option value="COMPLETED">Selesai (COMPLETED)</option>
            <option value="CANCELLED">Dibatalkan (CANCELLED)</option>
          </select>

          <select
            aria-label="Filter jenis perjalanan"
            value={filters.tripType}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                tripType: e.target.value as 'ALL' | TripType,
              })
            }
            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm focus:outline-none focus:border-grab-600"
          >
            <option value="ALL">Semua Jenis Perjalanan</option>
            {(Object.keys(TRIP_TYPE_LABELS) as TripType[]).map((type) => (
              <option key={type} value={type}>
                {TRIP_TYPE_LABELS[type]}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter mitra"
            value={filters.partnerId}
            onChange={(e) =>
              onFiltersChange({ ...filters, partnerId: e.target.value })
            }
            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm focus:outline-none focus:border-grab-600"
          >
            <option value="ALL">Semua Mitra</option>
            <option value="UNASSIGNED">Belum Ada Mitra</option>
            {approvedPartners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Booking List */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-emerald-950/10 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="font-display font-bold text-base text-forest-900">
              Daftar Booking ({filteredBookings.length})
            </h2>
            {(filters.date ||
              filters.status !== 'ALL' ||
              filters.tripType !== 'ALL' ||
              filters.partnerId !== 'ALL' ||
              filters.search) && (
              <button
                type="button"
                onClick={() =>
                  onFiltersChange({
                    search: '',
                    date: '',
                    status: 'ALL',
                    tripType: 'ALL',
                    partnerId: 'ALL',
                  })
                }
                className="text-xs font-semibold text-grab-600 hover:underline cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {filteredBookings.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Tidak ada data booking yang sesuai dengan filter.
              </p>
            ) : (
              filteredBookings.map((b) => {
                const isSelected = selectedBooking?.bookingId === b.bookingId;
                return (
                  <button
                    key={b.bookingId}
                    type="button"
                    onClick={() => handleSelectBooking(b)}
                    className={`w-full text-left py-3.5 px-3 rounded-xl transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      isSelected ? 'bg-forest-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-forest-900">
                          {b.bookingCode}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-forest-800">
                          {TRIP_TYPE_LABELS[b.tripType]}
                        </span>
                        <span className="text-xs font-semibold text-slate-900">
                          {b.customerName}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600 truncate">
                        {b.pickupAddress} → {b.destinationAddress}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {formatIndonesianDate(b.travelDate)} · {b.travelTime} ·{' '}
                        {b.passengerCount} org · Mitra:{' '}
                        <strong>{b.assignedPartnerName || 'Belum ada'}</strong>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-end gap-1 shrink-0">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-forest-900 text-[11px] font-bold">
                        {BOOKING_STATUS_LABEL_MAP[b.bookingStatus]}
                      </span>
                      <span className="text-xs font-bold text-grab-700 tabular-nums">
                        {b.agreedFareRp > 0
                          ? formatRupiah(b.agreedFareRp)
                          : `Est. ${formatRupiah(b.internalEstimatedFareRp)}`}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail & Konfirmasi Booking Panel */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-6">
          {selectedBooking ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <span className="font-mono text-xs text-slate-500">
                    {selectedBooking.bookingCode}
                  </span>
                  <h3 className="font-display font-extrabold text-lg text-forest-900">
                    {selectedBooking.customerName}
                  </h3>
                  <span className="text-xs text-slate-600">
                    WA: {selectedBooking.customerPhone}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-forest-900 text-white text-xs font-bold">
                  {BOOKING_STATUS_LABEL_MAP[selectedBooking.bookingStatus]}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-forest-50/80 border border-emerald-950/10 space-y-1.5 text-xs">
                <div className="font-display font-bold text-forest-900">
                  {TRIP_TYPE_LABELS[selectedBooking.tripType]}
                </div>
                <div>
                  <span className="text-slate-500">Jemput:</span>{' '}
                  <strong className="text-slate-900">
                    {selectedBooking.pickupAddress}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Tujuan:</span>{' '}
                  <strong className="text-slate-900">
                    {selectedBooking.destinationAddress}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Jadwal Berangkat:</span>{' '}
                  <strong>
                    {formatIndonesianDate(selectedBooking.travelDate)} pukul{' '}
                    {selectedBooking.travelTime}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Penumpang &amp; Jarak:</span>{' '}
                  {selectedBooking.passengerCount} orang
                  {selectedBooking.distanceKm
                    ? ` · ${selectedBooking.distanceKm.toFixed(1)} km (${
                        selectedBooking.estimatedDuration || '-'
                      })`
                    : ''}
                </div>

                {/* Detail Kondisional Jenis Perjalanan */}
                {selectedBooking.tripDetails.packageDetails && (
                  <div className="pt-1.5 mt-1.5 border-t border-emerald-950/10 space-y-1 text-forest-900">
                    <div>
                      <strong>Detail Paket &amp; Penerima:</strong>{' '}
                      {selectedBooking.tripDetails.packageDetails}
                    </div>
                  </div>
                )}

                {selectedBooking.tripType === 'ANTAR_TUNGGU' &&
                  (selectedBooking.tripDetails.waitDuration ||
                    selectedBooking.tripDetails.waitMode ||
                    selectedBooking.tripDetails.estimatedEndDate) && (
                    <div className="pt-1.5 mt-1.5 border-t border-emerald-950/10 space-y-1 text-forest-900">
                      {selectedBooking.tripDetails.waitDuration && (
                        <div>
                          <strong>Durasi Tunggu:</strong>{' '}
                          {selectedBooking.tripDetails.waitDuration}
                        </div>
                      )}
                      {selectedBooking.tripDetails.waitMode && (
                        <div>
                          <strong>Mode Tunggu:</strong>{' '}
                          {WAIT_MODE_LABELS[selectedBooking.tripDetails.waitMode]}
                        </div>
                      )}
                      {(selectedBooking.tripDetails.estimatedEndDate ||
                        selectedBooking.tripDetails.estimatedEndTime) && (
                        <div>
                          <strong>Perkiraan Selesai:</strong>{' '}
                          {formatIndonesianDate(
                            selectedBooking.tripDetails.estimatedEndDate || ''
                          )}{' '}
                          {selectedBooking.tripDetails.estimatedEndTime || ''}
                        </div>
                      )}
                    </div>
                  )}

                {selectedBooking.tripType === 'PULANG_PERGI' &&
                  (selectedBooking.tripDetails.returnDate ||
                    selectedBooking.tripDetails.returnTime ||
                    selectedBooking.tripDetails.returnDestination) && (
                    <div className="pt-1.5 mt-1.5 border-t border-emerald-950/10 space-y-1 text-forest-900">
                      {(selectedBooking.tripDetails.returnDate ||
                        selectedBooking.tripDetails.returnTime) && (
                        <div>
                          <strong>Jadwal Pulang (PP):</strong>{' '}
                          {formatIndonesianDate(
                            selectedBooking.tripDetails.returnDate || ''
                          )}{' '}
                          {selectedBooking.tripDetails.returnTime
                            ? `pukul ${selectedBooking.tripDetails.returnTime}`
                            : ''}
                        </div>
                      )}
                      {selectedBooking.tripDetails.returnDestination && (
                        <div>
                          <strong>Tujuan Pulang:</strong>{' '}
                          {selectedBooking.tripDetails.returnDestination}
                        </div>
                      )}
                    </div>
                  )}

                {(selectedBooking.tripType === 'CARTER' ||
                  selectedBooking.tripType === 'RENTAL_SOPIR') && (
                  <div className="pt-1.5 mt-1.5 border-t border-emerald-950/10 space-y-1 text-forest-900">
                    <div>
                      <strong>Durasi Pemakaian:</strong>{' '}
                      {selectedBooking.tripDetails.rentalDuration || '-'}
                    </div>
                    {(selectedBooking.tripDetails.estimatedEndDate ||
                      selectedBooking.tripDetails.estimatedEndTime) && (
                      <div>
                        <strong>Perkiraan Selesai:</strong>{' '}
                        {formatIndonesianDate(
                          selectedBooking.tripDetails.estimatedEndDate || ''
                        )}{' '}
                        {selectedBooking.tripDetails.estimatedEndTime || ''}
                      </div>
                    )}
                    {selectedBooking.tripDetails.usageNeeds && (
                      <div>
                        <strong>Kebutuhan Pelanggan:</strong>{' '}
                        {selectedBooking.tripDetails.usageNeeds}
                      </div>
                    )}
                  </div>
                )}

                {selectedBooking.customerNotes && (
                  <div className="pt-1 text-slate-600">
                    <strong>Catatan Pelanggan:</strong>{' '}
                    {selectedBooking.customerNotes}
                  </div>
                )}
              </div>

              {/* Estimasi Internal & Konfirmasi Akhir Admin */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    Estimasi Tarif Internal (Rp 6.500/km):
                  </span>
                  <strong className="text-forest-900 tabular-nums">
                    {formatRupiah(selectedBooking.internalEstimatedFareRp)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Mitra &amp; Penugasan:</span>
                  <strong className="text-forest-900">
                    {selectedBooking.assignedPartnerName || 'Belum dipilih'} (
                    {ASSIGNMENT_STATUS_BADGE_MAP[selectedBooking.assignmentStatus].label}
                    )
                  </strong>
                </div>

                {selectedBooking.bookingStatus !== 'CANCELLED' &&
                  selectedBooking.bookingStatus !== 'COMPLETED' && (
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <label
                        htmlFor="admin-agreed-fare"
                        className="block font-semibold text-forest-900"
                      >
                        Tarif Jasa Akhir Disepakati (Rp)
                      </label>
                      <input
                        id="admin-agreed-fare"
                        type="number"
                        min={0}
                        step={5000}
                        value={fareInput}
                        onChange={(e) => setFareInput(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold tabular-nums focus:outline-none focus:border-grab-600"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            onJumpToAssignment(selectedBooking.bookingId)
                          }
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-white hover:bg-forest-50 border border-slate-300 text-forest-900 font-display font-bold text-xs cursor-pointer"
                        >
                          Kelola Penugasan Mitra
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmClick}
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-grab-600 hover:bg-grab-700 text-white font-display font-bold text-xs cursor-pointer"
                        >
                          Setujui &amp; Konfirmasi
                        </button>
                      </div>
                    </div>
                  )}
              </div>

              {selectedBooking.bookingStatus !== 'CANCELLED' &&
                selectedBooking.bookingStatus !== 'COMPLETED' && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Batalkan Booking (jika diperlukan)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Alasan pembatalan..."
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-red-500"
                      />
                      <button
                        type="button"
                        onClick={handleCancelClick}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-display font-bold text-xs cursor-pointer shrink-0"
                      >
                        Batalkan
                      </button>
                    </div>
                  </div>
                )}

              <div className="pt-3 border-t border-slate-100">
                {confirmDeleteBookingId === selectedBooking.bookingId ? (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 space-y-2.5">
                    <p className="text-xs text-red-900 font-medium leading-relaxed">
                      Hapus permanen booking fiktif{' '}
                      <strong className="font-mono">{selectedBooking.bookingCode}</strong> (
                      {selectedBooking.customerName}) dari database? Tindakan ini tidak dapat dibatalkan.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={deletingBookingId === selectedBooking.bookingId}
                        onClick={() => void handleConfirmDeleteBooking(selectedBooking)}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-display font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {deletingBookingId === selectedBooking.bookingId
                            ? 'Menghapus...'
                            : 'Ya, Hapus Permanen'}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={deletingBookingId === selectedBooking.bookingId}
                        onClick={() => setConfirmDeleteBookingId(null)}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-display font-semibold text-xs cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteBookingId(selectedBooking.bookingId)}
                    className="w-full min-h-[38px] px-3 py-2 rounded-xl border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-700 font-display font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Hapus Booking Fiktif</span>
                  </button>
                )}
              </div>

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-950'
                      : 'bg-red-50 border border-red-200 text-red-900'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-grab-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.text}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">
              Pilih salah satu booking untuk melihat detail lengkap dan melakukan konfirmasi.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface AdminAssignmentSectionProps {
  bookings: OperationalBookingRecord[];
  approvedPartners: PartnerRegistration[];
  initialSelectedBookingId: string | null;
  onOfferPartner: (bookingId: string, partner: PartnerRegistration) => void;
  onRespondOffer: (
    bookingId: string,
    response: 'DITERIMA' | 'DITOLAK',
    note?: string
  ) => void;
  onIssueAssignment: (bookingId: string) => void;
  onCompleteTrip: (bookingId: string) => void;
}

export function AdminAssignmentSection({
  bookings,
  approvedPartners,
  initialSelectedBookingId,
  onOfferPartner,
  onRespondOffer,
  onIssueAssignment,
  onCompleteTrip,
}: AdminAssignmentSectionProps) {
  const [selectedBookingId, setSelectedBookingId] = useState<string>(
    initialSelectedBookingId || bookings[0]?.bookingId || ''
  );
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    approvedPartners[0]?.id || ''
  );
  const [partnerRejectNote, setPartnerRejectNote] = useState<string>('');

  const selectedBooking =
    bookings.find((b) => b.bookingId === selectedBookingId) ?? bookings[0] ?? null;

  const chosenPartner =
    approvedPartners.find((p) => p.id === selectedPartnerId) ??
    approvedPartners[0] ??
    null;
  const effectivePartnerId = chosenPartner?.id || '';

  return (
    <div className="space-y-5">
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-xs sm:text-sm text-forest-900 flex items-start gap-2.5">
        <ClipboardList className="w-5 h-5 text-grab-600 shrink-0 mt-0.5" />
        <div>
          <strong>Alur Penugasan Resmi (Admin Terpusat):</strong> Semua order masuk melalui admin (mitra tidak dapat mengambil order pelanggan secara langsung). Tawarkan ke mitra → Catat respon Mitra Terima/Tolak → Terbitkan Penugasan → Tandai Selesai. Jika mitra menolak/membatalkan, pilih mitra pengganti dan tawarkan ulang.
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Booking Queue */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-emerald-950/10 p-5">
          <h2 className="font-display font-bold text-base text-forest-900 pb-3 border-b border-slate-100">
            Antrean Penugasan Perjalanan
          </h2>
          <div className="mt-3 divide-y divide-slate-100">
            {bookings.map((b) => {
              const badge = ASSIGNMENT_STATUS_BADGE_MAP[b.assignmentStatus];
              const isSelected = selectedBooking?.bookingId === b.bookingId;
              return (
                <button
                  key={b.bookingId}
                  type="button"
                  onClick={() => setSelectedBookingId(b.bookingId)}
                  className={`w-full text-left py-3 px-3 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected ? 'bg-forest-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-forest-900">
                      {b.bookingCode} · {b.customerName}
                    </div>
                    <div className="text-xs text-slate-600 truncate">
                      {TRIP_TYPE_LABELS[b.tripType]} · {b.travelDate}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Mitra: {b.assignedPartnerName || 'Belum ada'}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Assignment Controls & Timeline */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-6">
          {selectedBooking ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <span className="font-mono text-xs text-slate-500">
                    {selectedBooking.bookingCode}
                  </span>
                  <h3 className="font-display font-extrabold text-lg text-forest-900">
                    {selectedBooking.pickupAddress} →{' '}
                    {selectedBooking.destinationAddress}
                  </h3>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    ASSIGNMENT_STATUS_BADGE_MAP[selectedBooking.assignmentStatus]
                      .className
                  }`}
                >
                  {
                    ASSIGNMENT_STATUS_BADGE_MAP[selectedBooking.assignmentStatus]
                      .label
                  }
                </span>
              </div>

              {/* Step 1: Offer / Reassign */}
              {selectedBooking.bookingStatus !== 'CANCELLED' &&
                selectedBooking.bookingStatus !== 'COMPLETED' && (
                  <div className="p-4 rounded-xl bg-forest-50/75 border border-emerald-950/10 space-y-3">
                    <div className="text-xs font-display font-bold text-forest-900">
                      1. Pilih &amp; Tawarkan ke Mitra Aktif (atau Ganti Mitra)
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <select
                        value={effectivePartnerId}
                        onChange={(e) => setSelectedPartnerId(e.target.value)}
                        className="flex-1 min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-forest-900 focus:outline-none focus:border-grab-600"
                      >
                        {approvedPartners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.fullName} — {p.vehicleBrandType} ({p.licensePlate})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!chosenPartner}
                        onClick={() => {
                          if (chosenPartner) {
                            onOfferPartner(selectedBooking.bookingId, chosenPartner);
                          }
                        }}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-forest-900 hover:bg-forest-800 disabled:opacity-50 text-white font-display font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        {selectedBooking.assignmentStatus === 'DITOLAK' ? (
                          <RefreshCw className="w-4 h-4" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span>
                          {selectedBooking.assignmentStatus === 'DITOLAK'
                            ? 'Tawarkan Mitra Pengganti'
                            : 'Tawarkan Order ke Mitra'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

              {/* Step 2: Record Partner Response */}
              {selectedBooking.assignedPartnerId &&
                selectedBooking.bookingStatus !== 'CANCELLED' &&
                selectedBooking.bookingStatus !== 'COMPLETED' && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="text-xs font-display font-bold text-forest-900">
                      2. Respon Mitra ({selectedBooking.assignedPartnerName})
                    </div>
                    <input
                      type="text"
                      placeholder="Catatan alasan jika mitra menolak / batal..."
                      value={partnerRejectNote}
                      onChange={(e) => setPartnerRejectNote(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:outline-none focus:border-grab-600"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onRespondOffer(selectedBooking.bookingId, 'DITERIMA')
                        }
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-grab-600 hover:bg-grab-700 text-white font-display font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Catat Mitra Terima</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onRespondOffer(
                            selectedBooking.bookingId,
                            'DITOLAK',
                            partnerRejectNote
                          );
                          setPartnerRejectNote('');
                        }}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-display font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Catat Mitra Tolak / Batal</span>
                      </button>
                      {selectedBooking.assignmentStatus === 'DITERIMA' && (
                        <button
                          type="button"
                          onClick={() =>
                            onIssueAssignment(selectedBooking.bookingId)
                          }
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-forest-900 hover:bg-forest-800 text-white font-display font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Terbitkan Penugasan Resmi (DITUGASKAN)</span>
                        </button>
                      )}
                      {(selectedBooking.assignmentStatus === 'DITUGASKAN' ||
                        selectedBooking.bookingStatus === 'CONFIRMED') && (
                        <button
                          type="button"
                          onClick={() =>
                            onCompleteTrip(selectedBooking.bookingId)
                          }
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-display font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Tandai Perjalanan SELESAI</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

              {/* Assignment History Log */}
              <div>
                <h4 className="font-display font-bold text-sm text-forest-900 mb-2.5 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-grab-600" />
                  <span>Riwayat Penugasan ({selectedBooking.assignmentHistory.length})</span>
                </h4>
                <div className="space-y-2">
                  {selectedBooking.assignmentHistory.map((entry, idx) => (
                    <div
                      key={`${entry.timestamp}-${idx}`}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                    >
                      <div>
                        <span className="font-semibold text-forest-900">
                          {entry.action}
                        </span>
                        {entry.note && (
                          <span className="block text-red-700 mt-0.5">
                            Catatan: {entry.note}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono shrink-0">
                        {entry.status} · {entry.timestamp.slice(0, 16).replace('T', ' ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">
              Belum ada booking untuk dikelola.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
