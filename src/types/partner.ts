export type PartnerVerificationStatus =
  | 'MENUNGGU_VERIFIKASI'
  | 'DISETUJUI'
  | 'DITOLAK';

export type PartnershipType =
  | 'PEMILIK_KENDARAAN'
  | 'PENGEMUDI'
  | 'PEMILIK_DAN_PENGEMUDI';

export type PartnerServiceType =
  | 'MOBIL_PENUMPANG'
  | 'PICKUP'
  | 'ANTAR_JEMPUT'
  | 'CARTER_KENDARAAN'
  | 'RENTAL_DENGAN_SOPIR'
  | 'LAYANAN_LAINNYA';

export type VehicleAvailability =
  | 'TERSEDIA'
  | 'TERJADWAL'
  | 'TIDAK_TERSEDIA';

/**
 * Hanya menyimpan metadata nama berkas untuk simulasi tampilan demo.
 * Tidak menyimpan konten file, foto KTP, SIM, STNK, maupun base64 di localStorage.
 */
export interface PartnerDocumentPlaceholder {
  simFileName: string | null;
  stnkFileName: string | null;
  vehiclePhotoFileName: string | null;
  storageStatus: 'DEMO_NOT_UPLOADED';
}

export interface PartnerRegistrationInput {
  fullName: string;
  whatsapp: string;
  email: string;
  address: string;
  district: string;
  regency: string;
  partnershipType: PartnershipType;
  services: PartnerServiceType[];
  otherServiceNote?: string;
  vehicleBrandType: string;
  vehicleYear: string;
  licensePlate: string;
  passengerCapacity: number;
  operationalArea: string;
  availability: VehicleAvailability;
  documents: PartnerDocumentPlaceholder;
}

export interface PartnerRegistration extends PartnerRegistrationInput {
  id: string;
  registrationNumber: string;
  status: PartnerVerificationStatus;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionSettings {
  platformCommissionPercent: number; // Komisi resmi TripKita 10%
  minimumPlatformFeeRp: number;
  updatedAt: string;
}

export type WeeklyDepositStatus =
  | 'BELUM_DIBAYAR'
  | 'PERLU_VERIFIKASI'
  | 'SUDAH_DIVERIFIKASI';

export interface WeeklyCommissionDeposit {
  depositId: string;
  partnerId: string;
  partnerName: string;
  partnerWhatsapp: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  bookingCodes: string[];
  totalServiceFareRp: number;
  commissionRatePercent: number; // 10%
  totalCommissionRp: number;
  paidAmountRp: number;
  remainingDueRp: number;
  transferProofRef: string; // Hanya nomor/kode referensi non-sensitif (tidak menyimpan gambar)
  transferNote: string;
  status: WeeklyDepositStatus;
  verifiedAt?: string;
  updatedAt: string;
}

export interface PartnerCommissionSummary {
  partnerId: string;
  partnerName: string;
  partnerWhatsapp: string;
  vehicleLabel: string;
  completedBookingsCount: number;
  bookingCodes: string[];
  totalServiceFareRp: number;
  totalCommission10PercentRp: number;
  paidDepositRp: number;
  unpaidDepositRp: number;
}

export const PARTNERSHIP_TYPE_LABELS: Record<PartnershipType, string> = {
  PEMILIK_KENDARAAN: 'Pemilik kendaraan',
  PENGEMUDI: 'Pengemudi',
  PEMILIK_DAN_PENGEMUDI: 'Pemilik kendaraan sekaligus pengemudi',
};

export const PARTNER_SERVICE_LABELS: Record<PartnerServiceType, string> = {
  MOBIL_PENUMPANG: 'Mobil penumpang',
  PICKUP: 'Pickup',
  ANTAR_JEMPUT: 'Antar jemput',
  CARTER_KENDARAAN: 'Carter kendaraan',
  RENTAL_DENGAN_SOPIR: 'Rental dengan sopir',
  LAYANAN_LAINNYA: 'Layanan lainnya',
};

export const VEHICLE_AVAILABILITY_LABELS: Record<VehicleAvailability, string> = {
  TERSEDIA: 'Tersedia',
  TERJADWAL: 'Terjadwal',
  TIDAK_TERSEDIA: 'Tidak Tersedia',
};

export const PARTNER_STATUS_LABELS: Record<PartnerVerificationStatus, string> = {
  MENUNGGU_VERIFIKASI: 'Menunggu Verifikasi',
  DISETUJUI: 'Disetujui',
  DITOLAK: 'Ditolak',
};

export const WEEKLY_DEPOSIT_STATUS_LABELS: Record<WeeklyDepositStatus, string> = {
  BELUM_DIBAYAR: 'Belum Dibayar',
  PERLU_VERIFIKASI: 'Perlu Verifikasi',
  SUDAH_DIVERIFIKASI: 'Sudah Diverifikasi',
};
