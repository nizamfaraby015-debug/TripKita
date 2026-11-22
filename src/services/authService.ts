import {
  GoogleAuthProvider,
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  handleFirestoreError,
  isFirebaseConfigured,
} from '../lib/firebase';
import { LoginInput, RegisterInput, UserProfile, UserRole } from '../types/auth';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'nizamfaraby015@gmail.com';

function requireFirebaseAuth() {
  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error(
      'Firebase belum dikonfigurasi. Periksa firebase-applet-config.json.'
    );
  }
  return { auth, db };
}

/**
 * Login admin menggunakan Google Authentication (signInWithPopup).
 * Tidak menggunakan signInWithRedirect karena environment preview berjalan di iframe.
 */
export async function loginAdminWithGoogle(): Promise<UserCredential> {
  const { auth: firebaseAuth } = requireFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(firebaseAuth, provider);
}

export async function loginAdminWithEmailPassword(
  email: string,
  password: string
): Promise<UserCredential> {
  const { auth: firebaseAuth } = requireFirebaseAuth();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !password) {
    throw new Error('Email dan password wajib diisi.');
  }

  if (cleanEmail !== BOOTSTRAPPED_ADMIN_EMAIL) {
    throw new Error(
      `Email ${cleanEmail} tidak terdaftar sebagai admin TripKita.`
    );
  }

  return signInWithEmailAndPassword(firebaseAuth, cleanEmail, password);
}

export async function requestAdminPasswordReset(email: string): Promise<void> {
  const { auth: firebaseAuth } = requireFirebaseAuth();
  const cleanEmail = email.trim().toLowerCase() || BOOTSTRAPPED_ADMIN_EMAIL;

  if (cleanEmail !== BOOTSTRAPPED_ADMIN_EMAIL) {
    throw new Error(
      `Reset password hanya untuk email admin (${BOOTSTRAPPED_ADMIN_EMAIL}).`
    );
  }

  await sendPasswordResetEmail(firebaseAuth, cleanEmail);
}

export async function resendAdminVerificationEmail(): Promise<void> {
  const { auth: firebaseAuth } = requireFirebaseAuth();
  const current = firebaseAuth.currentUser;
  if (!current) {
    throw new Error('Tidak ada sesi akun aktif. Silakan login kembali.');
  }
  await sendEmailVerification(current);
}

export async function reloadCurrentUser(): Promise<User | null> {
  if (!auth?.currentUser) return null;
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);
  return auth.currentUser;
}

export function isAdminEmailMatch(user: User | null): boolean {
  if (!user) return false;
  const email = user.email?.trim().toLowerCase() ?? '';
  return email === BOOTSTRAPPED_ADMIN_EMAIL;
}

export function isAuthorizedAdminUser(user: User | null): boolean {
  if (!user) return false;
  return user.emailVerified === true && isAdminEmailMatch(user);
}

/**
 * Mendaftarkan akun pengguna baru dengan role default CUSTOMER.
 * Role PARTNER atau ADMIN tidak pernah diterima dari input registrasi publik.
 */
export async function registerUser(input: RegisterInput): Promise<UserCredential> {
  const { auth: firebaseAuth, db: firestore } = requireFirebaseAuth();

  const cleanName = input.displayName.trim().slice(0, 120);
  const cleanEmail = input.email.trim().toLowerCase().slice(0, 160);
  const cleanPhone = (input.phone ?? '').trim().slice(0, 24);

  if (!cleanName) {
    throw new Error('Nama lengkap wajib diisi.');
  }

  const credential = await createUserWithEmailAndPassword(
    firebaseAuth,
    cleanEmail,
    input.password
  );

  await updateProfile(credential.user, { displayName: cleanName });

  const profilePath = `users/${credential.user.uid}`;
  try {
    await setDoc(doc(firestore, 'users', credential.user.uid), {
      uid: credential.user.uid,
      displayName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      role: 'CUSTOMER' satisfies UserRole,
      partnerStatus: 'NONE',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }

  return credential;
}

export async function loginUser(input: LoginInput): Promise<UserCredential> {
  const { auth: firebaseAuth } = requireFirebaseAuth();
  const cleanEmail = input.email.trim().toLowerCase();
  return signInWithEmailAndPassword(firebaseAuth, cleanEmail, input.password);
}

export async function logoutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db || !uid) return null;
  const profilePath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }
}

export async function resolveVerifiedUserRole(user: User): Promise<UserRole> {
  if (isAuthorizedAdminUser(user)) {
    return 'ADMIN';
  }

  try {
    const profile = await fetchUserProfile(user.uid);
    if (profile?.role === 'ADMIN' || profile?.role === 'PARTNER' || profile?.role === 'CUSTOMER') {
      return profile.role;
    }
  } catch {
    // Fallback aman ke CUSTOMER jika profil belum ada atau belum memiliki izin baca
  }

  return 'CUSTOMER';
}

export function subscribeToAuthState(
  onChange: (user: User | null) => void
): () => void {
  if (!auth) {
    onChange(null);
    return () => {};
  }
  return onAuthStateChanged(auth, onChange);
}
