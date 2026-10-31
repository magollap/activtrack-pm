import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { UpdateBanner } from '@/components/layout/UpdateBanner';
import { AppRoutes } from '@/AppRoutes';
import { AuthPage } from '@/features/auth/AuthPage';
import { useAuth } from '@/features/auth/AuthProvider';
import { AssistantDialog } from '@/features/ai/AssistantDialog';
import { Shortcuts } from '@/features/shortcuts/Shortcuts';
import { Logo } from '@/components/Logo';
import { backend } from '@/lib/backend';
import { emitChange } from '@/lib/db/events';

export default function App() {
  const { state, retry } = useAuth();

  if (state.status === 'loading') {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Logo className="h-10 w-10 animate-pulse" />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">{state.message}</p>
        <button className="btn-primary" onClick={retry}>Try again</button>
      </div>
    );
  }
  if (state.status === 'signedOut') {
    return <SignedOut notice={state.notice} />;
  }
  return <Workspace />;
}

// The landing page (and its WebGL library) only loads for signed-out visitors.
const LandingPage = lazy(() => import('@/features/landing/LandingPage').then((m) => ({ default: m.LandingPage })));

/** "/" shows the landing page; /signup opens account creation; any other address asks the visitor to sign in. */
function SignedOut({ notice }: { notice: string | null }) {
  const { pathname } = useLocation();
  if (pathname === '/' && !notice) {
    return (
      <>
        <UpdateBanner />
        <Suspense fallback={<div className="h-[100dvh] bg-[#06261a] dark:bg-black" />}>
          <LandingPage />
        </Suspense>
      </>
    );
  }
  return (
    <>
      <UpdateBanner />
      <AuthPage notice={notice} initialMode={pathname === '/signup' ? 'signUp' : 'signIn'} />
    </>
  );
}

/** Keeps every open screen in step with changes teammates make (Supabase Realtime, or polling on installs). */
function useLiveSync() {
  useEffect(() => backend().watch(emitChange), []);
}

function Workspace() {
  const [menuOpen, setMenuOpen] = useState(false);
  useLiveSync();

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden print:block print:h-auto print:overflow-visible">
      <UpdateBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenMenu={() => setMenuOpen(true)} />
          <main className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">
            <AppRoutes />
          </main>
        </div>
      </div>
      <AssistantDialog />
      <Shortcuts />
    </div>
  );
}
