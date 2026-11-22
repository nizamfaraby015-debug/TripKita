import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  handleFirestoreError,
  isFirebaseConfigured,
} from '../lib/firebase';
import {
  AssignmentHistoryEntry,
  BookingDocument,
  BookingFormData,
  LatLngLiteral,
  PLATFORM_COMMISSION_RATE,
  RouteMetrics,
  calculateInternalFare,
  formatDurationId,
} from '../types/booking';

export interface IdempotentBookingIdentifiers {
  bookingId: string;
  bookingCode: string;
  fingerprint: string;
}

export interface SaveBookingOutcome {
  ok: boolean;
  bookingId: string;
  bookingCode: string;
  errorReason?: 'not_configured' | 'permission_denied' | 'network_or_unknown';
  errorMessage?: string;
}

export interface FirestoreBookingPayload extends BookingDocument {
  assignedPartnerName: string | null;
  assignmentStatus: 'MENUNGGU_MITRA';
  assignmentHistory: AssignmentHistoryEntry[];
  internalEstimatedFareRp: number;
  agreedFareRp: number;
  tollFeeRp: number;
  parkingFeeRp: number;
  extraFeeRp: number;
  totalCashDueRp: number;
  cashPaymentStatus: 'BELUM_DIBAYAR';
  partnerConfirmedCash: boolean;
  commissionRate: number;
  commissionAmountRp: number;
  adminConfirmedPartnerReady: boolean;
}

