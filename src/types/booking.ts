export const ADMIN_WHATSAPP_DISPLAY = '082342400230';
export const ADMIN_WHATSAPP_INTL = '6282342400230';

// Internal business pricing rules (kept strictly hidden from the public website UI)
export const INTERNAL_RATE_PER_KM = 6500;
export const INTERNAL_MINIMUM_FARE = 150000;
export const PLATFORM_COMMISSION_RATE = 0.1; // Komisi resmi TripKita 10% dari Tarif Jasa

export type TripType =
  | 'SEKALI_JALAN'
  | 'ANTAR_TUNGGU'
  | 'PULANG_PERGI'
  | 'CARTER'
  | 'RENTAL_SOPIR';

export type WaitMode = 'TUNGGU_DI_LOKASI' | 'JEMPUT_KEMBALI';

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  SEKALI_JALAN: 'Sekali Jalan',
  ANTAR_TUNGGU: 'Antar & Tunggu',
  PULANG_PERGI: 'Pulang Pergi (PP)',
  CARTER: 'Carter',
  RENTAL_SOPIR: 'Rental dengan Sopir',
};

export const WAIT_MODE_LABELS: Record<WaitMode, string> = {
  TUNGGU_DI_LOKASI: 'Sopir menunggu di lokasi',
  JEMPUT_KEMBALI: 'Sopir kembali menjemput sesuai jadwal',
};

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface RouteMetrics {
  distanceMeters: number;
  durationMillis: number;
}

export interface BookingFormData {
  jenisPerjalanan: TripType;
  nama: string;
  whatsapp: string;
  penjemputan: string;
  penjemputanCoord: LatLngLiteral | null;
  tujuan: string;
  tujuanCoord: LatLngLiteral | null;
  tanggal: string;
  jam: string;
  penumpang: string;
  catatan: string;
  // Khusus ANTAR_TUNGGU
  durasiTunggu: string;
  modeTunggu: WaitMode;
  tanggalSelesai: string;
  jamSelesai: string;
  // Khusus PULANG_PERGI
  tanggalPulang: string;
  jamPulang: string;
  lokasiPulang: string;
  // Khusus CARTER & RENTAL_SOPIR
  durasiPemakaian: string;
  keteranganKebutuhan: string;
}

export const INITIAL_BOOKING_FORM_DATA: BookingFormData = {
  jenisPerjalanan: 'SEKALI_JALAN',
  nama: '',
  whatsapp: '',
  penjemputan: '',
  penjemputanCoord: null,
  tujuan: '',
  tujuanCoord: null,
  tanggal: '',
  jam: '',
  penumpang: '1',
  catatan: '',
  durasiTunggu: '',
  modeTunggu: 'TUNGGU_DI_LOKASI',
  tanggalSelesai: '',
  jamSelesai: '',
  tanggalPulang: '',
  jamPulang: '',
  lokasiPulang: '',
  durasiPemakaian: '',
  keteranganKebutuhan: '',
};

export type BookingFormErrorKey =
  | 'nama'
  | 'whatsapp'
  | 'penjemputan'
  | 'tujuan'
  | 'tanggal'
  | 'jam'
  | 'penumpang'
  | 'durasiTunggu'
  | 'tanggalSelesai'
  | 'jamSelesai'
  | 'tanggalPulang'
  | 'jamPulang'
  | 'lokasiPulang'
  | 'durasiPemakaian'
  | 'keteranganKebutuhan';

export type BookingFormErrors = Partial<Record<BookingFormErrorKey, string>>;

export function calculateInternalFare(distanceMeters: number): number {
  const km = distanceMeters / 1000;
  return Math.max(INTERNAL_MINIMUM_FARE, Math.round(km * INTERNAL_RATE_PER_KM));
}

export function formatDistanceKm(distanceMeters: number): string {
  const km = distanceMeters / 1000;
  return `${km.toLocaleString('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km`;
}

