import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  MailCheck,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import firebaseAppletConfig from '../../../firebase-applet-config.json';
import { TripKitaLogo } from '../TripKitaLogo';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  loginAdminWithEmailPassword,
  loginAdminWithGoogle,
  logoutUser,
  reloadCurrentUser,
  requestAdminPasswordReset,
  resendAdminVerificationEmail,
} from '../../services/authService';

interface AdminLoginViewProps {
  unauthorizedEmail?: string | null;
  unverifiedAdminEmail?: string | null;
  authChecking?: boolean;
  onUserReloaded?: (user: User | null) => void;
}

function extractFirebaseErrorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return String((err as { code?: unknown }).code);
  }
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/\((auth\/[a-z0-9-]+)\)/i);
  return match ? match[1] : '';
}

function mapFirebaseAuthError(err: unknown): string {
  const code = extractFirebaseErrorCode(err);

  switch (code) {
    case 'auth/configuration-not-found':
      return 'Konfigurasi metode login di Firebase belum aktif atau halaman pratinjau belum dimuat ulang. Coba segarkan (refresh) halaman, atau aktifkan Authentication (Google / Email/Password) di Firebase Console.';
    case 'auth/operation-not-allowed':
      return 'Metode login ini belum diaktifkan di Firebase Console → Authentication → Sign-in method.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau password tidak cocok, atau password belum dibuat. Gunakan "Masuk dengan Google (1 Klik)" di atas atau klik "Atur / Lupa Password?".';
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan login gagal. Tunggu beberapa menit lalu coba lagi.';
    case 'auth/popup-closed-by-user':
      return 'Jendela pilih akun Google ditutup sebelum selesai. Klik tombol hijau di atas untuk mencoba lagi.';
    case 'auth/popup-blocked':
      return 'Pop-up login diblokir oleh browser. Izinkan pop-up untuk situs ini lalu klik Masuk dengan Google lagi.';
    case 'auth/unauthorized-domain':
      return 'Domain halaman ini belum terdaftar di Authorized Domains Firebase Console.';
    default:
      return err instanceof Error
        ? err.message
        : 'Gagal masuk ke Dashboard Admin. Silakan coba kembali.';
  }
}

