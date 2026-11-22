import {
  DEFAULT_COMMISSION_SETTINGS,
  SEED_OPERATIONAL_BOOKINGS,
  SEED_PARTNERS,
  SEED_WEEKLY_DEPOSITS,
} from '../data/mockAdminData';
import {
  AssignmentStatus,
  BookingFormData,
  BookingStatus,
  CashPaymentStatus,
  OperationalBookingRecord,
  PLATFORM_COMMISSION_RATE,
  RouteMetrics,
  calculateInternalFare,
  formatDurationId,
} from '../types/booking';
import {
  CommissionSettings,
  PartnerCommissionSummary,
  PartnerDocumentPlaceholder,
  PartnerRegistration,
  PartnerRegistrationInput,
  PartnerVerificationStatus,
  WeeklyCommissionDeposit,
} from '../types/partner';

const STORAGE_KEYS = {
  partners: 'tripkita_demo_v1_partners',
  bookings: 'tripkita_ops_v1_bookings',
  commission: 'tripkita_demo_v1_commission',
  deposits: 'tripkita_ops_v1_weekly_deposits',
  lastRegNumber: 'tripkita_demo_v1_last_reg_number',
} as const;

function canUseStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Abaikan jika storage browser penuh
  }
}

function sanitizeDocumentPlaceholder(
  docs: PartnerDocumentPlaceholder
): PartnerDocumentPlaceholder {
  // Tidak pernah menyimpan file blob, data URL, atau dokumen sensitif di localStorage
  return {
    simFileName: docs.simFileName ? docs.simFileName.slice(0, 80) : null,
    stnkFileName: docs.stnkFileName ? docs.stnkFileName.slice(0, 80) : null,
    vehiclePhotoFileName: docs.vehiclePhotoFileName
      ? docs.vehiclePhotoFileName.slice(0, 80)
      : null,
    storageStatus: 'DEMO_NOT_UPLOADED',
  };
}

function generatePartnerRegistrationNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const num = Math.floor(1000 + Math.random() * 9000);
  return `MTR-${yy}${mm}${dd}-${num}`;
}

export function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

export function calculateCommission10Percent(agreedServiceFareRp: number): number {
  const safeFare = Math.max(0, Math.round(agreedServiceFareRp));
  return Math.round(safeFare * PLATFORM_COMMISSION_RATE);
}

// ============================================================================
// MITRA / PARTNER SERVICE (MODE DEMO)
// ============================================================================

