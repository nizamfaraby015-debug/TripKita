import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import {
  Firestore,
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
} from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export type FirestoreConnectionStatus =
  | 'not_configured'
  | 'checking'
  | 'connected'
  | 'offline';

function cleanEnvValue(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^["']+/, '')
    .replace(/["']+$/, '')
    .trim();
}

function isPlaceholderValue(val: string): boolean {
  if (!val) return true;
  const lower = val.toLowerCase();
  return (
    val.startsWith('MY_') ||
    lower.startsWith('isi_') ||
    lower.startsWith('your_') ||
    lower.includes('placeholder') ||
    lower === 'undefined' ||
    lower === 'null' ||
    (val.startsWith('<') && val.endsWith('>'))
  );
}

function pickConfigValue(envVal: string | undefined, jsonVal: string | undefined): string {
  const cleanedEnv = cleanEnvValue(envVal);
  if (!isPlaceholderValue(cleanedEnv)) {
    return cleanedEnv;
  }
  const cleanedJson = cleanEnvValue(jsonVal);
  return isPlaceholderValue(cleanedJson) ? '' : cleanedJson;
}

const resolvedFirebaseConfig = {
  apiKey: pickConfigValue(import.meta.env.VITE_FIREBASE_API_KEY, firebaseAppletConfig.apiKey),
  authDomain: pickConfigValue(
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    firebaseAppletConfig.authDomain
  ),
  projectId: pickConfigValue(
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
    firebaseAppletConfig.projectId
  ),
  storageBucket: pickConfigValue(
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    firebaseAppletConfig.storageBucket
  ),
  messagingSenderId: pickConfigValue(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppletConfig.messagingSenderId
  ),
  appId: pickConfigValue(import.meta.env.VITE_FIREBASE_APP_ID, firebaseAppletConfig.appId),
};

export const firestoreDatabaseId: string = pickConfigValue(
  import.meta.env.VITE_FIREBASE_DATABASE_ID,
  firebaseAppletConfig.firestoreDatabaseId
);

const REQUIRED_FIELDS: Array<[keyof typeof resolvedFirebaseConfig, string]> = [
  ['apiKey', 'apiKey'],
  ['authDomain', 'authDomain'],
  ['projectId', 'projectId'],
  ['storageBucket', 'storageBucket'],
  ['messagingSenderId', 'messagingSenderId'],
  ['appId', 'appId'],
];

export const missingFirebaseEnvVars: string[] = REQUIRED_FIELDS.filter(
  ([key]) => isPlaceholderValue(resolvedFirebaseConfig[key])
).map(([, name]) => name);

export const isFirebaseConfigured: boolean =
  missingFirebaseEnvVars.length === 0;

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

if (isFirebaseConfigured) {
  appInstance =
    getApps().length > 0 ? getApp() : initializeApp(resolvedFirebaseConfig);

  // Wajib sertakan firestoreDatabaseId agar terhubung ke database Firestore TripKita yang diprovisioning
  try {
    dbInstance = firestoreDatabaseId
      ? initializeFirestore(
          appInstance,
          { experimentalAutoDetectLongPolling: true },
          firestoreDatabaseId
        )
      : initializeFirestore(appInstance, {
          experimentalAutoDetectLongPolling: true,
        });
  } catch {
    dbInstance = firestoreDatabaseId
      ? getFirestore(appInstance, firestoreDatabaseId)
      : getFirestore(appInstance);
  }

  authInstance = getAuth(appInstance);
}

export const firebaseApp: FirebaseApp | null = appInstance;
export const db: Firestore | null = dbInstance;
export const auth: Auth | null = authInstance;

let currentConnectionStatus: FirestoreConnectionStatus = isFirebaseConfigured
  ? 'checking'
  : 'not_configured';
let currentConnectionDetail: string | null = isFirebaseConfigured
  ? null
  : 'Konfigurasi Firebase belum diisi.';

export function getFirestoreConnectionDiagnostics(): {
  status: FirestoreConnectionStatus;
  detail: string | null;
  projectId: string | null;
  databaseId: string | null;
} {
  return {
    status: currentConnectionStatus,
    detail: currentConnectionDetail,
    projectId: isFirebaseConfigured ? resolvedFirebaseConfig.projectId : null,
    databaseId: isFirebaseConfigured ? firestoreDatabaseId || '(default)' : null,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = authInstance?.currentUser ?? null;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
  };

  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function isOfflineOrUnreachableError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  return (
    lower.includes('the client is offline') ||
    lower.includes('could not reach cloud firestore') ||
    lower.includes('unavailable') ||
    lower.includes('failed to get document because the client is offline')
  );
}

export async function testFirestoreConnection(): Promise<boolean> {
  if (!dbInstance) {
    currentConnectionStatus = 'not_configured';
    currentConnectionDetail = 'Konfigurasi Firebase belum diisi.';
    return false;
  }

  try {
    await getDocFromServer(doc(dbInstance, 'test', 'connection'));
    currentConnectionStatus = 'connected';
    currentConnectionDetail = null;
    return true;
  } catch (error) {
    if (isOfflineOrUnreachableError(error)) {
      currentConnectionStatus = 'offline';
      currentConnectionDetail =
        'Firestore belum terjangkau (offline atau koneksi terputus). Pastikan internet aktif dan aturan Firestore sudah diterapkan.';
      console.warn(currentConnectionDetail);
      return false;
    }
    // Permission denied membuktikan server Firestore merespons dan online.
    currentConnectionStatus = 'connected';
    currentConnectionDetail = null;
    return true;
  }
}

if (typeof window !== 'undefined' && isFirebaseConfigured) {
  void testFirestoreConnection();
}
