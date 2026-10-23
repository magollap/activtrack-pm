import { RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="flex items-center justify-center gap-3 bg-brand-600 px-4 py-2 text-sm text-white" role="status">
      <span>New version available</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1 font-medium transition-colors hover:bg-white/25"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
      <button onClick={() => setNeedRefresh(false)} className="rounded p-1 hover:bg-white/15" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
