import {
  OperationalBookingRecord,
  TRIP_TYPE_LABELS,
  TripType,
} from '../types/booking';
import {
  PARTNERSHIP_TYPE_LABELS,
  PARTNER_STATUS_LABELS,
  PartnerRegistration,
  VEHICLE_AVAILABILITY_LABELS,
  WEEKLY_DEPOSIT_STATUS_LABELS,
  WeeklyCommissionDeposit,
} from '../types/partner';
import {
  WHATSAPP_TEMPLATE_LIST,
  buildTemplateBookingMasukAdmin,
  buildTemplateKonfirmasiPelanggan,
  buildTemplatePenagihanKomisiMingguan,
  buildTemplatePenawaranMitra,
} from './whatsappTemplates';

export const GOOGLE_SHEETS_TABS = [
  'Dashboard',
  'Booking',
  'Mitra',
  'Penugasan',
  'Komisi',
  'Template WA',
] as const;

export type GoogleSheetsTabName = (typeof GOOGLE_SHEETS_TABS)[number];

export interface GoogleSheetsConnectionStatus {
  mode: 'DEMO_LOCAL_CSV' | 'APPS_SCRIPT_READY';
  endpointConfigured: boolean;
  label: string;
  description: string;
}

const APPS_SCRIPT_PUBLIC_URL =
  import.meta.env?.VITE_GOOGLE_SHEETS_WEBAPP_URL?.trim() || '';

export function getGoogleSheetsConnectionStatus(): GoogleSheetsConnectionStatus {
  if (APPS_SCRIPT_PUBLIC_URL && APPS_SCRIPT_PUBLIC_URL.startsWith('https://')) {
    return {
      mode: 'APPS_SCRIPT_READY',
      endpointConfigured: true,
      label: 'Endpoint Apps Script Terdeteksi (Siap Sinkronisasi Backend)',
      description:
        'URL endpoint publik tersedia di env. Pastikan secret & token otorisasi tetap berada di backend/Apps Script.',
    };
  }
  return {
    mode: 'DEMO_LOCAL_CSV',
    endpointConfigured: false,
    label: 'Mode Demo (Ekspor & Impor CSV Lokal) — Belum Terhubung ke Google Sheets',
    description:
      'Endpoint Google Apps Script / backend tepercaya belum dikonfigurasi. Gunakan ekspor/impor CSV yang kompatibel dengan struktur 6 tab Google Sheets.',
  };
}

/**
 * Mencegah formula injection (=, +, -, @, tab, cr) saat dibuka di Google Sheets / Excel.
 */