function generateShortRandomAlphaNum(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function generateBookingId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tk_${crypto.randomUUID()}`;
  }
  const ts = Date.now().toString(36);
  return `tk_${ts}_${generateShortRandomAlphaNum(8).toLowerCase()}`;
}

function generateBookingCode(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `TK-${yy}${mm}${dd}-${generateShortRandomAlphaNum(5)}`;
}

export function buildBookingFingerprint(
  data: BookingFormData,
  routeMetrics: RouteMetrics | null
): string {
  return JSON.stringify({
    jenisPerjalanan: data.jenisPerjalanan,
    nama: data.nama.trim(),
    whatsapp: data.whatsapp.trim(),
    penjemputan: data.penjemputan.trim(),
    penjemputanCoord: data.penjemputanCoord,
    tujuan: data.tujuan.trim(),
    tujuanCoord: data.tujuanCoord,
    tanggal: data.tanggal.trim(),
    jam: data.jam.trim(),
    penumpang: data.penumpang.trim(),
    catatan: data.catatan.trim(),
    durasiTunggu: data.durasiTunggu.trim(),
    modeTunggu: data.modeTunggu,
    tanggalSelesai: data.tanggalSelesai.trim(),
    jamSelesai: data.jamSelesai.trim(),
    tanggalPulang: data.tanggalPulang.trim(),
    jamPulang: data.jamPulang.trim(),
    lokasiPulang: data.lokasiPulang.trim(),
    durasiPemakaian: data.durasiPemakaian.trim(),
    keteranganKebutuhan: data.keteranganKebutuhan.trim(),
    distanceMeters: routeMetrics?.distanceMeters ?? null,
    durationMillis: routeMetrics?.durationMillis ?? null,
  });
}

export function createIdempotentBookingIdentifiers(
  fingerprint: string
): IdempotentBookingIdentifiers {
  return {
    bookingId: generateBookingId(),
    bookingCode: generateBookingCode(),
    fingerprint,
  };
}

function sanitizeCoordinates(coord: LatLngLiteral | null): LatLngLiteral | null {
  if (!coord) return null;
  if (
    typeof coord.lat !== 'number' ||
    typeof coord.lng !== 'number' ||
    Number.isNaN(coord.lat) ||
    Number.isNaN(coord.lng) ||
    coord.lat < -90 ||
    coord.lat > 90 ||
    coord.lng < -180 ||
    coord.lng > 180
  ) {
    return null;
  }
  return {
    lat: Number(coord.lat.toFixed(6)),
    lng: Number(coord.lng.toFixed(6)),
  };
}

function normalizeTravelTime(rawTime: string): string {
  const trimmed = rawTime.trim();
  const match = trimmed.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : trimmed.slice(0, 5);
}

export function buildBookingDocumentPayload(
  identifiers: IdempotentBookingIdentifiers,
  formData: BookingFormData,
  routeMetrics: RouteMetrics | null
): FirestoreBookingPayload {
  const parsedPassengers = parseInt(formData.penumpang, 10);
  const passengerCount = Number.isNaN(parsedPassengers)
    ? 1
    : Math.min(50, Math.max(1, parsedPassengers));

  const distanceKm =
    routeMetrics && routeMetrics.distanceMeters > 0
      ? Number((routeMetrics.distanceMeters / 1000).toFixed(1))
      : null;

  const estimatedDuration =
    routeMetrics && routeMetrics.durationMillis > 0
      ? formatDurationId(routeMetrics.durationMillis).slice(0, 64)
      : null;

  const internalEstimatedFareRp =
    routeMetrics && routeMetrics.distanceMeters > 0
      ? calculateInternalFare(routeMetrics.distanceMeters)
      : calculateInternalFare(0);

  const tripDetails =
    formData.jenisPerjalanan === 'ANTAR_TUNGGU'
      ? {
          waitDuration: formData.durasiTunggu.trim().slice(0, 80),
          waitMode: formData.modeTunggu,
          estimatedEndDate: formData.tanggalSelesai.trim().slice(0, 10),
          estimatedEndTime: normalizeTravelTime(formData.jamSelesai),
        }
      : formData.jenisPerjalanan === 'PULANG_PERGI'
        ? {
            returnDate: formData.tanggalPulang.trim().slice(0, 10),
            returnTime: normalizeTravelTime(formData.jamPulang),
            returnDestination: formData.lokasiPulang.trim().slice(0, 300),
          }
        : formData.jenisPerjalanan === 'CARTER' ||
            formData.jenisPerjalanan === 'RENTAL_SOPIR'
          ? {
              rentalDuration: formData.durasiPemakaian.trim().slice(0, 80),
              estimatedEndDate: formData.tanggalSelesai.trim().slice(0, 10),
              estimatedEndTime: normalizeTravelTime(formData.jamSelesai),
              usageNeeds: formData.keteranganKebutuhan.trim().slice(0, 500),
            }
          : {};

  return {
    bookingId: identifiers.bookingId,
    bookingCode: identifiers.bookingCode,
    tripType: formData.jenisPerjalanan,
    tripDetails,
    customerName: formData.nama.trim().slice(0, 120),
    customerPhone: formData.whatsapp.trim().slice(0, 24),
    pickupAddress: formData.penjemputan.trim().slice(0, 300),
    destinationAddress: formData.tujuan.trim().slice(0, 300),
    pickupCoordinates: sanitizeCoordinates(formData.penjemputanCoord),
    destinationCoordinates: sanitizeCoordinates(formData.tujuanCoord),
    travelDate: formData.tanggal.trim().slice(0, 10),
    travelTime: normalizeTravelTime(formData.jam),
    passengerCount,
    distanceKm,
    estimatedDuration,
    customerNotes: formData.catatan.trim().slice(0, 500),
    bookingStatus: 'NEW',
    paymentStatus: 'UNPAID',
    assignedPartnerId: null,
    assignedPartnerName: null,
    assignmentStatus: 'MENUNGGU_MITRA',
    assignmentHistory: [
      {
        timestamp: new Date().toISOString().slice(0, 40),
        action: 'Booking masuk dari formulir pelanggan',
        partnerId: null,
        partnerName: null,
        status: 'MENUNGGU_MITRA',
      },
    ],
    customerUid: auth?.currentUser?.uid ?? null,
    internalEstimatedFareRp,
    agreedFareRp: 0,
    tollFeeRp: 0,
    parkingFeeRp: 0,
    extraFeeRp: 0,
    totalCashDueRp: 0,
    cashPaymentStatus: 'BELUM_DIBAYAR',
    partnerConfirmedCash: false,
    commissionRate: PLATFORM_COMMISSION_RATE,
    commissionAmountRp: 0,
    adminConfirmedPartnerReady: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    source: 'WEB_BOOKING_FORM',
  };
}

export async function saveBookingToFirestore(
  identifiers: IdempotentBookingIdentifiers,
  formData: BookingFormData,
  routeMetrics: RouteMetrics | null
): Promise<SaveBookingOutcome> {
  if (!isFirebaseConfigured || !db) {
    return {
      ok: false,
      bookingId: identifiers.bookingId,
      bookingCode: identifiers.bookingCode,
      errorReason: 'not_configured',
      errorMessage:
        'Database booking belum terhubung karena konfigurasi Firebase belum lengkap.',
    };
  }

  const docPath = `bookings/${identifiers.bookingId}`;
  const payload = buildBookingDocumentPayload(identifiers, formData, routeMetrics);

  try {
    await setDoc(doc(db, 'bookings', identifiers.bookingId), payload);
    return {
      ok: true,
      bookingId: identifiers.bookingId,
      bookingCode: identifiers.bookingCode,
    };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    const lowerMsg = rawMsg.toLowerCase();
    const isPermission =
      lowerMsg.includes('permission') || lowerMsg.includes('insufficient');
    const isOffline =
      lowerMsg.includes('client is offline') ||
      lowerMsg.includes('could not reach cloud firestore') ||
      lowerMsg.includes('unavailable');

    if (!isOffline) {
      try {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      } catch {
        // Error sudah dicatat secara terstruktur oleh handleFirestoreError
      }
    }

    return {
      ok: false,
      bookingId: identifiers.bookingId,
      bookingCode: identifiers.bookingCode,
      errorReason: isPermission ? 'permission_denied' : 'network_or_unknown',
      errorMessage: isPermission
        ? 'Penyimpanan booking ke database ditolak oleh aturan keamanan atau belum diizinkan.'
        : isOffline
          ? 'Server Firestore belum dapat dijangkau. Pastikan koneksi internet aktif dan Firebase tersedia.'
          : 'Penyimpanan data booking ke server sedang terkendala. Silakan coba simpan ulang.',
    };
  }
}
