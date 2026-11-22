import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Database,
  ExternalLink,
  FileSpreadsheet,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Percent,
  Receipt,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { AdminLoginView } from '../components/admin/AdminLoginView';
import {
  AdminAssignmentSection,
  AdminBookingsSection,
} from '../components/admin/AdminBookingSections';
import {
  AdminCommissionSection,
  AdminTransactionsSection,
  AdminWeeklyDepositsSection,
} from '../components/admin/AdminFinanceSections';
import {
  AdminReportsAndSheetsSection,
  AdminWhatsAppTemplatesSection,
} from '../components/admin/AdminReportsAndWaSections';
import { BOOKING_STATUS_LABEL_MAP } from '../components/admin/adminBadges';
import { TripKitaLogo } from '../components/TripKitaLogo';
import {
  getFirestoreConnectionDiagnostics,
  isFirebaseConfigured,
} from '../lib/firebase';
import {
  isAdminEmailMatch,
  isAuthorizedAdminUser,
  logoutUser,
  subscribeToAuthState,
} from '../services/authService';
import {
  assignPartnerConfirmedFirestore,
  cancelBookingFirestore,
  completeTripFirestore,
  confirmBookingByAdminFirestore,
  createWeeklyDepositFirestore,
  loadCommissionSettingsFirestore,
  offerBookingToPartnerFirestore,
  respondPartnerOfferFirestore,
  saveCommissionSettingsFirestore,
  seedInitialOperationalDataFirestore,
  submitDepositTransferProofFirestore,
  subscribeBookingsFirestore,
  subscribePartnersFirestore,
  subscribeWeeklyDepositsFirestore,
  updateCashTransactionFirestore,
  upsertImportedBookingsFirestore,
  verifyPartnerFirestore,
  verifyWeeklyDepositFirestore,
} from '../services/firestoreOpsService';
import {
  computePartnerCommissionSummaries,
  formatRupiah,
} from '../services/partnerDemoService';
import {
  BookingStatus,
  OperationalBookingRecord,
  TRIP_TYPE_LABELS,
  TripType,
} from '../types/booking';
import {
  CommissionSettings,
  PARTNERSHIP_TYPE_LABELS,
  PARTNER_SERVICE_LABELS,
  PARTNER_STATUS_LABELS,
  PartnerCommissionSummary,
  PartnerRegistration,
  PartnerVerificationStatus,
  VEHICLE_AVAILABILITY_LABELS,
  WeeklyCommissionDeposit,
} from '../types/partner';

type AdminTab =
  | 'ringkasan'
  | 'booking'
  | 'data-mitra'
  | 'verifikasi-mitra'
  | 'penugasan'
  | 'transaksi'
  | 'komisi'
  | 'setoran'
  | 'template-wa'
  | 'laporan';

const NAV_ITEMS: Array<{
  id: AdminTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'ringkasan', label: 'Dashboard Ringkasan', icon: LayoutDashboard },
  { id: 'booking', label: 'Booking Pelanggan', icon: CalendarCheck },
  { id: 'data-mitra', label: 'Data Mitra', icon: Users },
  { id: 'verifikasi-mitra', label: 'Verifikasi Mitra', icon: ClipboardCheck },
  { id: 'penugasan', label: 'Penugasan Perjalanan', icon: ClipboardList },
  { id: 'transaksi', label: 'Transaksi', icon: Receipt },
  { id: 'komisi', label: 'Komisi Mitra', icon: Percent },
  { id: 'setoran', label: 'Setoran Mingguan', icon: Wallet },
  { id: 'template-wa', label: 'Template WhatsApp', icon: MessageSquare },
  { id: 'laporan', label: 'Laporan Operasional', icon: FileSpreadsheet },
];

