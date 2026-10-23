import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { backend } from '@/lib/backend';
import type { Backend } from '@/lib/backend/types';
import { emitAll, subscribe } from '@/lib/db/events';
import { getMember } from '@/lib/db/members';
import { errorMessage } from '@/lib/errors';
import type { Member } from '@/lib/db/types';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; notice: string | null }
  | { status: 'signedIn'; user: Member }
  | { status: 'error'; message: string };

interface AuthApi {
  state: AuthState;
  kind: Backend['kind'];
  retry: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      const userId = await backend().currentUserId();
      if (!userId) {
        setState((s) => ({ status: 'signedOut', notice: s.status === 'signedOut' ? s.notice : null }));
        return;
      }
      const profile = await getMember(userId);
      if (!profile || profile.disabled) {
        await backend().signOut().catch(() => undefined);
        setState({ status: 'signedOut', notice: 'This account has been disabled. Contact your administrator.' });
        return;
      }
      setState({ status: 'signedIn', user: profile });
    } catch (error) {
      setState({ status: 'error', message: errorMessage(error) });
    }
  }, []);

  useEffect(() => {
    void load();
    const offAuth = backend().onAuthChange(() => {
      void load();
      emitAll();
    });
    const offData = subscribe((collection) => {
      if (collection === 'profiles') void load();
    });
    return () => {
      offAuth();
      offData();
    };
  }, [load]);

  const api = useMemo<AuthApi>(() => ({
    state,
    kind: backend().kind,
    retry: () => {
      setState({ status: 'loading' });
      void load();
    },
    signOut: async () => {
      await backend().signOut();
      setState({ status: 'signedOut', notice: null });
    },
  }), [state, load]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

/** The signed-in person; only use below the sign-in gate. */
export function useCurrentUser(): Member {
  const { state } = useAuth();
  if (state.status !== 'signedIn') throw new Error('No one is signed in.');
  return state.user;
}