export function listDemoPartners(): PartnerRegistration[] {
  const stored = readJson<PartnerRegistration[] | null>(STORAGE_KEYS.partners, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeJson(STORAGE_KEYS.partners, SEED_PARTNERS);
  return SEED_PARTNERS;
}

export function getDemoPartnerByRegistrationNumber(
  regNumber: string
): PartnerRegistration | null {
  const normalized = regNumber.trim().toUpperCase();
  if (!normalized) return null;
  const partners = listDemoPartners();
  return (
    partners.find(
      (item) => item.registrationNumber.trim().toUpperCase() === normalized
    ) ?? null
  );
}

export function getLastDemoRegistrationNumber(): string {
  if (!canUseStorage()) return '';
  try {
    return window.localStorage.getItem(STORAGE_KEYS.lastRegNumber) || '';
  } catch {
    return '';
  }
}

export function submitDemoPartnerRegistration(
  input: PartnerRegistrationInput
): PartnerRegistration {
  const nowIso = new Date().toISOString();
  const registrationNumber = generatePartnerRegistrationNumber();
  const id = `ptr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const newRecord: PartnerRegistration = {
    id,
    registrationNumber,
    status: 'MENUNGGU_VERIFIKASI',
    fullName: input.fullName.trim(),
    whatsapp: input.whatsapp.trim(),
    email: input.email.trim().toLowerCase(),
    address: input.address.trim(),
    district: input.district.trim(),
    regency: input.regency.trim(),
    partnershipType: input.partnershipType,
    services: [...input.services],
    otherServiceNote: input.otherServiceNote?.trim() || undefined,
    vehicleBrandType: input.vehicleBrandType.trim(),
    vehicleYear: input.vehicleYear.trim(),
    licensePlate: input.licensePlate.trim().toUpperCase(),
    passengerCapacity: input.passengerCapacity,
    operationalArea: input.operationalArea.trim(),
    availability: input.availability,
    documents: sanitizeDocumentPlaceholder(input.documents),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const current = listDemoPartners();
  writeJson(STORAGE_KEYS.partners, [newRecord, ...current]);

  if (canUseStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEYS.lastRegNumber, registrationNumber);
    } catch {
      // Abaikan
    }
  }

  return newRecord;
}

export function updateDemoPartnerStatus(
  partnerId: string,
  status: PartnerVerificationStatus,
  rejectionReason?: string
): PartnerRegistration[] {
  const current = listDemoPartners();
  const nowIso = new Date().toISOString();

  const updated = current.map((item) => {
    if (item.id !== partnerId) return item;
    return {
      ...item,
      status,
      rejectionReason:
        status === 'DITOLAK'
          ? rejectionReason?.trim() || 'Data pendaftaran belum memenuhi kriteria verifikasi.'
          : undefined,
      updatedAt: nowIso,
    };
  });

  writeJson(STORAGE_KEYS.partners, updated);
  return updated;
}

export function upsertImportedPartners(
  imported: PartnerRegistration[]
): { partners: PartnerRegistration[]; addedCount: number; skippedCount: number } {
  const current = listDemoPartners();
  const existingRegSet = new Set(
    current.map((p) => p.registrationNumber.trim().toUpperCase())
  );
  let addedCount = 0;
  let skippedCount = 0;
  const toPrepend: PartnerRegistration[] = [];

  for (const item of imported) {
    const code = item.registrationNumber.trim().toUpperCase();
    if (!code || existingRegSet.has(code)) {
      skippedCount += 1;
      continue;
    }
    existingRegSet.add(code);
    toPrepend.push({
      ...item,
      documents: sanitizeDocumentPlaceholder(item.documents),
    });
    addedCount += 1;
  }

  const next = [...toPrepend, ...current];
  writeJson(STORAGE_KEYS.partners, next);
  return { partners: next, addedCount, skippedCount };
}

// ============================================================================
// OPERATIONAL BOOKINGS, PENUGASAN & TRANSAKSI CASH (MODE DEMO)
// ============================================================================

export function listDemoBookings(): OperationalBookingRecord[] {
  const stored = readJson<OperationalBookingRecord[] | null>(
    STORAGE_KEYS.bookings,
    null
  );
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeJson(STORAGE_KEYS.bookings, SEED_OPERATIONAL_BOOKINGS);
  return SEED_OPERATIONAL_BOOKINGS;
}

export function recordDemoBookingFromForm(params: {
  bookingId: string;
  bookingCode: string;
  formData: BookingFormData;
  routeMetrics: RouteMetrics | null;
}): OperationalBookingRecord[] {
  const current = listDemoBookings();
  // Idempotensi berdasarkan bookingId atau bookingCode
  if (
    current.some(
      (b) =>
        b.bookingId === params.bookingId || b.bookingCode === params.bookingCode
    )
  ) {
    return current;
  }

  const { formData, routeMetrics } = params;
  const nowIso = new Date().toISOString();
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
      ? formatDurationId(routeMetrics.durationMillis)
      : null;

  const internalEstimatedFareRp =
    routeMetrics && routeMetrics.distanceMeters > 0
      ? calculateInternalFare(routeMetrics.distanceMeters)
      : calculateInternalFare(0);

  const tripDetails =
    formData.jenisPerjalanan === 'ANTAR_TUNGGU'
      ? {
          waitDuration: formData.durasiTunggu.trim(),
          waitMode: formData.modeTunggu,
          estimatedEndDate: formData.tanggalSelesai.trim(),
          estimatedEndTime: formData.jamSelesai.trim(),
        }
      : formData.jenisPerjalanan === 'PULANG_PERGI'
        ? {
            returnDate: formData.tanggalPulang.trim(),
            returnTime: formData.jamPulang.trim(),
            returnDestination: formData.lokasiPulang.trim(),
          }
        : formData.jenisPerjalanan === 'CARTER' ||
            formData.jenisPerjalanan === 'RENTAL_SOPIR'
          ? {
              rentalDuration: formData.durasiPemakaian.trim(),
              estimatedEndDate: formData.tanggalSelesai.trim(),
              estimatedEndTime: formData.jamSelesai.trim(),
              usageNeeds: formData.keteranganKebutuhan.trim(),
            }
          : {};

  const record: OperationalBookingRecord = {
    bookingId: params.bookingId,
    bookingCode: params.bookingCode,
    tripType: formData.jenisPerjalanan,
    tripDetails,
    customerName: formData.nama.trim(),
    customerPhone: formData.whatsapp.trim(),
    pickupAddress: formData.penjemputan.trim(),
    destinationAddress: formData.tujuan.trim(),
    pickupCoordinates: formData.penjemputanCoord,
    destinationCoordinates: formData.tujuanCoord,
    travelDate: formData.tanggal.trim(),
    travelTime: formData.jam.trim(),
    passengerCount,
    distanceKm,
    estimatedDuration,
    customerNotes: formData.catatan.trim(),
    bookingStatus: 'NEW',
    paymentStatus: 'UNPAID',
    assignedPartnerId: null,
    assignedPartnerName: null,
    assignmentStatus: 'MENUNGGU_MITRA',
    assignmentHistory: [
      {
        timestamp: nowIso,
        action: 'Booking masuk dari formulir pelanggan',
        partnerId: null,
        partnerName: null,
        status: 'MENUNGGU_MITRA',
      },
    ],
    customerUid: null,
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
    createdAt: nowIso,
    updatedAt: nowIso,
    source: 'WEB_BOOKING_FORM',
  };

  const next = [record, ...current];
  writeJson(STORAGE_KEYS.bookings, next);
  return next;
}

export function offerBookingToPartner(
  bookingId: string,
  partner: PartnerRegistration
): OperationalBookingRecord[] {
  const current = listDemoBookings();
  const nowIso = new Date().toISOString();

  const updated = current.map((item) => {
    if (item.bookingId !== bookingId) return item;
    return {
      ...item,
      assignedPartnerId: partner.id,
      assignedPartnerName: partner.fullName,
      assignmentStatus: 'DITAWARKAN' as AssignmentStatus,
      adminConfirmedPartnerReady: false,
      assignmentHistory: [
        ...item.assignmentHistory,
        {
          timestamp: nowIso,
          action: `Admin mengirim penawaran ke mitra ${partner.fullName} (${partner.licensePlate})`,
          partnerId: partner.id,
          partnerName: partner.fullName,
          status: 'DITAWARKAN' as AssignmentStatus,
        },
      ],
      updatedAt: nowIso,
    };
  });

  writeJson(STORAGE_KEYS.bookings, updated);
  return updated;
}

export function respondPartnerOffer(
  bookingId: string,
  response: 'DITERIMA' | 'DITOLAK',
  note?: string
): OperationalBookingRecord[] {
  const current = listDemoBookings();
  const nowIso = new Date().toISOString();

  const updated = current.map((item) => {
    if (item.bookingId !== bookingId) return item;
    const isAccepted = response === 'DITERIMA';
    const nextBookingStatus: BookingStatus =
      !isAccepted && item.bookingStatus === 'ASSIGNED'
        ? 'NEW'
        : item.bookingStatus;

    return {
      ...item,
      assignmentStatus: response,
      adminConfirmedPartnerReady: isAccepted,
      bookingStatus: nextBookingStatus,
      assignedPartnerId: isAccepted ? item.assignedPartnerId : item.assignedPartnerId,
      assignmentHistory: [
        ...item.assignmentHistory,
        {
          timestamp: nowIso,
          action: isAccepted
            ? `Mitra ${item.assignedPartnerName || ''} menerima penawaran order`
            : `Mitra ${item.assignedPartnerName || ''} menolak/membatalkan order`,
          partnerId: item.assignedPartnerId,
          partnerName: item.assignedPartnerName,
          status: response,
          note: note?.trim() || undefined,
        },
      ],
      updatedAt: nowIso,
    };
  });

  writeJson(STORAGE_KEYS.bookings, updated);
  return updated;
}

export function assignPartnerConfirmed(
  bookingId: string
): OperationalBookingRecord[] {
  const current = listDemoBookings();
  const nowIso = new Date().toISOString();

  const updated = current.map((item) => {
    if (item.bookingId !== bookingId) return item;
    if (!item.assignedPartnerId || item.assignmentStatus !== 'DITERIMA') {
      return item;
    }

    const nextStatus: BookingStatus =
      item.bookingStatus === 'CONFIRMED' ? 'CONFIRMED' : 'ASSIGNED';

    return {
      ...item,
      assignmentStatus: 'DITUGASKAN' as AssignmentStatus,
      bookingStatus: nextStatus,
      assignmentHistory: [
        ...item.assignmentHistory,
        {
          timestamp: nowIso,
          action: `Penugasan resmi diterbitkan untuk ${item.assignedPartnerName}`,
          partnerId: item.assignedPartnerId,
          partnerName: item.assignedPartnerName,
          status: 'DITUGASKAN' as AssignmentStatus,
        },
      ],
      updatedAt: nowIso,
    };
  });

  writeJson(STORAGE_KEYS.bookings, updated);
  return updated;
}

export function confirmBookingByAdmin(
  bookingId: string,
  agreedFareRp: number
): { ok: boolean; error?: string; bookings: OperationalBookingRecord[] } {
  const current = listDemoBookings();
  const target = current.find((b) => b.bookingId === bookingId);
  if (!target) {
    return { ok: false, error: 'Booking tidak ditemukan.', bookings: current };
  }

  if (agreedFareRp <= 0) {
    return {
      ok: false,
      error: 'Tarif jasa akhir yang disepakati harus lebih dari Rp 0.',
      bookings: current,
    };
  }

  const partnerReady =
    Boolean(target.assignedPartnerId) &&
    (target.assignmentStatus === 'DITERIMA' ||
      target.assignmentStatus === 'DITUGASKAN' ||
      target.assignmentStatus === 'SELESAI');

  if (!partnerReady) {
    return {
      ok: false,
      error:
        'Mitra harus ditawarkan dan menerima order (status DITERIMA / DITUGASKAN) sebelum booking berstatus DIKONFIRMASI.',
      bookings: current,
    };
  }

  const nowIso = new Date().toISOString();
  const safeFare = Math.round(agreedFareRp);
  const commissionAmountRp = calculateCommission10Percent(safeFare);
  const totalCashDueRp =
    safeFare + target.tollFeeRp + target.parkingFeeRp + target.extraFeeRp;

  const updated = current.map((item) => {
    if (item.bookingId !== bookingId) return item;
    return {
      ...item,
      agreedFareRp: safeFare,
      totalCashDueRp,
      commissionRate: PLATFORM_COMMISSION_RATE,
      commissionAmountRp,
      adminConfirmedPartnerReady: true,
      bookingStatus: 'CONFIRMED' as BookingStatus,
      assignmentStatus:
        item.assignmentStatus === 'DITERIMA'
          ? ('DITUGASKAN' as AssignmentStatus)
          : item.assignmentStatus,
      assignmentHistory: [
        ...item.assignmentHistory,
        {
          timestamp: nowIso,
          action: `Admin konfirmasi tarif jasa ${formatRupiah(safeFare)} & status DIKONFIRMASI`,
          partnerId: item.assignedPartnerId,
          partnerName: item.assignedPartnerName,
          status:
            item.assignmentStatus === 'DITERIMA'
              ? ('DITUGASKAN' as AssignmentStatus)
              : item.assignmentStatus,
        },
      ],
      updatedAt: nowIso,
    };
  });

  writeJson(STORAGE_KEYS.bookings, updated);
  return { ok: true, bookings: updated };
}

export function updateCashTransactionDetails(
  bookingId: string,
  params: {
    agreedFareRp: number;
    tollFeeRp: number;
    parkingFeeRp: number;
    extraFeeRp: number;
    partnerConfirmedCash: boolean;
    adminVerifiedCash: boolean;
  }
): OperationalBookingRecord[] {
  const current = listDemoBookings();
  const nowIso = new Date().toISOString();

  const updated = current.map((item) => {
    if (item.bookingId !== bookingId) return item;
    const agreedFareRp = Math.max(0, Math.round(params.agreedFareRp));
    const tollFeeRp = Math.max(0, Math.round(params.tollFeeRp));
    const parkingFeeRp = Math.max(0, Math.round(params.parkingFeeRp));
    const extraFeeRp = Math.max(0, Math.round(params.extraFeeRp));
    const totalCashDueRp = agreedFareRp + tollFeeRp + parkingFeeRp + extraFeeRp;

    // Komisi 10% dihitung HANYA dari Tarif Jasa (bukan tol/parkir/tambahan)
    const commissionAmountRp = calculateCommission10Percent(agreedFareRp);

    // Jangan menganggap transaksi lunas sebelum ada konfirmasi mitra + verifikasi
    let cashPaymentStatus: CashPaymentStatus = 'BELUM_DIBAYAR';
    if (params.partnerConfirmedCash && params.adminVerifiedCash) {
      cashPaymentStatus = 'DIBAYAR';
    } else if (params.partnerConfirmedCash) {
      cashPaymentStatus = 'PERLU_VERIFIKASI';
    }

    return {
      ...item,
      agreedFareRp,
      tollFeeRp,
      parkingFeeRp,
      extraFeeRp,
      totalCashDueRp,
      commissionRate: PLATFORM_COMMISSION_RATE,
      commissionAmountRp,
      partnerConfirmedCash: params.partnerConfirmedCash,
      cashPaymentStatus,
      paymentStatus:
        cashPaymentStatus === 'DIBAYAR' ? ('PAID' as const) : ('UNPAID' as const),
      updatedAt: nowIso,
    };
  });

  writeJson(STORAGE_KEYS.bookings, updated);
  return updated;
}

export function completeDemoTrip(bookingId: string): OperationalBookingRecord[] {
  const current = listDemoBookings();
  const nowIso = new Date().toISOString();

  const updated = current.map((item) => {
    if (item.bookingId !== bookingId) return item;
    const fareForCommission = item.agreedFareRp > 0 ? item.agreedFareRp : 0;
    const commissionAmountRp = calculateCommission10Percent(fareForCommission);

    return {
      ...item,
      bookingStatus: 'COMPLETED' as BookingStatus,
      assignmentStatus: 'SELESAI' as AssignmentStatus,
      commissionRate: PLATFORM_COMMISSION_RATE,
      commissionAmountRp,
      assignmentHistory: [
        ...item.assignmentHistory,
        {
          timestamp: nowIso,
          action: 'Perjalanan ditandai SELESAI oleh admin',
          partnerId: item.assignedPartnerId,
          partnerName: item.assignedPartnerName,
          status: 'SELESAI' as AssignmentStatus,
        },
      ],
      updatedAt: nowIso,
    };
  });

  writeJson(STORAGE_KEYS.bookings, updated);
  return updated;
}

export function cancelDemoBooking(
  bookingId: string,
  reason: string
): OperationalBookingRecord[] {
  const current = listDemoBookings();
  const nowIso = new Date().toISOString();

  const updated = current.map((item) => {
    if (item.bookingId !== bookingId) return item;
    return {
      ...item,
      bookingStatus: 'CANCELLED' as BookingStatus,
      cancellationReason: reason.trim() || 'Dibatalkan oleh admin',
      assignmentHistory: [
        ...item.assignmentHistory,
        {
          timestamp: nowIso,
          action: `Booking dibatalkan: ${reason.trim() || 'Permintaan pembatalan'}`,
          partnerId: item.assignedPartnerId,
          partnerName: item.assignedPartnerName,
          status: item.assignmentStatus,
        },
      ],
      updatedAt: nowIso,
    };
  });

  writeJson(STORAGE_KEYS.bookings, updated);
  return updated;
}

export function upsertImportedBookings(
  imported: OperationalBookingRecord[]
): { bookings: OperationalBookingRecord[]; addedCount: number; skippedCount: number } {
  const current = listDemoBookings();
  const existingCodeSet = new Set(
    current.map((b) => b.bookingCode.trim().toUpperCase())
  );
  let addedCount = 0;
  let skippedCount = 0;
  const toPrepend: OperationalBookingRecord[] = [];

  for (const item of imported) {
    const code = item.bookingCode.trim().toUpperCase();
    if (!code || existingCodeSet.has(code)) {
      skippedCount += 1;
      continue;
    }
    existingCodeSet.add(code);
    toPrepend.push(item);
    addedCount += 1;
  }

  const next = [...toPrepend, ...current];
  writeJson(STORAGE_KEYS.bookings, next);
  return { bookings: next, addedCount, skippedCount };
}

// ============================================================================
// KOMISI 10% & SETORAN MINGGUAN (TIDAK DIHITUNG GANDA PER BOOKING)
// ============================================================================

export function getDemoCommissionSettings(): CommissionSettings {
  const stored = readJson<CommissionSettings | null>(STORAGE_KEYS.commission, null);
  if (stored && typeof stored.platformCommissionPercent === 'number') {
    return stored;
  }
  writeJson(STORAGE_KEYS.commission, DEFAULT_COMMISSION_SETTINGS);
  return DEFAULT_COMMISSION_SETTINGS;
}

export function saveDemoCommissionSettings(
  minimumPlatformFeeRp: number
): CommissionSettings {
  const next: CommissionSettings = {
    platformCommissionPercent: 10, // Komisi resmi TripKita 10%
    minimumPlatformFeeRp: Math.max(0, Math.round(minimumPlatformFeeRp)),
    updatedAt: new Date().toISOString(),
  };
  writeJson(STORAGE_KEYS.commission, next);
  return next;
}

export function listWeeklyDeposits(): WeeklyCommissionDeposit[] {
  const stored = readJson<WeeklyCommissionDeposit[] | null>(
    STORAGE_KEYS.deposits,
    null
  );
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeJson(STORAGE_KEYS.deposits, SEED_WEEKLY_DEPOSITS);
  return SEED_WEEKLY_DEPOSITS;
}

export function computePartnerCommissionSummaries(
  bookings: OperationalBookingRecord[],
  partners: PartnerRegistration[],
  deposits: WeeklyCommissionDeposit[]
): PartnerCommissionSummary[] {
  const map = new Map<string, PartnerCommissionSummary>();
  const countedBookingCodes = new Set<string>();

  for (const partner of partners) {
    if (partner.status !== 'DISETUJUI') continue;
    map.set(partner.id, {
      partnerId: partner.id,
      partnerName: partner.fullName,
      partnerWhatsapp: partner.whatsapp,
      vehicleLabel: `${partner.vehicleBrandType} (${partner.licensePlate})`,
      completedBookingsCount: 0,
      bookingCodes: [],
      totalServiceFareRp: 0,
      totalCommission10PercentRp: 0,
      paidDepositRp: 0,
      unpaidDepositRp: 0,
    });
  }

  for (const booking of bookings) {
    if (booking.bookingStatus !== 'COMPLETED' || !booking.assignedPartnerId) {
      continue;
    }
    // Pastikan 1 booking selesai hanya dihitung komisi satu kali
    if (countedBookingCodes.has(booking.bookingCode)) {
      continue;
    }
    countedBookingCodes.add(booking.bookingCode);

    const existing = map.get(booking.assignedPartnerId) ?? {
      partnerId: booking.assignedPartnerId,
      partnerName: booking.assignedPartnerName || 'Mitra',
      partnerWhatsapp: '',
      vehicleLabel: '-',
      completedBookingsCount: 0,
      bookingCodes: [],
      totalServiceFareRp: 0,
      totalCommission10PercentRp: 0,
      paidDepositRp: 0,
      unpaidDepositRp: 0,
    };

    const fare = Math.max(0, booking.agreedFareRp);
    const comm = calculateCommission10Percent(fare);

    existing.completedBookingsCount += 1;
    existing.bookingCodes.push(booking.bookingCode);
    existing.totalServiceFareRp += fare;
    existing.totalCommission10PercentRp += comm;

    map.set(booking.assignedPartnerId, existing);
  }

  for (const deposit of deposits) {
    const entry = map.get(deposit.partnerId);
    if (!entry) continue;
    if (deposit.status === 'SUDAH_DIVERIFIKASI') {
      entry.paidDepositRp += deposit.paidAmountRp;
    }
  }

  for (const entry of map.values()) {
    entry.unpaidDepositRp = Math.max(
      0,
      entry.totalCommission10PercentRp - entry.paidDepositRp
    );
  }

  return Array.from(map.values());
}

export function createWeeklyDepositRecord(params: {
  partner: PartnerCommissionSummary;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
}): WeeklyCommissionDeposit[] {
  const current = listWeeklyDeposits();
  const nowIso = new Date().toISOString();

  // Cegah penagihan ganda untuk bookingCode yang sudah masuk setoran aktif
  const alreadyBilledCodes = new Set<string>();
  for (const dep of current) {
    for (const code of dep.bookingCodes) {
      alreadyBilledCodes.add(code);
    }
  }

  const unbilledCodes = params.partner.bookingCodes.filter(
    (code) => !alreadyBilledCodes.has(code)
  );
  const codesToInclude =
    unbilledCodes.length > 0 ? unbilledCodes : params.partner.bookingCodes;

  const totalCommissionRp = params.partner.unpaidDepositRp > 0
    ? params.partner.unpaidDepositRp
    : params.partner.totalCommission10PercentRp;

  const newDeposit: WeeklyCommissionDeposit = {
    depositId: `DEP-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    partnerId: params.partner.partnerId,
    partnerName: params.partner.partnerName,
    partnerWhatsapp: params.partner.partnerWhatsapp,
    periodLabel: params.periodLabel.trim() || 'Periode Mingguan',
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    dueDate: params.dueDate,
    bookingCodes: codesToInclude,
    totalServiceFareRp: params.partner.totalServiceFareRp,
    commissionRatePercent: 10,
    totalCommissionRp,
    paidAmountRp: 0,
    remainingDueRp: totalCommissionRp,
    transferProofRef: '',
    transferNote: 'Menunggu transfer setoran mingguan mitra',
    status: 'BELUM_DIBAYAR',
    updatedAt: nowIso,
  };

  const next = [newDeposit, ...current];
  writeJson(STORAGE_KEYS.deposits, next);
  return next;
}

