import { useEffect, useState } from 'react';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  fetchUserProfile,
  resolveVerifiedUserRole,
  subscribeToAuthState,
} from '../services/authService';
import { AuthSessionState } from '../types/auth';

const INITIAL_AUTH_STATE: AuthSessionState = {
  uid: null,
  email: null,
  emailVerified: false,
  displayName: null,
  profile: null,
  role: null,
  isConfigured: isFirebaseConfigured,
  loading: isFirebaseConfigured,
};

export function useAuthState(): AuthSessionState {
  const [state, setState] = useState<AuthSessionState>(INITIAL_AUTH_STATE);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setState({
        ...INITIAL_AUTH_STATE,
        isConfigured: false,
        loading: false,
      });
      return;
    }

    let cancelled = false;
    const unsubscribe = subscribeToAuthState(async (user) => {
      if (cancelled) return;

      if (!user) {
        setState({
          uid: null,
          email: null,
          emailVerified: false,
          displayName: null,
          profile: null,
          role: null,
          isConfigured: true,
          loading: false,
        });
        return;
      }

      const [profile, role] = await Promise.all([
        fetchUserProfile(user.uid).catch(() => null),
        resolveVerifiedUserRole(user),
      ]);

      if (cancelled) return;

      setState({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        profile,
        role,
        isConfigured: true,
        loading: false,
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}
