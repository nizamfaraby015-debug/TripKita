import {
  OperationalBookingRecord,
  TRIP_TYPE_LABELS,
  WAIT_MODE_LABELS,
  formatIndonesianDate,
} from '../types/booking';
import { PartnerRegistration, WeeklyCommissionDeposit } from '../types/partner';
import { formatRupiah } from './partnerDemoService';

export type WhatsAppTemplateId =
  | 'BOOKING_MASUK_ADMIN'
  | 'PENAWARAN_ORDER_MITRA'
  | 'KONFIRMASI_BOOKING_PELANGGAN'
  | 'PENAGIHAN_KOMISI_MINGGUAN';

export interface WhatsAppTemplateMeta {
  id: WhatsAppTemplateId;
  title: string;
  description: string;
  recipientLabel: string;
}

export const WHATSAPP_TEMPLATE_LIST: WhatsAppTemplateMeta[] = [
  {
    id: 'BOOKING_MASUK_ADMIN',
    title: '1. Booking Masuk Admin',
    description: 'Ringkasan order baru pelanggan lengkap dengan jenis perjalanan dan jadwal.',
    recipientLabel: 'Admin TripKita',
  },
  {
    id: 'PENAWARAN_ORDER_MITRA',
    title: '2. Penawaran Order kepada Mitra',
    description: 'Pesan penawaran resmi dari admin kepada mitra sebelum ditugaskan.',
    recipientLabel: 'Mitra Terpilih',
  },
  {
    id: 'KONFIRMASI_BOOKING_PELANGGAN',
    title: '3. Konfirmasi Booking kepada Pelanggan',
    description: 'Konfirmasi tarif akhir, detail unit mitra, dan instruksi bayar cash ke mitra.',
    recipientLabel: 'Pelanggan',
  },
  {
    id: 'PENAGIHAN_KOMISI_MINGGUAN',
    title: '4. Penagihan Komisi Mingguan',
    description: 'Rekap setoran komisi 10% mingguan lengkap dengan daftar booking selesai.',
    recipientLabel: 'Mitra (Mingguan)',
  },
];

function buildTripDetailLinesForBooking(b: OperationalBookingRecord): string[] {
  const lines: string[] = [];
  if (b.tripType === 'ANTAR_TUNGGU') {
    if (b.tripDetails.waitDuration) {
      lines.push(`Perkiraan Durasi Tunggu: ${b.tripDetails.waitDuration}`);
    }
    if (b.tripDetails.waitMode) {
      lines.push(`Mode Tunggu: ${WAIT_MODE_LABELS[b.tripDetails.waitMode]}`);
    }
    if (b.tripDetails.estimatedEndDate || b.tripDetails.estimatedEndTime) {
      lines.push(
        `Perkiraan Selesai: ${formatIndonesianDate(b.tripDetails.estimatedEndDate || '')} ${
          b.tripDetails.estimatedEndTime || ''
        }`.trim()
      );
    }
  } else if (b.tripType === 'PULANG_PERGI') {
    if (b.tripDetails.returnDate || b.tripDetails.returnTime) {
      lines.push(
        `Jadwal Pulang (PP): ${formatIndonesianDate(b.tripDetails.returnDate || '')}${
          b.tripDetails.returnTime ? ` pukul ${b.tripDetails.returnTime}` : ''
        }`.trim()
      );
    }
    if (b.tripDetails.returnDestination) {
      lines.push(`Tujuan Pulang: ${b.tripDetails.returnDestination}`);
    }
  } else if (b.tripType === 'CARTER' || b.tripType === 'RENTAL_SOPIR') {
    lines.push(`Durasi Pemakaian: ${b.tripDetails.rentalDuration || '-'}`);
    if (b.tripDetails.estimatedEndDate || b.tripDetails.estimatedEndTime) {
      lines.push(
        `Perkiraan Selesai: ${formatIndonesianDate(b.tripDetails.estimatedEndDate || '')} ${
          b.tripDetails.estimatedEndTime || ''
        }`.trim()
      );
    }
    if (b.tripDetails.usageNeeds) {
      lines.push(`Kebutuhan: ${b.tripDetails.usageNeeds}`);
    }
  }
  return lines;
}

