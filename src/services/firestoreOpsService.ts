import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_COMMISSION_SETTINGS,
  SEED_OPERATIONAL_BOOKINGS,
  SEED_PARTNERS,
  SEED_WEEKLY_DEPOSITS,
} from '../data/mockAdminData';
import {
  OperationType,
  db,
  handleFirestoreError,
  isFirebaseConfigured,
} from '../lib/firebase';
import {
  AssignmentHistoryEntry,
  AssignmentStatus,
  BookingStatus,
  CashPaymentStatus,
  OperationalBookingRecord,
  PLATFORM_COMMISSION_RATE,
} from '../types/booking';
import {
  CommissionSettings,
  PARTNERSHIP_TYPE_LABELS,
  PartnerDocumentPlaceholder,
  PartnerRegistration,
  PartnerRegistrationInput,
  PartnerServiceType,
  PartnerVerificationStatus,
  PartnershipType,
  VehicleAvailability,
  WeeklyCommissionDeposit,
} from '../types/partner';
import {
  calculateCommission10Percent,
  formatRupiah,
} from './partnerDemoService';

export interface PartnerPublicStatusRecord {
  registrationNumber: string;
  status: PartnerVerificationStatus;
  partnershipType: PartnershipType;
  services: PartnerServiceType[];
  vehicleBrandType: string;
  availability: VehicleAvailability;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (
    typeof val === 'object' &&
    val !== null &&
    'toDate' in val &&
    typeof (val as { toDate: unknown }).toDate === 'function'
  ) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (
    typeof val === 'object' &&
    val !== null &&
    'seconds' in val &&
    typeof (val as { seconds: unknown }).seconds === 'number'
  ) {
    return new Date((val as { seconds: number }).seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

function requireFirestore() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase Firestore belum terkonfigurasi.');
  }
  return db;
}

function sanitizeDocPlaceholder(
  docs: PartnerDocumentPlaceholder
): PartnerDocumentPlaceholder {
  return {
    simFileName: docs.simFileName ? docs.simFileName.slice(0, 80) : null,
    stnkFileName: docs.stnkFileName ? docs.stnkFileName.slice(0, 80) : null,
    vehiclePhotoFileName: docs.vehiclePhotoFileName
      ? docs.vehiclePhotoFileName.slice(0, 80)
      : null,
    storageStatus: 'DEMO_NOT_UPLOADED',
  };
}

function sanitizeHistoryEntries(
  entries: AssignmentHistoryEntry[]
): AssignmentHistoryEntry[] {
  return entries.slice(-50).map((entry) => {
    const clean: AssignmentHistoryEntry = {
      timestamp: String(entry.timestamp || new Date().toISOString()).slice(0, 40),
      action: String(entry.action || '-').slice(0, 300),
      partnerId: entry.partnerId ? String(entry.partnerId).slice(0, 128) : null,
      partnerName: entry.partnerName
        ? String(entry.partnerName).slice(0, 120)
        : null,
      status: entry.status,
    };
    if (entry.note && entry.note.trim()) {
      clean.note = entry.note.trim().slice(0, 300);
    }
    return clean;
  });
}

function generatePartnerRegistrationNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const randBytes = new Uint16Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randBytes);
  } else {
    randBytes[0] = Math.floor(1000 + Math.random() * 9000);
  }
  const num = 1000 + (randBytes[0] % 9000);
  return `MTR-${yy}${mm}${dd}-${num}`;
}

function generatePartnerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ptr_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  }
  return `ptr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const LAST_REG_STORAGE_KEY = 'tripkita_last_partner_reg_number';

export function saveLastPartnerRegNumberLocal(regNumber: string): void {
  try {
    window.localStorage.setItem(LAST_REG_STORAGE_KEY, regNumber);
  } catch {
    // Abaikan jika browser membatasi storage
  }
}

export function getLastPartnerRegNumberLocal(): string {
  try {
    return window.localStorage.getItem(LAST_REG_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

// ============================================================================
// PORTAL MITRA (/mitra) - PUBLIK AMAN (PII TERISOLASI)
// ============================================================================

export async function submitPartnerRegistrationFirestore(
  input: PartnerRegistrationInput
): Promise<PartnerRegistration> {
  const firestore = requireFirestore();
  const partnerId = generatePartnerId();
  const registrationNumber = generatePartnerRegistrationNumber();
  const nowIso = new Date().toISOString();

  const cleanDocs = sanitizeDocPlaceholder(input.documents);
  const cleanOtherNote =
    input.services.includes('LAYANAN_LAINNYA') && input.otherServiceNote?.trim()
      ? input.otherServiceNote.trim().slice(0, 200)
      : null;

  const cleanServices = input.services.slice(0, 6);
  const cleanBrandType = input.vehicleBrandType.trim().slice(0, 120);
  const cleanYear = input.vehicleYear.trim().slice(0, 4);
  const cleanPlate = input.licensePlate.trim().toUpperCase().slice(0, 20);
  const cleanCapacity = Math.min(50, Math.max(1, Math.round(input.passengerCapacity || 4)));

  const partnerPayload = {
    id: partnerId,
    registrationNumber,
    status: 'MENUNGGU_VERIFIKASI' as PartnerVerificationStatus,
    fullName: input.fullName.trim().slice(0, 120),
    whatsapp: input.whatsapp.trim().slice(0, 24),
    email: input.email.trim().toLowerCase().slice(0, 160),
    address: input.address.trim().slice(0, 300),
    district: input.district.trim().slice(0, 100),
    regency: input.regency.trim().slice(0, 100),
    partnershipType: input.partnershipType,
    services: cleanServices,
    ...(cleanOtherNote ? { otherServiceNote: cleanOtherNote } : {}),
    vehicleBrandType: cleanBrandType,
    vehicleYear: cleanYear,
    licensePlate: cleanPlate,
    passengerCapacity: cleanCapacity,
    operationalArea: input.operationalArea.trim().slice(0, 200),
    availability: input.availability,
    documents: cleanDocs,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Proyeksi non-PII untuk fitur Cek Status di /mitra
  const publicStatusPayload = {
    registrationNumber,
    status: 'MENUNGGU_VERIFIKASI' as PartnerVerificationStatus,
    partnershipType: input.partnershipType,
    services: cleanServices,
    vehicleBrandType: cleanBrandType,
    availability: input.availability,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const partnerPath = `partners/${partnerId}`;
  try {
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, 'partner_status', registrationNumber), publicStatusPayload);
    batch.set(doc(firestore, 'partners', partnerId), partnerPayload);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, partnerPath);
  }

  saveLastPartnerRegNumberLocal(registrationNumber);

  return {
    id: partnerId,
    registrationNumber,
    status: 'MENUNGGU_VERIFIKASI',
    fullName: partnerPayload.fullName,
    whatsapp: partnerPayload.whatsapp,
    email: partnerPayload.email,
    address: partnerPayload.address,
    district: partnerPayload.district,
    regency: partnerPayload.regency,
    partnershipType: partnerPayload.partnershipType,
    services: cleanServices,
    otherServiceNote: cleanOtherNote ?? undefined,
    vehicleBrandType: cleanBrandType,
    vehicleYear: cleanYear,
    licensePlate: cleanPlate,
    passengerCapacity: cleanCapacity,
    operationalArea: partnerPayload.operationalArea,
    availability: partnerPayload.availability,
    documents: cleanDocs,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export async function lookupPartnerStatusFirestore(
  rawRegNumber: string
): Promise<PartnerPublicStatusRecord | null> {
  const firestore = requireFirestore();
  const regNumber = rawRegNumber.trim().toUpperCase();
  if (!regNumber || !/^MTR-[A-Z0-9-]+$/.test(regNumber) || regNumber.length > 32) {
    return null;
  }

  const statusPath = `partner_status/${regNumber}`;
  try {
    const snap = await getDoc(doc(firestore, 'partner_status', regNumber));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      registrationNumber: String(data.registrationNumber || regNumber),
      status: (data.status as PartnerVerificationStatus) || 'MENUNGGU_VERIFIKASI',
      partnershipType:
        (data.partnershipType as PartnershipType) ||
        ('PEMILIK_DAN_PENGEMUDI' satisfies keyof typeof PARTNERSHIP_TYPE_LABELS),
      services: Array.isArray(data.services)
        ? (data.services as PartnerServiceType[])
        : ['MOBIL_PENUMPANG'],
      vehicleBrandType: String(data.vehicleBrandType || '-'),
      availability: (data.availability as VehicleAvailability) || 'TERSEDIA',
      rejectionReason:
        typeof data.rejectionReason === 'string' && data.rejectionReason
          ? data.rejectionReason
          : undefined,
      createdAt: toIsoString(data.createdAt),
      updatedAt: toIsoString(data.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, statusPath);
  }
}

// ============================================================================
// ADMIN LISTENERS (REALTIME ONSNAPSHOT - HANYA DIPANGGIL SAAT ADMIN LOGIN)
// ============================================================================

function normalizeBookingDoc(raw: Record<string, unknown>): OperationalBookingRecord {
  return {
    bookingId: String(raw.bookingId || ''),
    bookingCode: String(raw.bookingCode || ''),
    tripType: (raw.tripType as OperationalBookingRecord['tripType']) || 'SEKALI_JALAN',
    tripDetails: (raw.tripDetails as OperationalBookingRecord['tripDetails']) || {},
    customerName: String(raw.customerName || '-'),
    customerPhone: String(raw.customerPhone || ''),
    pickupAddress: String(raw.pickupAddress || '-'),
    destinationAddress: String(raw.destinationAddress || '-'),
    pickupCoordinates:
      (raw.pickupCoordinates as OperationalBookingRecord['pickupCoordinates']) ?? null,
    destinationCoordinates:
      (raw.destinationCoordinates as OperationalBookingRecord['destinationCoordinates']) ??
      null,
    travelDate: String(raw.travelDate || ''),
    travelTime: String(raw.travelTime || ''),
    passengerCount: Number(raw.passengerCount || 1),
    distanceKm: typeof raw.distanceKm === 'number' ? raw.distanceKm : null,
    estimatedDuration:
      typeof raw.estimatedDuration === 'string' ? raw.estimatedDuration : null,
    customerNotes: String(raw.customerNotes || ''),
    bookingStatus: (raw.bookingStatus as BookingStatus) || 'NEW',
    paymentStatus: (raw.paymentStatus as OperationalBookingRecord['paymentStatus']) || 'UNPAID',
    assignedPartnerId:
      typeof raw.assignedPartnerId === 'string' ? raw.assignedPartnerId : null,
    assignedPartnerName:
      typeof raw.assignedPartnerName === 'string' ? raw.assignedPartnerName : null,
    assignmentStatus:
      (raw.assignmentStatus as AssignmentStatus) || 'MENUNGGU_MITRA',
    assignmentHistory: Array.isArray(raw.assignmentHistory)
      ? (raw.assignmentHistory as AssignmentHistoryEntry[])
      : [],
    customerUid: typeof raw.customerUid === 'string' ? raw.customerUid : null,
    internalEstimatedFareRp: Number(raw.internalEstimatedFareRp || 150000),
    agreedFareRp: Number(raw.agreedFareRp || 0),
    tollFeeRp: Number(raw.tollFeeRp || 0),
    parkingFeeRp: Number(raw.parkingFeeRp || 0),
    extraFeeRp: Number(raw.extraFeeRp || 0),
    totalCashDueRp: Number(raw.totalCashDueRp || 0),
    cashPaymentStatus:
      (raw.cashPaymentStatus as CashPaymentStatus) || 'BELUM_DIBAYAR',
    partnerConfirmedCash: Boolean(raw.partnerConfirmedCash),
    commissionRate:
      typeof raw.commissionRate === 'number'
        ? raw.commissionRate
        : PLATFORM_COMMISSION_RATE,
    commissionAmountRp: Number(raw.commissionAmountRp || 0),
    adminConfirmedPartnerReady: Boolean(raw.adminConfirmedPartnerReady),
    cancellationReason:
      typeof raw.cancellationReason === 'string' && raw.cancellationReason
        ? raw.cancellationReason
        : undefined,
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt),
    source: (raw.source as OperationalBookingRecord['source']) || 'WEB_BOOKING_FORM',
  };
}

function normalizePartnerDoc(raw: Record<string, unknown>): PartnerRegistration {
  const rawDocs = (raw.documents as Record<string, unknown>) || {};
  return {
    id: String(raw.id || ''),
    registrationNumber: String(raw.registrationNumber || ''),
    status: (raw.status as PartnerVerificationStatus) || 'MENUNGGU_VERIFIKASI',
    fullName: String(raw.fullName || '-'),
    whatsapp: String(raw.whatsapp || ''),
    email: String(raw.email || ''),
    address: String(raw.address || ''),
    district: String(raw.district || ''),
    regency: String(raw.regency || ''),
    partnershipType:
      (raw.partnershipType as PartnershipType) || 'PEMILIK_DAN_PENGEMUDI',
    services: Array.isArray(raw.services)
      ? (raw.services as PartnerServiceType[])
      : ['MOBIL_PENUMPANG'],
    otherServiceNote:
      typeof raw.otherServiceNote === 'string' && raw.otherServiceNote
        ? raw.otherServiceNote
        : undefined,
    vehicleBrandType: String(raw.vehicleBrandType || '-'),
    vehicleYear: String(raw.vehicleYear || '2022'),
    licensePlate: String(raw.licensePlate || '-'),
    passengerCapacity: Number(raw.passengerCapacity || 4),
    operationalArea: String(raw.operationalArea || '-'),
    availability: (raw.availability as VehicleAvailability) || 'TERSEDIA',
    documents: {
      simFileName:
        typeof rawDocs.simFileName === 'string' ? rawDocs.simFileName : null,
      stnkFileName:
        typeof rawDocs.stnkFileName === 'string' ? rawDocs.stnkFileName : null,
      vehiclePhotoFileName:
        typeof rawDocs.vehiclePhotoFileName === 'string'
          ? rawDocs.vehiclePhotoFileName
          : null,
      storageStatus: 'DEMO_NOT_UPLOADED',
    },
    rejectionReason:
      typeof raw.rejectionReason === 'string' && raw.rejectionReason
        ? raw.rejectionReason
        : undefined,
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt),
  };
}

function normalizeWeeklyDepositDoc(
  raw: Record<string, unknown>
): WeeklyCommissionDeposit {
  return {
    depositId: String(raw.depositId || ''),
    partnerId: String(raw.partnerId || ''),
    partnerName: String(raw.partnerName || '-'),
    partnerWhatsapp: String(raw.partnerWhatsapp || ''),
    periodLabel: String(raw.periodLabel || 'Periode Mingguan'),
    periodStart: String(raw.periodStart || ''),
    periodEnd: String(raw.periodEnd || ''),
    dueDate: String(raw.dueDate || ''),
    bookingCodes: Array.isArray(raw.bookingCodes)
      ? raw.bookingCodes.map((c) => String(c))
      : [],
    totalServiceFareRp: Number(raw.totalServiceFareRp || 0),
    commissionRatePercent: Number(raw.commissionRatePercent || 10),
    totalCommissionRp: Number(raw.totalCommissionRp || 0),
    paidAmountRp: Number(raw.paidAmountRp || 0),
    remainingDueRp: Number(raw.remainingDueRp || 0),
    transferProofRef: String(raw.transferProofRef || ''),
    transferNote: String(raw.transferNote || ''),
    status: (raw.status as WeeklyCommissionDeposit['status']) || 'BELUM_DIBAYAR',
    verifiedAt: raw.verifiedAt ? toIsoString(raw.verifiedAt) : undefined,
    updatedAt: toIsoString(raw.updatedAt),
  };
}

export function subscribeBookingsFirestore(
  onData: (bookings: OperationalBookingRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const firestore = requireFirestore();
  const path = 'bookings';
  const q = query(collection(firestore, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        normalizeBookingDoc(d.data() as Record<string, unknown>)
      );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );
}

export function subscribePartnersFirestore(
  onData: (partners: PartnerRegistration[]) => void,
  onError?: (err: Error) => void
): () => void {
  const firestore = requireFirestore();
  const path = 'partners';
  const q = query(collection(firestore, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        normalizePartnerDoc(d.data() as Record<string, unknown>)
      );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );
}

export function subscribeWeeklyDepositsFirestore(
  onData: (deposits: WeeklyCommissionDeposit[]) => void,
  onError?: (err: Error) => void
): () => void {
  const firestore = requireFirestore();
  const path = 'weekly_deposits';
  const q = query(collection(firestore, path), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        normalizeWeeklyDepositDoc(d.data() as Record<string, unknown>)
      );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped as Error);
      }
    }
  );
}

export async function loadCommissionSettingsFirestore(): Promise<CommissionSettings> {
  const firestore = requireFirestore();
  const path = 'settings/commission';
  try {
    const snap = await getDoc(doc(firestore, 'settings', 'commission'));
    if (!snap.exists()) {
      return DEFAULT_COMMISSION_SETTINGS;
    }
    const data = snap.data();
    return {
      platformCommissionPercent: Number(data.platformCommissionPercent || 10),
      minimumPlatformFeeRp: Number(data.minimumPlatformFeeRp || 20000),
      updatedAt: toIsoString(data.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveCommissionSettingsFirestore(
  minimumPlatformFeeRp: number
): Promise<CommissionSettings> {
  const firestore = requireFirestore();
  const path = 'settings/commission';
  const safeMinFee = Math.max(0, Math.min(10000000, Math.round(minimumPlatformFeeRp)));
  try {
    await setDoc(doc(firestore, 'settings', 'commission'), {
      platformCommissionPercent: 10,
      minimumPlatformFeeRp: safeMinFee,
      updatedAt: serverTimestamp(),
    });
    return {
      platformCommissionPercent: 10,
      minimumPlatformFeeRp: safeMinFee,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ============================================================================
// ADMIN MUTATIONS (FIRESTORE)
// ============================================================================

export async function verifyPartnerFirestore(
  partner: PartnerRegistration,
  status: PartnerVerificationStatus,
  rejectionReason?: string
): Promise<void> {
  const firestore = requireFirestore();
  const partnerPath = `partners/${partner.id}`;
  const cleanReason =
    status === 'DITOLAK'
      ? (rejectionReason?.trim() || 'Data pendaftaran belum memenuhi kriteria verifikasi.').slice(
          0,
          300
        )
      : null;

  try {
    const statusRef = doc(firestore, 'partner_status', partner.registrationNumber);
    const existingStatusSnap = await getDoc(statusRef);

    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'partners', partner.id), {
      status,
      rejectionReason: cleanReason,
      updatedAt: serverTimestamp(),
    });

    if (existingStatusSnap.exists()) {
      batch.update(statusRef, {
        status,
        rejectionReason: cleanReason,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(statusRef, {
        registrationNumber: partner.registrationNumber,
        status,
        partnershipType: partner.partnershipType,
        services: partner.services.slice(0, 6),
        vehicleBrandType: partner.vehicleBrandType.slice(0, 120),
        availability: partner.availability,
        ...(cleanReason ? { rejectionReason: cleanReason } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, partnerPath);
  }
}

export function canDeletePartner(partner: PartnerRegistration): boolean {
  return partner.status === 'DITOLAK' || partner.availability === 'TIDAK_TERSEDIA';
}

export async function updatePartnerAvailabilityFirestore(
  partner: PartnerRegistration,
  availability: VehicleAvailability
): Promise<void> {
  const firestore = requireFirestore();
  const partnerPath = `partners/${partner.id}`;

  try {
    const statusRef = doc(firestore, 'partner_status', partner.registrationNumber);
    const existingStatusSnap = await getDoc(statusRef);

    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'partners', partner.id), {
      availability,
      updatedAt: serverTimestamp(),
    });

    if (existingStatusSnap.exists()) {
      batch.update(statusRef, {
        availability,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(statusRef, {
        registrationNumber: partner.registrationNumber,
        status: partner.status,
        partnershipType: partner.partnershipType,
        services: partner.services.slice(0, 6),
        vehicleBrandType: partner.vehicleBrandType.slice(0, 120),
        availability,
        ...(partner.rejectionReason
          ? { rejectionReason: partner.rejectionReason.slice(0, 300) }
          : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, partnerPath);
  }
}

export async function deletePartnerFirestore(
  partner: PartnerRegistration
): Promise<void> {
  if (!canDeletePartner(partner)) {
    throw new Error(
      'Hanya mitra yang berstatus Ditolak atau Tidak Aktif (Tidak Tersedia) yang dapat dihapus.'
    );
  }

  const firestore = requireFirestore();
  const partnerPath = `partners/${partner.id}`;

  try {
    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, 'partners', partner.id));
    if (partner.registrationNumber.trim()) {
      batch.delete(doc(firestore, 'partner_status', partner.registrationNumber.trim()));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, partnerPath);
  }
}

export async function offerBookingToPartnerFirestore(
  booking: OperationalBookingRecord,
  partner: PartnerRegistration
): Promise<void> {
  const firestore = requireFirestore();
  const path = `bookings/${booking.bookingId}`;
  const nowIso = new Date().toISOString();

  const nextHistory = sanitizeHistoryEntries([
    ...booking.assignmentHistory,
    {
      timestamp: nowIso,
      action: `Admin mengirim penawaran ke mitra ${partner.fullName} (${partner.licensePlate})`,
      partnerId: partner.id,
      partnerName: partner.fullName,
      status: 'DITAWARKAN',
    },
  ]);

  try {
    await updateDoc(doc(firestore, 'bookings', booking.bookingId), {
      assignedPartnerId: partner.id,
      assignedPartnerName: partner.fullName.slice(0, 120),
      assignmentStatus: 'DITAWARKAN' as AssignmentStatus,
      adminConfirmedPartnerReady: false,
      assignmentHistory: nextHistory,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function respondPartnerOfferFirestore(
  booking: OperationalBookingRecord,
  response: 'DITERIMA' | 'DITOLAK',
  note?: string
): Promise<void> {
  const firestore = requireFirestore();
  const path = `bookings/${booking.bookingId}`;
  const nowIso = new Date().toISOString();
  const isAccepted = response === 'DITERIMA';
  const nextBookingStatus: BookingStatus =
    !isAccepted && booking.bookingStatus === 'ASSIGNED'
      ? 'NEW'
      : booking.bookingStatus;

  const nextHistory = sanitizeHistoryEntries([
    ...booking.assignmentHistory,
    {
      timestamp: nowIso,
      action: isAccepted
        ? `Mitra ${booking.assignedPartnerName || ''} menerima penawaran order`
        : `Mitra ${booking.assignedPartnerName || ''} menolak/membatalkan order`,
      partnerId: booking.assignedPartnerId,
      partnerName: booking.assignedPartnerName,
      status: response,
      ...(note?.trim() ? { note: note.trim().slice(0, 300) } : {}),
    },
  ]);

  try {
    await updateDoc(doc(firestore, 'bookings', booking.bookingId), {
      assignmentStatus: response,
      adminConfirmedPartnerReady: isAccepted,
      bookingStatus: nextBookingStatus,
      assignmentHistory: nextHistory,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function assignPartnerConfirmedFirestore(
  booking: OperationalBookingRecord
): Promise<void> {
  if (!booking.assignedPartnerId || booking.assignmentStatus !== 'DITERIMA') {
    return;
  }
  const firestore = requireFirestore();
  const path = `bookings/${booking.bookingId}`;
  const nowIso = new Date().toISOString();
  const nextStatus: BookingStatus =
    booking.bookingStatus === 'CONFIRMED' ? 'CONFIRMED' : 'ASSIGNED';

  const nextHistory = sanitizeHistoryEntries([
    ...booking.assignmentHistory,
    {
      timestamp: nowIso,
      action: `Penugasan resmi diterbitkan untuk ${booking.assignedPartnerName || 'Mitra'}`,
      partnerId: booking.assignedPartnerId,
      partnerName: booking.assignedPartnerName,
      status: 'DITUGASKAN',
    },
  ]);

  try {
    await updateDoc(doc(firestore, 'bookings', booking.bookingId), {
      assignmentStatus: 'DITUGASKAN' as AssignmentStatus,
      bookingStatus: nextStatus,
      assignmentHistory: nextHistory,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function confirmBookingByAdminFirestore(
  booking: OperationalBookingRecord,
  agreedFareRp: number
): Promise<{ ok: boolean; error?: string }> {
  if (agreedFareRp <= 0) {
    return {
      ok: false,
      error: 'Tarif jasa akhir yang disepakati harus lebih dari Rp 0.',
    };
  }

  const partnerReady =
    Boolean(booking.assignedPartnerId) &&
    (booking.assignmentStatus === 'DITERIMA' ||
      booking.assignmentStatus === 'DITUGASKAN' ||
      booking.assignmentStatus === 'SELESAI');

  if (!partnerReady) {
    return {
      ok: false,
      error:
        'Mitra harus ditawarkan dan menerima order (status DITERIMA / DITUGASKAN) sebelum booking berstatus DIKONFIRMASI.',
    };
  }

  const firestore = requireFirestore();
  const path = `bookings/${booking.bookingId}`;
  const nowIso = new Date().toISOString();
  const safeFare = Math.round(agreedFareRp);
  const commissionAmountRp = calculateCommission10Percent(safeFare);
  const totalCashDueRp =
    safeFare + booking.tollFeeRp + booking.parkingFeeRp + booking.extraFeeRp;
  const nextAssignmentStatus: AssignmentStatus =
    booking.assignmentStatus === 'DITERIMA' ? 'DITUGASKAN' : booking.assignmentStatus;

  const nextHistory = sanitizeHistoryEntries([
    ...booking.assignmentHistory,
    {
      timestamp: nowIso,
      action: `Admin konfirmasi tarif jasa ${formatRupiah(safeFare)} & status DIKONFIRMASI`,
      partnerId: booking.assignedPartnerId,
      partnerName: booking.assignedPartnerName,
      status: nextAssignmentStatus,
    },
  ]);

  try {
    await updateDoc(doc(firestore, 'bookings', booking.bookingId), {
      agreedFareRp: safeFare,
      totalCashDueRp,
      commissionRate: PLATFORM_COMMISSION_RATE,
      commissionAmountRp,
      adminConfirmedPartnerReady: true,
      bookingStatus: 'CONFIRMED' as BookingStatus,
      assignmentStatus: nextAssignmentStatus,
      assignmentHistory: nextHistory,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCashTransactionFirestore(
  booking: OperationalBookingRecord,
  params: {
    agreedFareRp: number;
    tollFeeRp: number;
    parkingFeeRp: number;
    extraFeeRp: number;
    partnerConfirmedCash: boolean;
    adminVerifiedCash: boolean;
  }
): Promise<void> {
  const firestore = requireFirestore();
  const path = `bookings/${booking.bookingId}`;
  const agreedFareRp = Math.max(0, Math.round(params.agreedFareRp));
  const tollFeeRp = Math.max(0, Math.round(params.tollFeeRp));
  const parkingFeeRp = Math.max(0, Math.round(params.parkingFeeRp));
  const extraFeeRp = Math.max(0, Math.round(params.extraFeeRp));
  const totalCashDueRp = agreedFareRp + tollFeeRp + parkingFeeRp + extraFeeRp;
  const commissionAmountRp = calculateCommission10Percent(agreedFareRp);

  let cashPaymentStatus: CashPaymentStatus = 'BELUM_DIBAYAR';
  if (params.partnerConfirmedCash && params.adminVerifiedCash) {
    cashPaymentStatus = 'DIBAYAR';
  } else if (params.partnerConfirmedCash) {
    cashPaymentStatus = 'PERLU_VERIFIKASI';
  }

  try {
    await updateDoc(doc(firestore, 'bookings', booking.bookingId), {
      agreedFareRp,
      tollFeeRp,
      parkingFeeRp,
      extraFeeRp,
      totalCashDueRp,
      commissionRate: PLATFORM_COMMISSION_RATE,
      commissionAmountRp,
      partnerConfirmedCash: params.partnerConfirmedCash,
      cashPaymentStatus,
      paymentStatus: cashPaymentStatus === 'DIBAYAR' ? 'PAID' : 'UNPAID',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function completeTripFirestore(
  booking: OperationalBookingRecord
): Promise<void> {
  const firestore = requireFirestore();
  const path = `bookings/${booking.bookingId}`;
  const nowIso = new Date().toISOString();
  const fareForCommission = booking.agreedFareRp > 0 ? booking.agreedFareRp : 0;
  const commissionAmountRp = calculateCommission10Percent(fareForCommission);

  const nextHistory = sanitizeHistoryEntries([
    ...booking.assignmentHistory,
    {
      timestamp: nowIso,
      action: 'Perjalanan ditandai SELESAI oleh admin',
      partnerId: booking.assignedPartnerId,
      partnerName: booking.assignedPartnerName,
      status: 'SELESAI',
    },
  ]);

  try {
    await updateDoc(doc(firestore, 'bookings', booking.bookingId), {
      bookingStatus: 'COMPLETED' as BookingStatus,
      assignmentStatus: 'SELESAI' as AssignmentStatus,
      commissionRate: PLATFORM_COMMISSION_RATE,
      commissionAmountRp,
      assignmentHistory: nextHistory,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cancelBookingFirestore(
  booking: OperationalBookingRecord,
  reason: string
): Promise<void> {
  const firestore = requireFirestore();
  const path = `bookings/${booking.bookingId}`;
  const nowIso = new Date().toISOString();
  const cleanReason = (reason.trim() || 'Dibatalkan oleh admin').slice(0, 300);

  const nextHistory = sanitizeHistoryEntries([
    ...booking.assignmentHistory,
    {
      timestamp: nowIso,
      action: `Booking dibatalkan: ${cleanReason}`.slice(0, 300),
      partnerId: booking.assignedPartnerId,
      partnerName: booking.assignedPartnerName,
      status: booking.assignmentStatus,
    },
  ]);

  try {
    await updateDoc(doc(firestore, 'bookings', booking.bookingId), {
      bookingStatus: 'CANCELLED' as BookingStatus,
      cancellationReason: cleanReason,
      assignmentHistory: nextHistory,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBookingFirestore(bookingId: string): Promise<void> {
  const firestore = requireFirestore();
  const path = `bookings/${bookingId}`;
  try {
    await deleteDoc(doc(firestore, 'bookings', bookingId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createWeeklyDepositFirestore(params: {
  partnerId: string;
  partnerName: string;
  partnerWhatsapp: string;
  bookingCodes: string[];
  totalServiceFareRp: number;
  totalCommission10PercentRp: number;
  unpaidDepositRp: number;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  existingDeposits: WeeklyCommissionDeposit[];
}): Promise<void> {
  const firestore = requireFirestore();
  const depositId = `DEP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const path = `weekly_deposits/${depositId}`;

  const alreadyBilledCodes = new Set<string>();
  for (const dep of params.existingDeposits) {
    for (const code of dep.bookingCodes) {
      alreadyBilledCodes.add(code);
    }
  }

  const unbilledCodes = params.bookingCodes.filter(
    (code) => !alreadyBilledCodes.has(code)
  );
  const codesToInclude = (
    unbilledCodes.length > 0 ? unbilledCodes : params.bookingCodes
  )
    .slice(0, 100)
    .map((c) => c.slice(0, 32));

  const totalCommissionRp =
    params.unpaidDepositRp > 0
      ? params.unpaidDepositRp
      : params.totalCommission10PercentRp;

  try {
    await setDoc(doc(firestore, 'weekly_deposits', depositId), {
      depositId,
      partnerId: params.partnerId.slice(0, 128),
      partnerName: params.partnerName.slice(0, 120),
      partnerWhatsapp: params.partnerWhatsapp.slice(0, 24),
      periodLabel: (params.periodLabel.trim() || 'Periode Mingguan').slice(0, 120),
      periodStart: params.periodStart.slice(0, 10),
      periodEnd: params.periodEnd.slice(0, 10),
      dueDate: params.dueDate.slice(0, 10),
      bookingCodes: codesToInclude,
      totalServiceFareRp: Math.max(0, Math.round(params.totalServiceFareRp)),
      commissionRatePercent: 10,
      totalCommissionRp: Math.max(0, Math.round(totalCommissionRp)),
      paidAmountRp: 0,
      remainingDueRp: Math.max(0, Math.round(totalCommissionRp)),
      transferProofRef: '',
      transferNote: 'Menunggu transfer setoran mingguan mitra',
      status: 'BELUM_DIBAYAR',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function submitDepositTransferProofFirestore(
  deposit: WeeklyCommissionDeposit,
  transferProofRef: string,
  paidAmountRp: number,
  transferNote: string
): Promise<void> {
  const firestore = requireFirestore();
  const path = `weekly_deposits/${deposit.depositId}`;
  const safePaid = Math.max(0, Math.round(paidAmountRp));
  const remainingDueRp = Math.max(0, deposit.totalCommissionRp - safePaid);

  try {
    await updateDoc(doc(firestore, 'weekly_deposits', deposit.depositId), {
      paidAmountRp: safePaid,
      remainingDueRp,
      transferProofRef: transferProofRef.trim().slice(0, 100),
      transferNote: transferNote.trim().slice(0, 200),
      status: 'PERLU_VERIFIKASI',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function verifyWeeklyDepositFirestore(
  deposit: WeeklyCommissionDeposit
): Promise<void> {
  const firestore = requireFirestore();
  const path = `weekly_deposits/${deposit.depositId}`;
  const finalPaid =
    deposit.paidAmountRp > 0 ? deposit.paidAmountRp : deposit.totalCommissionRp;
  const remainingDueRp = Math.max(0, deposit.totalCommissionRp - finalPaid);

  try {
    await updateDoc(doc(firestore, 'weekly_deposits', deposit.depositId), {
      paidAmountRp: finalPaid,
      remainingDueRp,
      status: 'SUDAH_DIVERIFIKASI',
      verifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function upsertImportedBookingsFirestore(
  imported: OperationalBookingRecord[],
  existingBookings: OperationalBookingRecord[]
): Promise<{ addedCount: number; skippedCount: number }> {
  const firestore = requireFirestore();
  const existingCodeSet = new Set(
    existingBookings.map((b) => b.bookingCode.trim().toUpperCase())
  );
  let addedCount = 0;
  let skippedCount = 0;
  const batch = writeBatch(firestore);

  for (const item of imported) {
    const code = item.bookingCode.trim().toUpperCase();
    if (!code || existingCodeSet.has(code)) {
      skippedCount += 1;
      continue;
    }
    existingCodeSet.add(code);
    const safeId = item.bookingId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    batch.set(doc(firestore, 'bookings', safeId), {
      bookingId: safeId,
      bookingCode: code.slice(0, 32),
      tripType: item.tripType,
      tripDetails: item.tripDetails || {},
      customerName: item.customerName.slice(0, 120),
      customerPhone: item.customerPhone.slice(0, 24),
      pickupAddress: item.pickupAddress.slice(0, 300),
      destinationAddress: item.destinationAddress.slice(0, 300),
      pickupCoordinates: item.pickupCoordinates ?? null,
      destinationCoordinates: item.destinationCoordinates ?? null,
      travelDate: item.travelDate.slice(0, 10),
      travelTime: item.travelTime.slice(0, 5),
      passengerCount: Math.min(50, Math.max(1, Math.round(item.passengerCount || 1))),
      distanceKm: item.distanceKm ?? null,
      estimatedDuration: item.estimatedDuration ? item.estimatedDuration.slice(0, 64) : null,
      customerNotes: (item.customerNotes || '').slice(0, 500),
      bookingStatus: item.bookingStatus,
      paymentStatus: item.paymentStatus,
      assignedPartnerId: item.assignedPartnerId ?? null,
      assignedPartnerName: item.assignedPartnerName
        ? item.assignedPartnerName.slice(0, 120)
        : null,
      assignmentStatus: item.assignmentStatus,
      assignmentHistory: sanitizeHistoryEntries(item.assignmentHistory || []),
      customerUid: item.customerUid ?? null,
      internalEstimatedFareRp: Math.max(0, Math.round(item.internalEstimatedFareRp || 0)),
      agreedFareRp: Math.max(0, Math.round(item.agreedFareRp || 0)),
      tollFeeRp: Math.max(0, Math.round(item.tollFeeRp || 0)),
      parkingFeeRp: Math.max(0, Math.round(item.parkingFeeRp || 0)),
      extraFeeRp: Math.max(0, Math.round(item.extraFeeRp || 0)),
      totalCashDueRp: Math.max(0, Math.round(item.totalCashDueRp || 0)),
      cashPaymentStatus: item.cashPaymentStatus,
      partnerConfirmedCash: Boolean(item.partnerConfirmedCash),
      commissionRate: PLATFORM_COMMISSION_RATE,
      commissionAmountRp: Math.max(0, Math.round(item.commissionAmountRp || 0)),
      adminConfirmedPartnerReady: Boolean(item.adminConfirmedPartnerReady),
      ...(item.cancellationReason
        ? { cancellationReason: item.cancellationReason.slice(0, 300) }
        : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: 'IMPORT_CSV',
    });
    addedCount += 1;
  }

  if (addedCount > 0) {
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bookings');
    }
  }

  return { addedCount, skippedCount };
}

export async function seedInitialOperationalDataFirestore(): Promise<void> {
  const firestore = requireFirestore();
  const batch = writeBatch(firestore);

  for (const partner of SEED_PARTNERS) {
    batch.set(doc(firestore, 'partners', partner.id), {
      id: partner.id,
      registrationNumber: partner.registrationNumber,
      status: partner.status,
      fullName: partner.fullName,
      whatsapp: partner.whatsapp,
      email: partner.email,
      address: partner.address,
      district: partner.district,
      regency: partner.regency,
      partnershipType: partner.partnershipType,
      services: partner.services,
      ...(partner.otherServiceNote
        ? { otherServiceNote: partner.otherServiceNote }
        : {}),
      vehicleBrandType: partner.vehicleBrandType,
      vehicleYear: partner.vehicleYear,
      licensePlate: partner.licensePlate,
      passengerCapacity: partner.passengerCapacity,
      operationalArea: partner.operationalArea,
      availability: partner.availability,
      documents: partner.documents,
      ...(partner.rejectionReason ? { rejectionReason: partner.rejectionReason } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(firestore, 'partner_status', partner.registrationNumber), {
      registrationNumber: partner.registrationNumber,
      status: partner.status,
      partnershipType: partner.partnershipType,
      services: partner.services,
      vehicleBrandType: partner.vehicleBrandType,
      availability: partner.availability,
      ...(partner.rejectionReason ? { rejectionReason: partner.rejectionReason } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const booking of SEED_OPERATIONAL_BOOKINGS) {
    batch.set(doc(firestore, 'bookings', booking.bookingId), {
      bookingId: booking.bookingId,
      bookingCode: booking.bookingCode,
      tripType: booking.tripType,
      tripDetails: booking.tripDetails || {},
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      pickupAddress: booking.pickupAddress,
      destinationAddress: booking.destinationAddress,
      pickupCoordinates: booking.pickupCoordinates ?? null,
      destinationCoordinates: booking.destinationCoordinates ?? null,
      travelDate: booking.travelDate,
      travelTime: booking.travelTime,
      passengerCount: booking.passengerCount,
      distanceKm: booking.distanceKm ?? null,
      estimatedDuration: booking.estimatedDuration ?? null,
      customerNotes: booking.customerNotes,
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      assignedPartnerId: booking.assignedPartnerId ?? null,
      assignedPartnerName: booking.assignedPartnerName ?? null,
      assignmentStatus: booking.assignmentStatus,
      assignmentHistory: sanitizeHistoryEntries(booking.assignmentHistory || []),
      customerUid: booking.customerUid ?? null,
      internalEstimatedFareRp: booking.internalEstimatedFareRp,
      agreedFareRp: booking.agreedFareRp,
      tollFeeRp: booking.tollFeeRp,
      parkingFeeRp: booking.parkingFeeRp,
      extraFeeRp: booking.extraFeeRp,
      totalCashDueRp: booking.totalCashDueRp,
      cashPaymentStatus: booking.cashPaymentStatus,
      partnerConfirmedCash: booking.partnerConfirmedCash,
      commissionRate: booking.commissionRate,
      commissionAmountRp: booking.commissionAmountRp,
      adminConfirmedPartnerReady: booking.adminConfirmedPartnerReady,
      ...(booking.cancellationReason
        ? { cancellationReason: booking.cancellationReason }
        : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: 'SEED_DEMO',
    });
  }

  for (const dep of SEED_WEEKLY_DEPOSITS) {
    batch.set(doc(firestore, 'weekly_deposits', dep.depositId), {
      depositId: dep.depositId,
      partnerId: dep.partnerId,
      partnerName: dep.partnerName,
      partnerWhatsapp: dep.partnerWhatsapp,
      periodLabel: dep.periodLabel,
      periodStart: dep.periodStart,
      periodEnd: dep.periodEnd,
      dueDate: dep.dueDate,
      bookingCodes: dep.bookingCodes,
      totalServiceFareRp: dep.totalServiceFareRp,
      commissionRatePercent: dep.commissionRatePercent,
      totalCommissionRp: dep.totalCommissionRp,
      paidAmountRp: dep.paidAmountRp,
      remainingDueRp: dep.remainingDueRp,
      transferProofRef: dep.transferProofRef,
      transferNote: dep.transferNote,
      status: dep.status,
      ...(dep.status === 'SUDAH_DIVERIFIKASI' ? { verifiedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    });
  }

  batch.set(doc(firestore, 'settings', 'commission'), {
    platformCommissionPercent: DEFAULT_COMMISSION_SETTINGS.platformCommissionPercent,
    minimumPlatformFeeRp: DEFAULT_COMMISSION_SETTINGS.minimumPlatformFeeRp,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'bookings');
  }
}