function sanitizeCsvCell(raw: string | number | boolean | null | undefined): string {
  const str = raw === null || raw === undefined ? '' : String(raw);
  const formulaSafe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  const escaped = formulaSafe.replace(/"/g, '""');
  return `"${escaped}"`;
}

function toCsvDocument(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(',');
  const dataLines = rows.map((row) =>
    row.map((cell) => sanitizeCsvCell(cell)).join(',')
  );
  // UTF-8 BOM agar karakter Indonesia & angka langsung terbaca rapi saat diimpor ke Google Sheets/Excel
  return `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;
}

export function triggerCsvDownload(filename: string, csvContent: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildBookingsCsv(bookings: OperationalBookingRecord[]): string {
  const headers = [
    'bookingCode',
    'tripType',
    'customerName',
    'customerPhone',
    'pickupAddress',
    'destinationAddress',
    'travelDate',
    'travelTime',
    'passengerCount',
    'distanceKm',
    'estimatedDuration',
    'waitDuration',
    'waitMode',
    'estimatedEndDate',
    'estimatedEndTime',
    'returnDate',
    'returnTime',
    'returnDestination',
    'rentalDuration',
    'usageNeeds',
    'customerNotes',
    'bookingStatus',
    'assignmentStatus',
    'assignedPartnerName',
    'agreedFareRp',
    'tollFeeRp',
    'parkingFeeRp',
    'extraFeeRp',
    'totalCashDueRp',
    'cashPaymentStatus',
    'commissionAmountRp',
  ];

  const rows = bookings.map((b) => [
    b.bookingCode,
    TRIP_TYPE_LABELS[b.tripType],
    b.customerName,
    b.customerPhone,
    b.pickupAddress,
    b.destinationAddress,
    b.travelDate,
    b.travelTime,
    b.passengerCount,
    b.distanceKm ?? '',
    b.estimatedDuration ?? '',
    b.tripDetails.waitDuration ?? '',
    b.tripDetails.waitMode ?? '',
    b.tripDetails.estimatedEndDate ?? '',
    b.tripDetails.estimatedEndTime ?? '',
    b.tripDetails.returnDate ?? '',
    b.tripDetails.returnTime ?? '',
    b.tripDetails.returnDestination ?? '',
    b.tripDetails.rentalDuration ?? '',
    b.tripDetails.usageNeeds ?? '',
    b.customerNotes,
    b.bookingStatus,
    b.assignmentStatus,
    b.assignedPartnerName ?? '',
    b.agreedFareRp,
    b.tollFeeRp,
    b.parkingFeeRp,
    b.extraFeeRp,
    b.totalCashDueRp,
    b.cashPaymentStatus,
    b.commissionAmountRp,
  ]);

  return toCsvDocument(headers, rows);
}

export function buildPartnersCsv(partners: PartnerRegistration[]): string {
  const headers = [
    'registrationNumber',
    'status',
    'fullName',
    'whatsapp',
    'email',
    'address',
    'district',
    'regency',
    'partnershipType',
    'services',
    'vehicleBrandType',
    'vehicleYear',
    'licensePlate',
    'passengerCapacity',
    'operationalArea',
    'availability',
    'createdAt',
  ];

  const rows = partners.map((p) => [
    p.registrationNumber,
    PARTNER_STATUS_LABELS[p.status],
    p.fullName,
    p.whatsapp,
    p.email,
    p.address,
    p.district,
    p.regency,
    PARTNERSHIP_TYPE_LABELS[p.partnershipType],
    p.services.join('; '),
    p.vehicleBrandType,
    p.vehicleYear,
    p.licensePlate,
    p.passengerCapacity,
    p.operationalArea,
    VEHICLE_AVAILABILITY_LABELS[p.availability],
    p.createdAt,
  ]);

  return toCsvDocument(headers, rows);
}

export function buildCommissionCsv(
  bookings: OperationalBookingRecord[],
  deposits: WeeklyCommissionDeposit[]
): string {
  const headers = [
    'recordType',
    'referenceId',
    'partnerName',
    'bookingCodes',
    'serviceFareRp',
    'commissionRatePercent',
    'commissionAmountRp',
    'paidAmountRp',
    'remainingDueRp',
    'dueDate',
    'transferProofRef',
    'status',
  ];

  const completedRows = bookings
    .filter((b) => b.bookingStatus === 'COMPLETED')
    .map((b) => [
      'BOOKING_COMPLETED',
      b.bookingCode,
      b.assignedPartnerName ?? '-',
      b.bookingCode,
      b.agreedFareRp,
      10,
      b.commissionAmountRp,
      b.cashPaymentStatus === 'DIBAYAR' ? b.commissionAmountRp : 0,
      b.cashPaymentStatus === 'DIBAYAR' ? 0 : b.commissionAmountRp,
      b.travelDate,
      '',
      b.cashPaymentStatus,
    ]);

  const depositRows = deposits.map((d) => [
    'WEEKLY_DEPOSIT',
    d.depositId,
    d.partnerName,
    d.bookingCodes.join('; '),
    d.totalServiceFareRp,
    d.commissionRatePercent,
    d.totalCommissionRp,
    d.paidAmountRp,
    d.remainingDueRp,
    d.dueDate,
    d.transferProofRef,
    WEEKLY_DEPOSIT_STATUS_LABELS[d.status],
  ]);

  return toCsvDocument(headers, [...depositRows, ...completedRows]);
}

export function buildPeriodReportCsv(params: {
  startDate: string;
  endDate: string;
  bookings: OperationalBookingRecord[];
  partners: PartnerRegistration[];
  deposits: WeeklyCommissionDeposit[];
}): string {
  const filteredBookings = params.bookings.filter((b) => {
    if (params.startDate && b.travelDate < params.startDate) return false;
    if (params.endDate && b.travelDate > params.endDate) return false;
    return true;
  });

  const totalRevenue = filteredBookings.reduce(
    (sum, b) => sum + b.totalCashDueRp,
    0
  );
  const totalCommission = filteredBookings
    .filter((b) => b.bookingStatus === 'COMPLETED')
    .reduce((sum, b) => sum + b.commissionAmountRp, 0);

  const headers = [
    'tabSection',
    'kodeReferensi',
    'jenisAtauPeran',
    'nama',
    'detailRuteAtauArmada',
    'tanggal',
    'tarifJasaRp',
    'komisi10PersenRp',
    'status',
  ];

  const summaryRow = [
    'Dashboard',
    `PERIODE_${params.startDate || 'ALL'}_${params.endDate || 'ALL'}`,
    'RINGKASAN_PERIODE',
    `Total Booking: ${filteredBookings.length} | Mitra Aktif: ${
      params.partners.filter((p) => p.status === 'DISETUJUI').length
    }`,
    `Total Setoran Mingguan: ${params.deposits.length}`,
    new Date().toISOString().slice(0, 10),
    totalRevenue,
    totalCommission,
    'DEMO_REPORT',
  ];

  const bookingRows = filteredBookings.map((b) => [
    'Booking',
    b.bookingCode,
    TRIP_TYPE_LABELS[b.tripType],
    b.customerName,
    `${b.pickupAddress} -> ${b.destinationAddress}`,
    b.travelDate,
    b.agreedFareRp,
    b.commissionAmountRp,
    `${b.bookingStatus} / ${b.assignmentStatus}`,
  ]);

  const assignmentRows = filteredBookings.map((b) => [
    'Penugasan',
    b.bookingCode,
    b.assignmentStatus,
    b.assignedPartnerName ?? 'Belum Ditugaskan',
    `Riwayat: ${b.assignmentHistory.length} aktivitas`,
    b.travelDate,
    b.agreedFareRp,
    b.commissionAmountRp,
    b.cashPaymentStatus,
  ]);

  const templateRows = WHATSAPP_TEMPLATE_LIST.map((tpl) => [
    'Template WA',
    tpl.id,
    tpl.recipientLabel,
    tpl.title,
    tpl.description,
    '-',
    0,
    0,
    'READY',
  ]);

  return toCsvDocument(headers, [
    summaryRow,
    ...bookingRows,
    ...assignmentRows,
    ...templateRows,
  ]);
}

export function buildAllSixTabsPreview(params: {
  bookings: OperationalBookingRecord[];
  partners: PartnerRegistration[];
  deposits: WeeklyCommissionDeposit[];
}) {
  const sampleBooking = params.bookings[0];
  const samplePartner = params.partners[0] ?? null;
  const sampleDeposit = params.deposits[0];

  return {
    Dashboard: {
      totalBooking: params.bookings.length,
      totalMitra: params.partners.length,
      totalSetoran: params.deposits.length,
    },
    Booking: params.bookings.length,
    Mitra: params.partners.length,
    Penugasan: params.bookings.filter((b) => Boolean(b.assignedPartnerId)).length,
    Komisi: params.deposits.reduce((s, d) => s + d.totalCommissionRp, 0),
    'Template WA': sampleBooking
      ? [
          buildTemplateBookingMasukAdmin(sampleBooking),
          buildTemplatePenawaranMitra(sampleBooking, samplePartner),
          buildTemplateKonfirmasiPelanggan(sampleBooking, samplePartner),
          sampleDeposit
            ? buildTemplatePenagihanKomisiMingguan(sampleDeposit)
            : '',
        ].filter(Boolean).length
      : WHATSAPP_TEMPLATE_LIST.length,
  };
}

/**
 * Parser CSV aman dengan dukungan tanda kutip ganda & validasi baris impor booking.
 */
function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function stripFormulaEscape(val: string): string {
  return val.startsWith("'") ? val.slice(1) : val;
}

function resolveTripTypeFromLabel(raw: string): TripType {
  const upper = raw.trim().toUpperCase();
  if (upper.includes('AMBIL') && upper.includes('PAKET')) {
    return 'AMBIL_ANTAR_PAKET';
  }
  if (upper.includes('TUNGGU') || upper.includes('SEKOLAH') || upper.includes('ANAK')) {
    return 'ANTAR_TUNGGU';
  }
  if (upper.includes('PULANG') || upper === 'PP') return 'PULANG_PERGI';
  if (upper.includes('CARTER') || upper.includes('PENDAMPINGAN')) return 'CARTER';
  if (upper.includes('LIBURAN')) return 'LIBURAN_KELUARGA';
  if (upper.includes('RENTAL')) return 'RENTAL_SOPIR';
  return 'SEKALI_JALAN';
}

export function parseAndValidateBookingsCsvImport(csvText: string): {
  validRecords: OperationalBookingRecord[];
  errors: string[];
} {
  const cleanText = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleanText) {
    return { validRecords: [], errors: ['Berkas CSV kosong.'] };
  }

  const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      validRecords: [],
      errors: ['CSV harus berisi minimal 1 baris header dan 1 baris data.'],
    };
  }

  const headers = parseCsvRow(lines[0]).map((h) => stripFormulaEscape(h));
  const requiredHeaders = [
    'bookingCode',
    'customerName',
    'customerPhone',
    'pickupAddress',
    'destinationAddress',
    'travelDate',
  ];
  const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return {
      validRecords: [],
      errors: [`Kolom wajib tidak ditemukan: ${missingHeaders.join(', ')}`],
    };
  }

  const validRecords: OperationalBookingRecord[] = [];
  const errors: string[] = [];
  const seenCodesInFile = new Set<string>();
  const nowIso = new Date().toISOString();

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx += 1) {
    const cells = parseCsvRow(lines[rowIdx]).map(stripFormulaEscape);
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = cells[idx] ?? '';
    });

    const code = (rowObj.bookingCode || '').toUpperCase();
    if (!/^TK-[A-Z0-9-]+$/.test(code)) {
      errors.push(`Baris ${rowIdx + 1}: Format bookingCode tidak valid (${code || '-'}).`);
      continue;
    }
    if (seenCodesInFile.has(code)) {
      errors.push(`Baris ${rowIdx + 1}: Duplikasi bookingCode ${code} dalam berkas.`);
      continue;
    }
    seenCodesInFile.add(code);

    if (!rowObj.customerName || !rowObj.pickupAddress || !rowObj.destinationAddress) {
      errors.push(`Baris ${rowIdx + 1} (${code}): Nama, penjemputan, atau tujuan kosong.`);
      continue;
    }

    const rawPhone = (rowObj.customerPhone || '').trim();
    const normalizedPhone = rawPhone.length >= 8 ? rawPhone.slice(0, 24) : '0800000000';

    const rawDate = (rowObj.travelDate || '').trim();
    let normalizedDate = nowIso.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      normalizedDate = rawDate;
    } else {
      const dmyMatch = rawDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (dmyMatch) {
        normalizedDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
      }
    }

    const rawTime = (rowObj.travelTime || '').trim();
    const timeMatch = rawTime.match(/^(\d{1,2}):(\d{2})/);
    const normalizedTime = timeMatch
      ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
      : '08:00';

    const passengerCount = Math.min(
      50,
      Math.max(1, parseInt(rowObj.passengerCount || '1', 10) || 1)
    );
    const distanceKm = rowObj.distanceKm ? Number(rowObj.distanceKm) : null;
    const agreedFareRp = Math.max(0, Number(rowObj.agreedFareRp || 0) || 0);
    const tollFeeRp = Math.max(0, Number(rowObj.tollFeeRp || 0) || 0);
    const parkingFeeRp = Math.max(0, Number(rowObj.parkingFeeRp || 0) || 0);
    const extraFeeRp = Math.max(0, Number(rowObj.extraFeeRp || 0) || 0);

    validRecords.push({
      bookingId: `imp_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      bookingCode: code,
      tripType: resolveTripTypeFromLabel(rowObj.tripType || 'SEKALI_JALAN'),
      tripDetails: {
        waitDuration: rowObj.waitDuration || null,
        waitMode:
          rowObj.waitMode === 'JEMPUT_KEMBALI'
            ? 'JEMPUT_KEMBALI'
            : rowObj.waitMode === 'TUNGGU_DI_LOKASI'
              ? 'TUNGGU_DI_LOKASI'
              : null,
        estimatedEndDate: rowObj.estimatedEndDate || null,
        estimatedEndTime: rowObj.estimatedEndTime || null,
        returnDate: rowObj.returnDate || null,
        returnTime: rowObj.returnTime || null,
        returnDestination: rowObj.returnDestination || null,
        rentalDuration: rowObj.rentalDuration || null,
        usageNeeds: rowObj.usageNeeds || null,
      },
      customerName: rowObj.customerName.slice(0, 120),
      customerPhone: normalizedPhone,
      pickupAddress: rowObj.pickupAddress.slice(0, 300),
      destinationAddress: rowObj.destinationAddress.slice(0, 300),
      pickupCoordinates: null,
      destinationCoordinates: null,
      travelDate: normalizedDate,
      travelTime: normalizedTime,
      passengerCount,
      distanceKm: distanceKm !== null && !Number.isNaN(distanceKm) ? distanceKm : null,
      estimatedDuration: rowObj.estimatedDuration || null,
      customerNotes: (rowObj.customerNotes || '').slice(0, 500),
      bookingStatus: 'NEW',
      paymentStatus: 'UNPAID',
      assignedPartnerId: null,
      assignedPartnerName: rowObj.assignedPartnerName || null,
      assignmentStatus: 'MENUNGGU_MITRA',
      assignmentHistory: [
        {
          timestamp: nowIso,
          action: 'Diimpor dari CSV operasional',
          partnerId: null,
          partnerName: null,
          status: 'MENUNGGU_MITRA',
        },
      ],
      customerUid: null,
      internalEstimatedFareRp: 150000,
      agreedFareRp,
      tollFeeRp,
      parkingFeeRp,
      extraFeeRp,
      totalCashDueRp: agreedFareRp + tollFeeRp + parkingFeeRp + extraFeeRp,
      cashPaymentStatus: 'BELUM_DIBAYAR',
      partnerConfirmedCash: false,
      commissionRate: 0.1,
      commissionAmountRp: Math.round(agreedFareRp * 0.1),
      adminConfirmedPartnerReady: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      source: 'IMPORT_CSV',
    });
  }

  return { validRecords, errors };
}

/**
 * Adapter sinkronisasi ke Google Apps Script Web App / Backend (placeholder siap pakai).
 * Tidak menyimpan token/secret di frontend.
 */
export async function syncTabViaGoogleSheetsAdapter(params: {
  tabName: GoogleSheetsTabName;
  csvPayload: string;
}): Promise<{ ok: boolean; message: string }> {
  const status = getGoogleSheetsConnectionStatus();
  if (!status.endpointConfigured) {
    return {
      ok: false,
      message: `Tab "${params.tabName}" belum dapat dikirim langsung karena endpoint Google Apps Script / backend belum dikonfigurasi. Gunakan ekspor CSV lokal.`,
    };
  }

  return {
    ok: false,
    message: `Endpoint terdeteksi (${status.label}), namun sinkronisasi langsung harus dijalankan melalui backend tepercaya agar otorisasi Google Sheets aman.`,
  };
}