export function buildTemplateBookingMasukAdmin(
  booking: OperationalBookingRecord
): string {
  const tripLabel = TRIP_TYPE_LABELS[booking.tripType];
  const extraLines = buildTripDetailLinesForBooking(booking);

  return [
    'BOOKING MASUK ADMIN — TRIPKITA',
    '',
    `Kode Booking: ${booking.bookingCode}`,
    `Jenis Perjalanan: ${tripLabel}`,
    `Nama Pelanggan: ${booking.customerName}`,
    `WhatsApp Pelanggan: ${booking.customerPhone}`,
    `Penjemputan: ${booking.pickupAddress}`,
    `Tujuan: ${booking.destinationAddress}`,
    booking.distanceKm ? `Estimasi Jarak: ${booking.distanceKm.toFixed(1)} km (${booking.estimatedDuration || '-'})` : null,
    `Tanggal Berangkat: ${formatIndonesianDate(booking.travelDate)}`,
    `Jam Jemput: ${booking.travelTime}`,
    `Penumpang: ${booking.passengerCount} orang`,
    ...extraLines,
    `Catatan: ${booking.customerNotes || '-'}`,
    '',
    'Status: Menunggu pengecekan ketersediaan mitra dan konfirmasi tarif oleh Admin.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

export function buildTemplatePenawaranMitra(
  booking: OperationalBookingRecord,
  partner: PartnerRegistration | null
): string {
  const tripLabel = TRIP_TYPE_LABELS[booking.tripType];
  const extraLines = buildTripDetailLinesForBooking(booking);
  const partnerName = partner?.fullName || booking.assignedPartnerName || 'Mitra TripKita';

  return [
    `PENAWARAN ORDER TRIPKITA — HALO ${partnerName.toUpperCase()}`,
    '',
    'Admin TripKita menawarkan perjalanan berikut:',
    `Kode Booking: ${booking.bookingCode}`,
    `Jenis Perjalanan: ${tripLabel}`,
    `Rute Jemput: ${booking.pickupAddress}`,
    `Rute Tujuan: ${booking.destinationAddress}`,
    booking.distanceKm ? `Estimasi Jarak: ${booking.distanceKm.toFixed(1)} km` : null,
    `Jadwal: ${formatIndonesianDate(booking.travelDate)} pukul ${booking.travelTime}`,
    `Jumlah Penumpang: ${booking.passengerCount} orang`,
    ...extraLines,
    `Catatan Pelanggan: ${booking.customerNotes || '-'}`,
    booking.agreedFareRp > 0
      ? `Penawaran Tarif Jasa: ${formatRupiah(booking.agreedFareRp)} (Cash langsung dari pelanggan)`
      : 'Tarif Jasa: Akan dikonfirmasi bersama admin',
    '',
    'Mohon balas *TERIMA* atau *TOLAK* beserta konfirmasi kesiapan armada Anda.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

export function buildTemplateKonfirmasiPelanggan(
  booking: OperationalBookingRecord,
  partner: PartnerRegistration | null
): string {
  const tripLabel = TRIP_TYPE_LABELS[booking.tripType];
  const extraLines = buildTripDetailLinesForBooking(booking);
  const vehicleInfo = partner
    ? `${partner.vehicleBrandType} (${partner.licensePlate})`
    : 'Akan diinformasikan';
  const partnerName = partner?.fullName || booking.assignedPartnerName || 'Mitra TripKita';
  const fareText =
    booking.agreedFareRp > 0
      ? formatRupiah(booking.agreedFareRp)
      : '(Harap isi Tarif Jasa Disepakati di Dashboard Admin terlebih dahulu)';

  return [
    'KONFIRMASI BOOKING TRIPKITA',
    '',
    `Halo Bapak/Ibu ${booking.customerName}, pesanan perjalanan Anda telah *DIKONFIRMASI*.`,
    '',
    `Kode Booking: ${booking.bookingCode}`,
    `Jenis Perjalanan: ${tripLabel}`,
    `Rute: ${booking.pickupAddress} → ${booking.destinationAddress}`,
    `Jadwal Jemput: ${formatIndonesianDate(booking.travelDate)} pukul ${booking.travelTime}`,
    ...extraLines,
    '',
    `Mitra / Pengemudi: ${partnerName}`,
    `Kendaraan: ${vehicleInfo}`,
    `Tarif Jasa Disepakati: ${fareText}`,
    '',
    'INSTRUKSI PEMBAYARAN:',
    '- Pembayaran dilakukan secara *CASH langsung kepada mitra/pengemudi* saat perjalanan.',
    '- Biaya tol, parkir, atau pengeluaran tambahan di luar tarif jasa dibayarkan terpisah sesuai bukti di lapangan.',
    '',
    'Terima kasih telah memilih TripKita — Teman Perjalanan Anda.',
  ].join('\n');
}

export function buildTemplatePenagihanKomisiMingguan(
  deposit: WeeklyCommissionDeposit
): string {
  const bookingList =
    deposit.bookingCodes.length > 0 ? deposit.bookingCodes.join(', ') : '-';

  return [
    'PENAGIHAN KOMISI MINGGUAN — TRIPKITA',
    '',
    `Halo ${deposit.partnerName}, berikut rekap kewajiban komisi platform TripKita (10% dari Tarif Jasa):`,
    '',
    `ID Tagihan: ${deposit.depositId}`,
    `Periode: ${deposit.periodLabel}`,
    `Jatuh Tempo: ${formatIndonesianDate(deposit.dueDate)}`,
    `Daftar Booking Selesai: ${bookingList}`,
    `Total Tarif Jasa: ${formatRupiah(deposit.totalServiceFareRp)}`,
    `Komisi Resmi (10%): ${formatRupiah(deposit.totalCommissionRp)}`,
    `Sudah Disetor: ${formatRupiah(deposit.paidAmountRp)}`,
    `Sisa Kewajiban: ${formatRupiah(deposit.remainingDueRp)}`,
    '',
    'Catatan: Komisi hanya dihitung dari tarif jasa (tidak termasuk tol, parkir, maupun biaya tambahan).',
    'Mohon kirimkan bukti/referensi transfer ke Admin TripKita sebelum tanggal jatuh tempo untuk verifikasi.',
  ].join('\n');
}
