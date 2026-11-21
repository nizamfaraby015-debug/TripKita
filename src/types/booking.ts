export const ADMIN_WHATSAPP_DISPLAY = '082342400230';
export const ADMIN_WHATSAPP_INTL = '6282342400230';

// Internal business pricing rules (kept hidden from the public website UI)
export const INTERNAL_RATE_PER_KM = 6500;
export const INTERNAL_MINIMUM_FARE = 150000;

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface RouteMetrics {
  distanceMeters: number;
  durationMillis: number;
}

export interface BookingFormData {
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
}

export type BookingFormErrors = Partial<
  Record<'nama' | 'whatsapp' | 'penjemputan' | 'tujuan' | 'tanggal' | 'jam' | 'penumpang', string>
>;

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

export function buildWhatsAppMessage(
  data: BookingFormData,
  routeMetrics: RouteMetrics | null
): string {
  const formattedDate = formatIndonesianDate(data.tanggal);
  const catatanText = data.catatan.trim() ? data.catatan.trim() : '-';

  const lines = [
    'HALO ADMIN TRIPKITA',
    '',
    'Saya ingin melakukan booking kendaraan.',
    '',
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
    `Jumlah penumpang: ${data.penumpang.trim()} orang`,
    `Catatan: ${catatanText}`,
    '',
    'Mohon informasi ketersediaan kendaraan dan tarif perjalanan.'
  );

  return lines.join('\n');
}

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${ADMIN_WHATSAPP_INTL}?text=${encodeURIComponent(message)}`;
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