export function AdminLoginView({
  unauthorizedEmail,
  unverifiedAdminEmail,
  authChecking = false,
  onUserReloaded,
}: AdminLoginViewProps) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState(BOOTSTRAPPED_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [signingInGoogle, setSigningInGoogle] = useState(false);
  const [signingInEmail, setSigningInEmail] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [sendingVerify, setSendingVerify] = useState(false);
  const [reloadingSession, setReloadingSession] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [needsAuthSetup, setNeedsAuthSetup] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const authConsoleUrl = `https://console.firebase.google.com/project/${firebaseAppletConfig.projectId}/authentication/providers`;

  const busy =
    authChecking ||
    signingInGoogle ||
    signingInEmail ||
    sendingReset ||
    sendingVerify ||
    reloadingSession;

  const handleAuthFailure = (err: unknown) => {
    const code = extractFirebaseErrorCode(err);
    setNeedsAuthSetup(
      code === 'auth/configuration-not-found' ||
        code === 'auth/operation-not-allowed'
    );
    setError(mapFirebaseAuthError(err));
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setNeedsAuthSetup(false);
    setInfoMsg(null);
    setSigningInGoogle(true);
    try {
      await loginAdminWithGoogle();
    } catch (err) {
      handleAuthFailure(err);
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handleEmailPasswordLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNeedsAuthSetup(false);
    setInfoMsg(null);
    setSigningInEmail(true);
    try {
      await loginAdminWithEmailPassword(email, password);
    } catch (err) {
      handleAuthFailure(err);
    } finally {
      setSigningInEmail(false);
    }
  };

  const handlePasswordReset = async () => {
    setError(null);
    setNeedsAuthSetup(false);
    setInfoMsg(null);
    setSendingReset(true);
    try {
      await requestAdminPasswordReset(email);
      setInfoMsg(
        `Link atur / reset password dikirim ke ${BOOTSTRAPPED_ADMIN_EMAIL}. Cek kotak masuk atau Spam.`
      );
    } catch (err) {
      handleAuthFailure(err);
    } finally {
      setSendingReset(false);
    }
  };

  const handleSendVerification = async () => {
    setError(null);
    setInfoMsg(null);
    setSendingVerify(true);
    try {
      await resendAdminVerificationEmail();
      setInfoMsg(
        `Link verifikasi email dikirim ke ${unverifiedAdminEmail || BOOTSTRAPPED_ADMIN_EMAIL}. Klik link di inbox lalu tekan "Sudah Verifikasi & Masuk".`
      );
    } catch (err) {
      handleAuthFailure(err);
    } finally {
      setSendingVerify(false);
    }
  };

  const handleReloadVerification = async () => {
    setError(null);
    setInfoMsg(null);
    setReloadingSession(true);
    try {
      const updatedUser = await reloadCurrentUser();
      if (updatedUser && !updatedUser.emailVerified) {
        setError(
          'Email belum terverifikasi. Pastikan Anda sudah membuka tautan verifikasi di email Anda.'
        );
      }
      onUserReloaded?.(updatedUser);
    } catch (err) {
      handleAuthFailure(err);
    } finally {
      setReloadingSession(false);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    setNeedsAuthSetup(false);
    setInfoMsg(null);
    await logoutUser();
  };

  return (
    <div className="min-h-screen bg-[#F6FAF8] flex flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-900 hover:text-grab-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Halaman Utama</span>
          </Link>

          <Link
            to="/mitra"
            className="text-xs font-semibold text-slate-600 hover:text-forest-900 transition-colors"
          >
            Portal Mitra
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-950/10 shadow-xl shadow-forest-950/5 p-6 sm:p-8">
          <div className="flex flex-col items-start mb-6">
            <TripKitaLogo variant="dark" sizeClass="h-12" />
            <h1 className="mt-4 font-display font-extrabold text-2xl text-forest-900">
              Masuk Dashboard Admin
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              Klik tombol hijau di bawah lalu pilih akun Google{' '}
              <span className="font-mono font-semibold text-forest-900">
                {BOOTSTRAPPED_ADMIN_EMAIL}
              </span>
              .
            </p>
          </div>

          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-950 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-grab-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="leading-relaxed">
              <strong>Akses Terbatas Admin:</strong> Hanya akun{' '}
              <code className="font-mono font-semibold">{BOOTSTRAPPED_ADMIN_EMAIL}</code>{' '}
              yang dapat mengelola data operasional TripKita.
            </div>
          </div>

          {unverifiedAdminEmail && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 space-y-3">
              <div className="flex items-start gap-2">
                <MailCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <strong>Verifikasi Email Diperlukan:</strong> Akun{' '}
                  <span className="font-mono font-semibold">{unverifiedAdminEmail}</span>{' '}
                  perlu verifikasi email 1 kali agar database Firestore dapat diakses.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSendVerification}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-forest-900 hover:bg-forest-800 disabled:opacity-60 text-white font-display font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {sendingVerify ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <MailCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>Kirim Email Verifikasi</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleReloadVerification}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 font-display font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {reloadingSession ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>Sudah Verifikasi &amp; Masuk</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSignOut}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>
          )}

          {unauthorizedEmail && !unverifiedAdminEmail && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 space-y-2.5">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <strong>Akun berbeda dipilih:</strong> Anda masuk sebagai{' '}
                  <span className="font-mono font-semibold">{unauthorizedEmail}</span>. Silakan ganti ke{' '}
                  <span className="font-mono font-semibold">{BOOTSTRAPPED_ADMIN_EMAIL}</span>.
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-white hover:bg-red-100 border border-red-200 text-red-800 font-display font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ganti Akun Google</span>
              </button>
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-grab-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{infoMsg}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
              {needsAuthSetup && (
                <div className="pt-2 border-t border-red-200/80 text-red-900 space-y-1.5">
                  <p className="font-semibold">Langkah cepat perbaikan:</p>
                  <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                    <li>Segarkan (refresh) halaman browser ini terlebih dahulu.</li>
                    <li>
                      Jika membuka dari link hasil deploy, lakukan <strong>Deploy / Share ulang</strong> agar memakai versi terbaru.
                    </li>
                    <li>
                      Pastikan di{' '}
                      <a
                        href={authConsoleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-semibold inline-flex items-center gap-0.5 text-forest-900"
                      >
                        <span>Firebase Console Authentication</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>{' '}
                      provider <strong>Google</strong> (dan <strong>Email/Password</strong> jika digunakan) berstatus <strong>Enabled</strong>.
                    </li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Tombol Utama 1-Klik Google */}
          <button
            type="button"
            disabled={busy}
            onClick={handleGoogleLogin}
            className="w-full min-h-[52px] px-5 py-3.5 rounded-xl bg-gradient-to-r from-[#00A84B] to-[#008A3C] hover:from-[#009944] hover:to-[#007834] disabled:opacity-60 text-white font-display font-bold text-sm inline-flex items-center justify-center gap-2.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
          >
            {signingInGoogle || authChecking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>
                  {authChecking ? 'Memeriksa sesi login...' : 'Membuka login Google...'}
                </span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81"
                  />
                </svg>
                <span>Masuk dengan Google (1 Klik)</span>
              </>
            )}
          </button>

          {/* Opsi Tambahan Email & Password (Collapsible) */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowEmailForm((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-forest-900 py-1 cursor-pointer"
            >
              <span>Atau masuk dengan Email &amp; Password</span>
              {showEmailForm ? (
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            {showEmailForm && (
              <form onSubmit={handleEmailPasswordLogin} className="mt-3 space-y-3">
                <div>
                  <label
                    htmlFor="admin-login-email"
                    className="block text-xs font-display font-bold text-forest-900 mb-1"
                  >
                    Email Admin
                  </label>
                  <input
                    id="admin-login-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@domain.com"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-grab-500/25 focus:border-grab-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="admin-login-password"
                      className="block text-xs font-display font-bold text-forest-900"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handlePasswordReset}
                      className="text-xs font-semibold text-grab-700 hover:underline disabled:opacity-60 cursor-pointer"
                    >
                      {sendingReset ? 'Mengirim...' : 'Atur / Lupa Password?'}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="admin-login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password admin"
                      className="w-full min-h-[44px] pl-3.5 pr-11 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-grab-500/25 focus:border-grab-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-slate-100 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-forest-900 hover:bg-forest-800 disabled:opacity-60 text-white font-display font-bold text-xs inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {signingInEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Memverifikasi akun...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" aria-hidden="true" />
                      <span>Masuk dengan Email &amp; Password</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
