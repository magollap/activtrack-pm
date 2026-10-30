import { CheckCircle2, Download, Laptop, MonitorSmartphone, Moon, Palette, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '@/hooks/useTheme';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useToast } from '@/hooks/useToast';

const THEMES: { id: ThemePreference; label: string; hint: string; icon: typeof Sun; swatches: string[] }[] = [
  { id: 'light', label: 'Light', hint: 'Green, gold, blue', icon: Sun, swatches: ['#097041', '#d4a72c', '#2550e8'] },
  { id: 'dark', label: 'Dark', hint: 'Black and gold', icon: Moon, swatches: ['#070707', '#d4a72c', '#ead07a'] },
  { id: 'system', label: 'System', hint: 'Follow this device', icon: Laptop, swatches: ['#097041', '#070707', '#d4a72c'] },
];

function AppearanceCard() {
  const { preference, setPreference } = useTheme();
  return (
    <section className="card p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-700 dark:bg-gold-500/10 dark:text-gold-400">
          <Palette className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Appearance</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pick a theme. You can also flip it any time with the switch at the top of the screen.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
            {THEMES.map(({ id, label, hint, icon: Icon, swatches }) => {
              const selected = preference === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPreference(id)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    selected
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-500/10'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${selected ? 'text-brand-700 dark:text-brand-400' : 'text-slate-400'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{hint}</span>
                  </span>
                  <span className="flex -space-x-1" aria-hidden="true">
                    {swatches.map((c) => <span key={c} className="h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-slate-900" style={{ backgroundColor: c }} />)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

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
    <div className="space-y-4">
    <AppearanceCard />
    <section className="card p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
          <MonitorSmartphone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Install ActivTrack</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add ActivTrack to your home screen or desktop. It opens in its own window and works offline.
          </p>
          <div className="mt-4">
            {standalone ? (
              <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> ActivTrack is installed and running as an app.
              </p>
            ) : canInstall ? (
              <button className="btn-primary" onClick={onInstall}><Download className="h-4 w-4" /> Install ActivTrack</button>
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
    </div>
  );
}
