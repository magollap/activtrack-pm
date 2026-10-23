import { CheckCircle2, Download, MonitorSmartphone } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useToast } from '@/hooks/useToast';

export function AppSettings() {
  const { canInstall, install } = useInstallPrompt();
  const toast = useToast();
  const standalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

  const onInstall = async () => {
    try {
      await install();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <section className="card p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
          <MonitorSmartphone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Install Workday</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add Workday to your home screen or desktop. It opens in its own window and works offline.
          </p>
          <div className="mt-4">
            {standalone ? (
              <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Workday is installed and running as an app.
              </p>
            ) : canInstall ? (
              <button className="btn-primary" onClick={onInstall}><Download className="h-4 w-4" /> Install Workday</button>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Your browser has not offered installation yet. In Chrome or Edge, look for the install icon in the address bar.
                On iPhone, tap Share and then "Add to Home Screen".
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