export function formatDurationId(durationMillis: number): string {
  const totalMinutes = Math.max(1, Math.round(durationMillis / 60000));
  if (totalMinutes < 60) {
    return `${totalMinutes} menit`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours} jam ${mins} menit` : `${hours} jam`;
}

export function formatIndonesianDate(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  const monthIdx = Number(month) - 1;
  const monthName = monthNames[monthIdx] ?? month;
  return `${Number(day)} ${monthName} ${year}`;
}

export function buildTripDetailsSummaryLines(data: BookingFormData): string[] {
  const lines: string[] = [];
  if (data.jenisPerjalanan === 'ANTAR_TUNGGU') {
    lines.push(`Perkiraan Durasi Tunggu: ${data.durasiTunggu.trim() || '-'}`);
    lines.push(`Mode Penjemputan: ${WAIT_MODE_LABELS[data.modeTunggu]}`);
    lines.push(
      `Perkiraan Selesai: ${formatIndonesianDate(data.tanggalSelesai)} pukul ${data.jamSelesai.trim()}`
    );
  } else if (data.jenisPerjalanan === 'PULANG_PERGI') {
    lines.push(
      `Jadwal Pulang: ${formatIndonesianDate(data.tanggalPulang)} pukul ${data.jamPulang.trim()}`
    );
    lines.push(`Tujuan Perjalanan Pulang: ${data.lokasiPulang.trim() || '-'}`);
  } else if (
    data.jenisPerjalanan === 'CARTER' ||
    data.jenisPerjalanan === 'RENTAL_SOPIR'
  ) {
    lines.push(`Durasi Pemakaian: ${data.durasiPemakaian.trim() || '-'}`);
    lines.push(
      `Perkiraan Selesai: ${formatIndonesianDate(data.tanggalSelesai)} pukul ${data.jamSelesai.trim()}`
    );
    lines.push(`Kebutuhan Pelanggan: ${data.keteranganKebutuhan.trim() || '-'}`);
  }
  return lines;
}

export function buildWhatsAppMessage(
  data: BookingFormData,
  routeMetrics: RouteMetrics | null,
  bookingCode?: string
): string {
  const formattedDate = formatIndonesianDate(data.tanggal);
  const catatanText = data.catatan.trim() ? data.catatan.trim() : '-';
  const tripLabel = TRIP_TYPE_LABELS[data.jenisPerjalanan] || 'Sekali Jalan';

  const lines = [
    'HALO ADMIN TRIPKITA',
    '',
    'Saya ingin melakukan booking kendaraan.',
    '',
    ...(bookingCode ? [`Kode Booking: ${bookingCode}`] : []),
    `Jenis Perjalanan: ${tripLabel}`,
    `Nama: ${data.nama.trim()}`,
    `Nomor WhatsApp: ${data.whatsapp.trim()}`,
    `Penjemputan: ${data.penjemputan.trim()}`,
    `Tujuan: ${data.tujuan.trim()}`,
  ];

  if (routeMetrics && routeMetrics.distanceMeters > 0) {
    lines.push(
      `Estimasi Jarak: ${formatDistanceKm(routeMetrics.distanceMeters)} (${formatDurationId(
        routeMetrics.durationMillis
      )})`
    );
  }

  lines.push(
    `Tanggal: ${formattedDate}`,
    `Jam: ${data.jam.trim()}`,
    `Jumlah penumpang: ${data.penumpang.trim()} orang`
  );

  const extraLines = buildTripDetailsSummaryLines(data);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(
    `Catatan: ${catatanText}`,
    '',
    'Mohon informasi ketersediaan kendaraan dan tarif perjalanan.'
  );

  return lines.join('\n');
}

export function buildWhatsAppUrl(message: string, targetPhoneIntl = ADMIN_WHATSAPP_INTL): string {
  const cleanDigits = targetPhoneIntl.replace(/\D/g, '');
  const normalizedPhone = cleanDigits.startsWith('0')
    ? `62${cleanDigits.slice(1)}`
    : cleanDigits.startsWith('62')
      ? cleanDigits
      : `62${cleanDigits}`;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function getTodayLocalISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isQuotaExceededError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null
        ? JSON.stringify(err)
        : String(err);
  const upper = msg.toUpperCase();
  return (
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVER_QUERY_LIMIT') ||
    upper.includes('429') ||
    upper.includes('QUOTA')
  );
}

export type BookingStatus =
  | 'NEW'
  | 'CONFIRMED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

export type BookingSource = 'WEB_BOOKING_FORM' | 'IMPORT_CSV' | 'SEED_DEMO';

export type AssignmentStatus =
  | 'MENUNGGU_MITRA'
  | 'DITAWARKAN'
  | 'DITERIMA'
  | 'DITOLAK'
  | 'DITUGASKAN'
  | 'SELESAI';

export type CashPaymentStatus = 'BELUM_DIBAYAR' | 'PERLU_VERIFIKASI' | 'DIBAYAR';

export interface TripDetailsPayload {
  waitDuration?: string | null;
  waitMode?: WaitMode | null;
  estimatedEndDate?: string | null;
  estimatedEndTime?: string | null;
  returnDate?: string | null;
  returnTime?: string | null;
  returnDestination?: string | null;
  rentalDuration?: string | null;
  usageNeeds?: string | null;
}

export interface AssignmentHistoryEntry {
  timestamp: string;
  action: string;
  partnerId: string | null;
  partnerName: string | null;
  status: AssignmentStatus;
  note?: string;
}

export interface BookingDocument {
  bookingId: string;
  bookingCode: string;
  tripType: TripType;
  tripDetails: TripDetailsPayload;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  destinationAddress: string;
  pickupCoordinates: LatLngLiteral | null;
  destinationCoordinates: LatLngLiteral | null;
  travelDate: string;
  travelTime: string;
  passengerCount: number;
  distanceKm: number | null;
  estimatedDuration: string | null;
  customerNotes: string;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  assignedPartnerId: string | null;
  customerUid: string | null;
  createdAt: unknown;
  updatedAt: unknown;
  source: BookingSource;
}

export interface OperationalBookingRecord extends BookingDocument {
  createdAt: string;
  updatedAt: string;
  assignedPartnerName: string | null;
  assignmentStatus: AssignmentStatus;
  assignmentHistory: AssignmentHistoryEntry[];
  // Cash & internal accounting (hanya tampil di Dashboard Admin)
  internalEstimatedFareRp: number;
  agreedFareRp: number;
  tollFeeRp: number;
  parkingFeeRp: number;
  extraFeeRp: number;
  totalCashDueRp: number;
  cashPaymentStatus: CashPaymentStatus;
  partnerConfirmedCash: boolean;
  commissionRate: number;
  commissionAmountRp: number;
  adminConfirmedPartnerReady: boolean;
  cancellationReason?: string;
}