export function AdminDashboardPage() {
  const [authChecking, setAuthChecking] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [, setAuthRefreshTick] = useState(0);

  const [activeTab, setActiveTab] = useState<AdminTab>('ringkasan');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [partners, setPartners] = useState<PartnerRegistration[]>([]);
  const [bookings, setBookings] = useState<OperationalBookingRecord[]>([]);
  const [deposits, setDeposits] = useState<WeeklyCommissionDeposit[]>([]);
  const [commissionSettings, setCommissionSettings] =
    useState<CommissionSettings>({
      platformCommissionPercent: 10,
      minimumPlatformFeeRp: 20000,
      updatedAt: '',
    });

  const [loadingCollections, setLoadingCollections] = useState(false);
  const [seedingSample, setSeedingSample] = useState(false);
  const [actionNotice, setActionNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Verifikasi & Data Mitra state
  const [partnerFilter, setPartnerFilter] = useState<
    'ALL' | PartnerVerificationStatus
  >('ALL');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    null
  );
  const [rejectionInput, setRejectionInput] = useState('');

  // Filters Booking Pelanggan
  const [bookingFilters, setBookingFilters] = useState<{
    search: string;
    date: string;
    status: 'ALL' | BookingStatus;
    tripType: 'ALL' | TripType;
    partnerId: 'ALL' | string;
  }>({
    search: '',
    date: '',
    status: 'ALL',
    tripType: 'ALL',
    partnerId: 'ALL',
  });

  // Highlighted booking in Penugasan tab
  const [assignmentFocusBookingId, setAssignmentFocusBookingId] = useState<
    string | null
  >(null);

  // Auth listener
  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => {
      setAuthUser(user);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const isAuthorizedAdmin = isAuthorizedAdminUser(authUser);

  // Realtime Firestore listeners (hanya dipasang setelah admin terverifikasi)
  useEffect(() => {
    if (!isFirebaseConfigured || !isAuthorizedAdmin) {
      return;
    }

    setLoadingCollections(true);
    let loadedMask = 0;
    const markLoaded = (bit: number) => {
      loadedMask |= bit;
      if (loadedMask === 7) {
        setLoadingCollections(false);
      }
    };

    const handleListenerError = (err: Error) => {
      setLoadingCollections(false);
      setActionNotice({
        type: 'error',
        text: err.message.startsWith('{')
          ? 'Gagal memuat sebagian data dari Firestore. Pastikan akun admin memiliki izin akses.'
          : err.message,
      });
    };

    const unsubBookings = subscribeBookingsFirestore((nextBookings) => {
      setBookings(nextBookings);
      markLoaded(1);
    }, handleListenerError);

    const unsubPartners = subscribePartnersFirestore((nextPartners) => {
      setPartners(nextPartners);
      setSelectedPartnerId((prev) => prev ?? nextPartners[0]?.id ?? null);
      markLoaded(2);
    }, handleListenerError);

    const unsubDeposits = subscribeWeeklyDepositsFirestore((nextDeposits) => {
      setDeposits(nextDeposits);
      markLoaded(4);
    }, handleListenerError);

    void loadCommissionSettingsFirestore()
      .then((settings) => setCommissionSettings(settings))
      .catch(() => {
        // Gunakan default jika belum pernah disimpan
      });

    return () => {
      unsubBookings();
      unsubPartners();
      unsubDeposits();
    };
  }, [isAuthorizedAdmin]);

  const approvedPartners = useMemo(
    () => partners.filter((p) => p.status === 'DISETUJUI'),
    [partners]
  );

  const partnerCommissionSummaries = useMemo(
    () => computePartnerCommissionSummaries(bookings, partners, deposits),
    [bookings, partners, deposits]
  );

  // 10 KPI Dashboard Ringkasan sesuai spesifikasi
  const kpis = useMemo(() => {
    const totalBooking = bookings.length;
    const bookingBaru = bookings.filter((b) => b.bookingStatus === 'NEW').length;
    const bookingDikonfirmasi = bookings.filter(
      (b) => b.bookingStatus === 'CONFIRMED'
    ).length;
    const bookingSelesai = bookings.filter(
      (b) => b.bookingStatus === 'COMPLETED'
    ).length;
    const bookingDibatalkan = bookings.filter(
      (b) => b.bookingStatus === 'CANCELLED'
    ).length;

    const totalMitra = partners.length;
    const mitraAktif = approvedPartners.length;
    const mitraPending = partners.filter(
      (p) => p.status === 'MENUNGGU_VERIFIKASI'
    ).length;

    const komisiBelumDisetor = partnerCommissionSummaries.reduce(
      (sum, s) => sum + s.unpaidDepositRp,
      0
    );
    const komisiSudahDisetor = partnerCommissionSummaries.reduce(
      (sum, s) => sum + s.paidDepositRp,
      0
    );
    const totalNilaiTransaksi = bookings
      .filter((b) => b.bookingStatus !== 'CANCELLED')
      .reduce((sum, b) => sum + (b.totalCashDueRp || b.agreedFareRp || 0), 0);

    return {
      totalBooking,
      bookingBaru,
      bookingDikonfirmasi,
      bookingSelesai,
      bookingDibatalkan,
      totalMitra,
      mitraAktif,
      mitraPending,
      komisiBelumDisetor,
      komisiSudahDisetor,
      totalNilaiTransaksi,
    };
  }, [bookings, partners, approvedPartners, partnerCommissionSummaries]);

  const filteredPartners = useMemo(() => {
    const query = partnerSearch.trim().toLowerCase();
    return partners.filter((p) => {
      if (partnerFilter !== 'ALL' && p.status !== partnerFilter) {
        return false;
      }
      if (!query) return true;
      return (
        p.fullName.toLowerCase().includes(query) ||
        p.registrationNumber.toLowerCase().includes(query) ||
        p.licensePlate.toLowerCase().includes(query) ||
        p.regency.toLowerCase().includes(query) ||
        p.vehicleBrandType.toLowerCase().includes(query)
      );
    });
  }, [partners, partnerFilter, partnerSearch]);

  const selectedPartner = useMemo(() => {
    if (!selectedPartnerId) return filteredPartners[0] ?? null;
    return (
      partners.find((p) => p.id === selectedPartnerId) ??
      filteredPartners[0] ??
      null
    );
  }, [partners, filteredPartners, selectedPartnerId]);

  const isEmailMatchedButUnverified =
    !authChecking &&
    Boolean(authUser) &&
    isAdminEmailMatch(authUser) &&
    authUser?.emailVerified !== true;

  if (authChecking || !isAuthorizedAdmin) {
    return (
      <AdminLoginView
        authChecking={authChecking}
        unverifiedAdminEmail={
          isEmailMatchedButUnverified ? authUser?.email || null : null
        }
        unauthorizedEmail={
          !authChecking && authUser && !isAuthorizedAdmin && !isEmailMatchedButUnverified
            ? authUser.email || authUser.uid
            : null
        }
        onUserReloaded={(updatedUser) => {
          if (updatedUser) {
            setAuthUser(updatedUser);
            setAuthRefreshTick((tick) => tick + 1);
          }
        }}
      />
    );
  }

  const runMutation = async (
    task: () => Promise<void>,
    successMsg?: string
  ) => {
    setActionNotice(null);
    try {
      await task();
      if (successMsg) {
        setActionNotice({ type: 'success', text: successMsg });
      }
    } catch (err) {
      setActionNotice({
        type: 'error',
        text:
          err instanceof Error && !err.message.startsWith('{')
            ? err.message
            : 'Perubahan gagal disimpan ke Firestore. Coba kembali beberapa saat.',
      });
    }
  };

  const handleVerifyPartner = (
    partner: PartnerRegistration,
    nextStatus: PartnerVerificationStatus
  ) => {
    void runMutation(
      () =>
        verifyPartnerFirestore(
          partner,
          nextStatus,
          nextStatus === 'DITOLAK' ? rejectionInput : undefined
        ),
      `Status mitra ${partner.fullName} diperbarui menjadi ${PARTNER_STATUS_LABELS[nextStatus]}.`
    );
    if (nextStatus !== 'DITOLAK') {
      setRejectionInput('');
    }
  };

  const handleSeedInitialSampleData = async () => {
    if (seedingSample) return;
    setSeedingSample(true);
    try {
      await seedInitialOperationalDataFirestore();
      setActionNotice({
        type: 'success',
        text: 'Contoh data awal (mitra, booking, dan setoran mingguan) berhasil dimuat ke Firestore.',
      });
    } catch {
      setActionNotice({
        type: 'error',
        text: 'Gagal memuat contoh data awal ke Firestore.',
      });
    } finally {
      setSeedingSample(false);
    }
  };

  const handleCreateBillForPartner = (summary: PartnerCommissionSummary) => {
    const today = new Date().toISOString().slice(0, 10);
    void runMutation(
      () =>
        createWeeklyDepositFirestore({
          partnerId: summary.partnerId,
          partnerName: summary.partnerName,
          partnerWhatsapp: summary.partnerWhatsapp,
          bookingCodes: summary.bookingCodes,
          totalServiceFareRp: summary.totalServiceFareRp,
          totalCommission10PercentRp: summary.totalCommission10PercentRp,
          unpaidDepositRp: summary.unpaidDepositRp,
          periodLabel: `Setoran ${today}`,
          periodStart: today,
          periodEnd: today,
          dueDate: today,
          existingDeposits: deposits,
        }),
      `Tagihan setoran mingguan untuk ${summary.partnerName} berhasil dibuat di Firestore.`
    );
    setActiveTab('setoran');
  };

  const renderStatusPill = (status: PartnerVerificationStatus) => {
    if (status === 'DISETUJUI') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-semibold text-xs whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-grab-600" aria-hidden="true" />
          <span>{PARTNER_STATUS_LABELS[status]}</span>
        </span>
      );
    }
    if (status === 'DITOLAK') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-red-100 text-red-900 font-semibold text-xs whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
          <span>{PARTNER_STATUS_LABELS[status]}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-semibold text-xs whitespace-nowrap">
        <ClipboardCheck className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
        <span>{PARTNER_STATUS_LABELS[status]}</span>
      </span>
    );
  };

  const activeNavTitle =
    NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? 'Dashboard';

  const diag = getFirestoreConnectionDiagnostics();

  return (
    <div className="min-h-screen bg-[#F6FAF8] text-slate-900 flex flex-col lg:flex-row">
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 bg-forest-950/50 z-40 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Responsive 10-Menu Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[272px] shrink-0 bg-white border-r border-emerald-950/10 flex flex-col justify-between transition-transform duration-200 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 overflow-y-auto">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <Link to="/" className="inline-flex items-center">
              <TripKitaLogo variant="dark" sizeClass="h-9" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              aria-label="Tutup menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 mb-2 px-2 text-[11px] font-semibold text-slate-400">
            TripKita Operational System
          </div>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs sm:text-[13px] font-display font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-forest-900 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-forest-50 hover:text-forest-900'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-gold-400' : 'text-grab-600'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </span>

                  {item.id === 'verifikasi-mitra' && kpis.mitraPending > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[11px] tabular-nums ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {kpis.mitraPending}
                    </span>
                  )}

                  {item.id === 'booking' && kpis.bookingBaru > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[11px] tabular-nums ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {kpis.bookingBaru}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-100 space-y-2 bg-slate-50/60">
          <div className="px-2 pb-1 text-xs text-slate-500 truncate">
            Admin:{' '}
            <strong className="text-forest-900">
              {authUser?.email || 'Admin'}
            </strong>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/"
              className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-white hover:bg-forest-50 border border-slate-200 text-xs font-semibold text-forest-900 inline-flex items-center justify-center gap-1 whitespace-nowrap"
            >
              <span>Web</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </Link>
            <Link
              to="/mitra"
              className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-white hover:bg-forest-50 border border-slate-200 text-xs font-semibold text-forest-900 inline-flex items-center justify-center gap-1 whitespace-nowrap"
            >
              <span>Mitra</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
          <button
            type="button"
            onClick={() => void logoutUser()}
            className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-slate-200 text-xs font-semibold text-red-700 inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div
          className={`border-b px-4 sm:px-6 py-2 text-xs flex flex-wrap items-center justify-between gap-2 ${
            diag.status === 'offline'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-grab-700 shrink-0" aria-hidden="true" />
            <span>
              <strong>Firebase Firestore Aktif:</strong> Project{' '}
              <code className="font-mono font-semibold">{diag.projectId || '-'}</code>{' '}
              — seluruh booking, mitra, penugasan, transaksi, dan setoran mingguan tersinkronisasi realtime.
            </span>
          </div>
          {loadingCollections && (
            <span className="inline-flex items-center gap-1.5 text-grab-700 font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              <span>Menyelaraskan data...</span>
            </span>
          )}
        </div>

        <header className="bg-white border-b border-emerald-950/10 px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 flex items-center justify-center text-forest-900 cursor-pointer"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400 hidden sm:inline">Admin TripKita</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-display font-bold text-base sm:text-lg text-forest-900 truncate">
                {activeNavTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/mitra"
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-grab-600 hover:bg-grab-700 text-white font-display font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <span>Portal Mitra</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {actionNotice && (
            <div
              className={`rounded-xl border px-4 py-3 text-xs sm:text-sm flex items-center justify-between gap-3 ${
                actionNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {actionNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-grab-600 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
                )}
                <span>{actionNotice.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionNotice(null)}
                className="p-1 rounded-md hover:bg-black/5 cursor-pointer"
                aria-label="Tutup notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!loadingCollections && bookings.length === 0 && partners.length === 0 && (
            <div className="bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display font-bold text-base text-forest-900">
                  Database Firestore Masih Kosong
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-600">
                  Booking baru dari halaman utama (<code className="font-mono">/</code>) dan pendaftar mitra (<code className="font-mono">/mitra</code>) akan langsung muncul di sini. Anda juga dapat memuat contoh data awal untuk menguji alur operasional.
                </p>
              </div>
              <button
                type="button"
                disabled={seedingSample}
                onClick={handleSeedInitialSampleData}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-forest-900 hover:bg-forest-800 disabled:opacity-60 text-white font-display font-bold text-xs inline-flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap"
              >
                {seedingSample ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Database className="w-4 h-4 text-gold-400" aria-hidden="true" />
                )}
                <span>{seedingSample ? 'Memuat Data...' : 'Muat Contoh Data Awal'}</span>
              </button>
            </div>
          )}

          {/* 1. DASHBOARD RINGKASAN (10 KPI) */}
          {activeTab === 'ringkasan' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {[
                  { label: 'Total Booking', value: kpis.totalBooking, accent: 'text-forest-900' },
                  { label: 'Booking Baru', value: kpis.bookingBaru, accent: 'text-amber-700' },
                  { label: 'Booking Dikonfirmasi', value: kpis.bookingDikonfirmasi, accent: 'text-grab-700' },
                  { label: 'Booking Selesai', value: kpis.bookingSelesai, accent: 'text-emerald-700' },
                  { label: 'Booking Dibatalkan', value: kpis.bookingDibatalkan, accent: 'text-red-700' },
                  { label: 'Total Mitra', value: kpis.totalMitra, accent: 'text-forest-900' },
                  { label: 'Mitra Aktif', value: kpis.mitraAktif, accent: 'text-grab-600' },
                  {
                    label: 'Komisi Belum Disetor',
                    value: formatRupiah(kpis.komisiBelumDisetor),
                    accent: 'text-amber-700',
                  },
                  {
                    label: 'Komisi Sudah Disetor',
                    value: formatRupiah(kpis.komisiSudahDisetor),
                    accent: 'text-emerald-700',
                  },
                  {
                    label: 'Total Nilai Transaksi',
                    value: formatRupiah(kpis.totalNilaiTransaksi),
                    accent: 'text-forest-900',
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white rounded-2xl border border-emerald-950/10 p-4"
                  >
                    <span className="block text-xs font-semibold text-slate-500">
                      {stat.label}
                    </span>
                    <span
                      className={`mt-2 block font-display font-extrabold text-xl sm:text-2xl tabular-nums ${stat.accent}`}
                    >
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-5 bg-white rounded-2xl border border-emerald-950/10 p-5">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <h2 className="font-display font-bold text-base text-forest-900">
                      Mitra Menunggu Verifikasi ({kpis.mitraPending})
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setPartnerFilter('MENUNGGU_VERIFIKASI');
                        setActiveTab('verifikasi-mitra');
                      }}
                      className="text-xs font-semibold text-grab-600 hover:underline cursor-pointer"
                    >
                      Buka Antrean
                    </button>
                  </div>
                  <div className="mt-3 divide-y divide-slate-100">
                    {partners.filter((p) => p.status === 'MENUNGGU_VERIFIKASI')
                      .length === 0 ? (
                      <p className="py-6 text-sm text-slate-500 text-center">
                        Tidak ada pendaftar yang menunggu verifikasi.
                      </p>
                    ) : (
                      partners
                        .filter((p) => p.status === 'MENUNGGU_VERIFIKASI')
                        .map((item) => (
                          <div
                            key={item.id}
                            className="py-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-forest-900 truncate">
                                {item.fullName}
                              </div>
                              <div className="text-xs text-slate-500 truncate">
                                {item.vehicleBrandType} · {item.regency}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPartnerId(item.id);
                                setActiveTab('verifikasi-mitra');
                              }}
                              className="min-h-[34px] px-3 py-1 rounded-lg bg-forest-50 hover:bg-forest-100 text-forest-900 font-display font-semibold text-xs shrink-0 cursor-pointer"
                            >
                              Tinjau
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                <div className="xl:col-span-7 bg-white rounded-2xl border border-emerald-950/10 p-5">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <h2 className="font-display font-bold text-base text-forest-900">
                      Booking Terbaru
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('booking')}
                      className="text-xs font-semibold text-grab-600 hover:underline cursor-pointer"
                    >
                      Kelola Booking
                    </button>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-100">
                          <th className="py-2 pr-3 font-semibold">Kode</th>
                          <th className="py-2 pr-3 font-semibold">Jenis</th>
                          <th className="py-2 pr-3 font-semibold">Pelanggan</th>
                          <th className="py-2 pr-3 font-semibold text-right">Tarif/Est.</th>
                          <th className="py-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bookings.slice(0, 6).map((b) => (
                          <tr key={b.bookingId} className="hover:bg-forest-50/40">
                            <td className="py-2.5 pr-3 font-mono text-xs text-forest-900 whitespace-nowrap">
                              {b.bookingCode}
                            </td>
                            <td className="py-2.5 pr-3 text-xs text-slate-700 whitespace-nowrap">
                              {TRIP_TYPE_LABELS[b.tripType]}
                            </td>
                            <td className="py-2.5 pr-3 font-medium text-slate-900 whitespace-nowrap">
                              {b.customerName}
                            </td>
                            <td className="py-2.5 pr-3 text-right font-semibold text-forest-900 tabular-nums whitespace-nowrap">
                              {formatRupiah(
                                b.agreedFareRp > 0
                                  ? b.agreedFareRp
                                  : b.internalEstimatedFareRp
                              )}
                            </td>
                            <td className="py-2.5 text-xs font-semibold text-grab-700 whitespace-nowrap">
                              {BOOKING_STATUS_LABEL_MAP[b.bookingStatus]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 2. BOOKING PELANGGAN */}
          {activeTab === 'booking' && (
            <AdminBookingsSection
              bookings={bookings}
              approvedPartners={approvedPartners}
              filters={bookingFilters}
              onFiltersChange={setBookingFilters}
              onConfirmBooking={async (bookingId, agreedFareRp) => {
                const target = bookings.find((b) => b.bookingId === bookingId);
                if (!target) {
                  return { ok: false, error: 'Booking tidak ditemukan.' };
                }
                return confirmBookingByAdminFirestore(target, agreedFareRp);
              }}
              onCancelBooking={(bookingId, reason) => {
                const target = bookings.find((b) => b.bookingId === bookingId);
                if (!target) return;
                void runMutation(() => cancelBookingFirestore(target, reason));
              }}
              onJumpToAssignment={(bookingId) => {
                setAssignmentFocusBookingId(bookingId);
                setActiveTab('penugasan');
              }}
            />
          )}

          {/* 3. DATA MITRA */}
          {activeTab === 'data-mitra' && (
            <div className="bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-6">
              <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-lg text-forest-900">
                    Direktori Data Mitra &amp; Armada ({partners.length})
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    Daftar lengkap mitra TripKita beserta tipe kendaraan, nomor polisi, kapasitas, dan area operasional.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('verifikasi-mitra')}
                  className="min-h-[38px] px-3.5 py-2 rounded-xl bg-forest-50 hover:bg-forest-100 text-forest-900 font-display font-bold text-xs cursor-pointer shrink-0"
                >
                  Buka Verifikasi Mitra
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-100">
                      <th className="py-2.5 pr-4 font-semibold">Mitra</th>
                      <th className="py-2.5 pr-4 font-semibold">Kendaraan</th>
                      <th className="py-2.5 pr-4 font-semibold">No. Polisi</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Kapasitas</th>
                      <th className="py-2.5 pr-4 font-semibold">Area Operasional</th>
                      <th className="py-2.5 pr-4 font-semibold">Ketersediaan</th>
                      <th className="py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {partners.map((p) => (
                      <tr key={p.id} className="hover:bg-forest-50/40">
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <div className="font-semibold text-forest-900">
                            {p.fullName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {p.registrationNumber} · {p.whatsapp}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-slate-800 whitespace-nowrap">
                          {p.vehicleBrandType} ({p.vehicleYear})
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-800 whitespace-nowrap">
                          {p.licensePlate}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums whitespace-nowrap">
                          {p.passengerCapacity} org
                        </td>
                        <td className="py-3 pr-4 text-slate-600 max-w-[220px] truncate">
                          {p.operationalArea}
                        </td>
                        <td className="py-3 pr-4 text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {VEHICLE_AVAILABILITY_LABELS[p.availability]}
                        </td>
                        <td className="py-3 whitespace-nowrap">
                          {renderStatusPill(p.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. VERIFIKASI MITRA */}
          {activeTab === 'verifikasi-mitra' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <div className="xl:col-span-7 bg-white rounded-2xl border border-emerald-950/10 p-5">
                <div className="flex flex-col sm:flex-row gap-3 justify-between pb-4 border-b border-slate-100">
                  <div className="relative flex-1">
                    <Search
                      className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      placeholder="Cari nama, kode pendaftaran, nopol..."
                      value={partnerSearch}
                      onChange={(e) => setPartnerSearch(e.target.value)}
                      className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-grab-600"
                    />
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
                    {(
                      [
                        { id: 'ALL', label: 'Semua' },
                        { id: 'MENUNGGU_VERIFIKASI', label: 'Menunggu' },
                        { id: 'DISETUJUI', label: 'Disetujui' },
                        { id: 'DITOLAK', label: 'Ditolak' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setPartnerFilter(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                          partnerFilter === f.id
                            ? 'bg-white text-forest-900 shadow-xs'
                            : 'text-slate-600 hover:text-forest-900'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 divide-y divide-slate-100">
                  {filteredPartners.map((partner) => {
                    const isSelected = selectedPartner?.id === partner.id;
                    return (
                      <button
                        key={partner.id}
                        type="button"
                        onClick={() => {
                          setSelectedPartnerId(partner.id);
                          setRejectionInput(partner.rejectionReason ?? '');
                        }}
                        className={`w-full text-left py-3.5 px-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer ${
                          isSelected ? 'bg-forest-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-sm text-forest-900 truncate">
                              {partner.fullName}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              {partner.registrationNumber}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-600 truncate">
                            {partner.vehicleBrandType} ({partner.licensePlate}) ·{' '}
                            {partner.district}, {partner.regency}
                          </div>
                        </div>
                        {renderStatusPill(partner.status)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="xl:col-span-5 bg-white rounded-2xl border border-emerald-950/10 p-5 sm:p-6">
                {selectedPartner ? (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <span className="block font-mono text-xs text-slate-500">
                          {selectedPartner.registrationNumber}
                        </span>
                        <h2 className="font-display font-extrabold text-lg text-forest-900">
                          {selectedPartner.fullName}
                        </h2>
                      </div>
                      {renderStatusPill(selectedPartner.status)}
                    </div>

                    <div className="space-y-2.5 text-xs sm:text-sm">
                      <div>
                        <span className="text-slate-500 block">Kontak &amp; Email</span>
                        <span className="font-semibold text-forest-900">
                          {selectedPartner.whatsapp} · {selectedPartner.email}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Alamat</span>
                        <span>
                          {selectedPartner.address}, Kec. {selectedPartner.district},{' '}
                          {selectedPartner.regency}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Jenis Kemitraan &amp; Layanan</span>
                        <span className="font-medium text-forest-900">
                          {PARTNERSHIP_TYPE_LABELS[selectedPartner.partnershipType]} —{' '}
                          {selectedPartner.services
                            .map((s) => PARTNER_SERVICE_LABELS[s])
                            .join(', ')}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-forest-50/75 border border-emerald-950/10 text-xs space-y-1">
                        <div>
                          <strong>Armada:</strong> {selectedPartner.vehicleBrandType} (
                          {selectedPartner.vehicleYear}) ·{' '}
                          <span className="font-mono">{selectedPartner.licensePlate}</span>
                        </div>
                        <div>
                          <strong>Area:</strong> {selectedPartner.operationalArea}
                        </div>
                        <div>
                          <strong>Catatan Berkas:</strong> SIM:{' '}
                          {selectedPartner.documents.simFileName || '-'} · STNK:{' '}
                          {selectedPartner.documents.stnkFileName || '-'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <input
                        type="text"
                        placeholder="Catatan penolakan (jika ditolak)..."
                        value={rejectionInput}
                        onChange={(e) => setRejectionInput(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:border-grab-600"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleVerifyPartner(selectedPartner, 'DISETUJUI')
                          }
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-grab-600 hover:bg-grab-700 text-white font-display font-bold text-xs cursor-pointer"
                        >
                          Setujui
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleVerifyPartner(selectedPartner, 'DITOLAK')
                          }
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-display font-bold text-xs cursor-pointer"
                        >
                          Tolak
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleVerifyPartner(
                              selectedPartner,
                              'MENUNGGU_VERIFIKASI'
                            )
                          }
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-display font-semibold text-xs cursor-pointer"
                        >
                          Menunggu
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="py-10 text-center text-sm text-slate-500">
                    Pilih mitra untuk ditinjau.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 5. PENUGASAN PERJALANAN */}
          {activeTab === 'penugasan' && (
            <AdminAssignmentSection
              bookings={bookings}
              approvedPartners={approvedPartners}
              initialSelectedBookingId={assignmentFocusBookingId}
              onOfferPartner={(bookingId, partner) => {
                const target = bookings.find((b) => b.bookingId === bookingId);
                if (!target) return;
                void runMutation(() => offerBookingToPartnerFirestore(target, partner));
              }}
              onRespondOffer={(bookingId, response, note) => {
                const target = bookings.find((b) => b.bookingId === bookingId);
                if (!target) return;
                void runMutation(() =>
                  respondPartnerOfferFirestore(target, response, note)
                );
              }}
              onIssueAssignment={(bookingId) => {
                const target = bookings.find((b) => b.bookingId === bookingId);
                if (!target) return;
                void runMutation(() => assignPartnerConfirmedFirestore(target));
              }}
              onCompleteTrip={(bookingId) => {
                const target = bookings.find((b) => b.bookingId === bookingId);
                if (!target) return;
                void runMutation(() => completeTripFirestore(target));
              }}
            />
          )}

          {/* 6. TRANSAKSI */}
          {activeTab === 'transaksi' && (
            <AdminTransactionsSection
              bookings={bookings}
              onSaveTransaction={(bookingId, params) => {
                const target = bookings.find((b) => b.bookingId === bookingId);
                if (!target) return;
                void runMutation(() => updateCashTransactionFirestore(target, params));
              }}
            />
          )}

          {/* 7. KOMISI MITRA */}
          {activeTab === 'komisi' && (
            <AdminCommissionSection
              summaries={partnerCommissionSummaries}
              commissionSettings={commissionSettings}
              onSaveMinFee={(minFeeRp) => {
                void runMutation(async () => {
                  const saved = await saveCommissionSettingsFirestore(minFeeRp);
                  setCommissionSettings(saved);
                }, 'Pengaturan batas minimum komisi tersimpan ke Firestore.');
              }}
              onCreateBillForPartner={handleCreateBillForPartner}
            />
          )}

          {/* 8. SETORAN MINGGUAN */}
          {activeTab === 'setoran' && (
            <AdminWeeklyDepositsSection
              deposits={deposits}
              summaries={partnerCommissionSummaries}
              onCreateDeposit={(params) => {
                void runMutation(() =>
                  createWeeklyDepositFirestore({
                    partnerId: params.partner.partnerId,
                    partnerName: params.partner.partnerName,
                    partnerWhatsapp: params.partner.partnerWhatsapp,
                    bookingCodes: params.partner.bookingCodes,
                    totalServiceFareRp: params.partner.totalServiceFareRp,
                    totalCommission10PercentRp:
                      params.partner.totalCommission10PercentRp,
                    unpaidDepositRp: params.partner.unpaidDepositRp,
                    periodLabel: params.periodLabel,
                    periodStart: params.periodStart,
                    periodEnd: params.periodEnd,
                    dueDate: params.dueDate,
                    existingDeposits: deposits,
                  })
                );
              }}
              onSubmitProof={(id, ref, paid, note) => {
                const target = deposits.find((d) => d.depositId === id);
                if (!target) return;
                void runMutation(() =>
                  submitDepositTransferProofFirestore(target, ref, paid, note)
                );
              }}
              onVerifyDeposit={(depositId) => {
                const target = deposits.find((d) => d.depositId === depositId);
                if (!target) return;
                void runMutation(() => verifyWeeklyDepositFirestore(target));
              }}
            />
          )}

          {/* 9. TEMPLATE WHATSAPP */}
          {activeTab === 'template-wa' && (
            <AdminWhatsAppTemplatesSection
              bookings={bookings}
              partners={partners}
              deposits={deposits}
            />
          )}

          {/* 10. LAPORAN OPERASIONAL */}
          {activeTab === 'laporan' && (
            <AdminReportsAndSheetsSection
              bookings={bookings}
              partners={partners}
              deposits={deposits}
              onImportBookings={(records) =>
                upsertImportedBookingsFirestore(records, bookings)
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}