export function submitDepositTransferProof(
  depositId: string,
  transferProofRef: string,
  paidAmountRp: number,
  transferNote: string
): WeeklyCommissionDeposit[] {
  const current = listWeeklyDeposits();
  const nowIso = new Date().toISOString();

  const updated = current.map((dep) => {
    if (dep.depositId !== depositId) return dep;
    const safePaid = Math.max(0, Math.round(paidAmountRp));
    const remainingDueRp = Math.max(0, dep.totalCommissionRp - safePaid);
    return {
      ...dep,
      paidAmountRp: safePaid,
      remainingDueRp,
      transferProofRef: transferProofRef.trim().slice(0, 100),
      transferNote: transferNote.trim().slice(0, 200),
      status: 'PERLU_VERIFIKASI' as const,
      updatedAt: nowIso,
    };
  });

  writeJson(STORAGE_KEYS.deposits, updated);
  return updated;
}

export function verifyWeeklyDeposit(depositId: string): WeeklyCommissionDeposit[] {
  const current = listWeeklyDeposits();
  const nowIso = new Date().toISOString();

  const updated = current.map((dep) => {
    if (dep.depositId !== depositId) return dep;
    const finalPaid = dep.paidAmountRp > 0 ? dep.paidAmountRp : dep.totalCommissionRp;
    const remainingDueRp = Math.max(0, dep.totalCommissionRp - finalPaid);
    return {
      ...dep,
      paidAmountRp: finalPaid,
      remainingDueRp,
      status: 'SUDAH_DIVERIFIKASI' as const,
      verifiedAt: nowIso,
      updatedAt: nowIso,
    };
  });

  writeJson(STORAGE_KEYS.deposits, updated);
  return updated;
}

export function resetAllDemoData(): void {
  writeJson(STORAGE_KEYS.partners, SEED_PARTNERS);
  writeJson(STORAGE_KEYS.bookings, SEED_OPERATIONAL_BOOKINGS);
  writeJson(STORAGE_KEYS.commission, DEFAULT_COMMISSION_SETTINGS);
  writeJson(STORAGE_KEYS.deposits, SEED_WEEKLY_DEPOSITS);
  if (canUseStorage()) {
    try {
      window.localStorage.removeItem(STORAGE_KEYS.lastRegNumber);
    } catch {
      // Abaikan
    }
  }
}
