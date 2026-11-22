export type UserRole = 'CUSTOMER' | 'PARTNER' | 'ADMIN';

export type PartnerStatus = 'NONE' | 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  role: UserRole;
  partnerStatus: PartnerStatus;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthSessionState {
  uid: string | null;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  profile: UserProfile | null;
  role: UserRole | null;
  isConfigured: boolean;
  loading: boolean;
}
