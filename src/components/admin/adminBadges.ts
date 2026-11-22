import {
  AssignmentStatus,
  BookingStatus,
  CashPaymentStatus,
} from '../../types/booking';
import { WeeklyDepositStatus } from '../../types/partner';

export const BOOKING_STATUS_LABEL_MAP: Record<BookingStatus, string> = {
  NEW: 'Baru',
  CONFIRMED: 'Dikonfirmasi',
  ASSIGNED: 'Ditugaskan',
  IN_PROGRESS: 'Berjalan',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export const ASSIGNMENT_STATUS_BADGE_MAP: Record<
  AssignmentStatus,
  { label: string; className: string }
> = {
  MENUNGGU_MITRA: {
    label: 'Menunggu Mitra',
    className: 'bg-slate-100 text-slate-800',
  },
  DITAWARKAN: {
    label: 'Ditawarkan',
    className: 'bg-amber-100 text-amber-900',
  },
  DITERIMA: {
    label: 'Diterima Mitra',
    className: 'bg-emerald-100 text-emerald-900',
  },
  DITOLAK: {
    label: 'Ditolak Mitra',
    className: 'bg-red-100 text-red-900',
  },
  DITUGASKAN: {
    label: 'Ditugaskan',
    className: 'bg-forest-900 text-white',
  },
  SELESAI: {
    label: 'Selesai',
    className: 'bg-emerald-200 text-emerald-950',
  },
};

export const CASH_STATUS_BADGE_MAP: Record<
  CashPaymentStatus,
  { label: string; className: string }
> = {
  BELUM_DIBAYAR: {
    label: 'Belum Dibayar',
    className: 'bg-slate-100 text-slate-700',
  },
  PERLU_VERIFIKASI: {
    label: 'Perlu Verifikasi',
    className: 'bg-amber-100 text-amber-900',
  },
  DIBAYAR: {
    label: 'Dibayar (Terverifikasi)',
    className: 'bg-emerald-100 text-emerald-900',
  },
};

export const DEPOSIT_STATUS_BADGE_MAP: Record<
  WeeklyDepositStatus,
  { label: string; className: string }
> = {
  BELUM_DIBAYAR: {
    label: 'Belum Dibayar',
    className: 'bg-red-100 text-red-900',
  },
  PERLU_VERIFIKASI: {
    label: 'Perlu Verifikasi',
    className: 'bg-amber-100 text-amber-900',
  },
  SUDAH_DIVERIFIKASI: {
    label: 'Sudah Diverifikasi',
    className: 'bg-emerald-100 text-emerald-900',
  },
};
