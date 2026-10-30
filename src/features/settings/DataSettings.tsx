import { Cloud, FileSpreadsheet, Server } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/hooks/useToast';
import { exportTasksCsv } from '@/lib/db/csv';
import { downloadFile } from '@/lib/download';

export function DataSettings() {
  const toast = useToast();
  const { kind } = useAuth();
  const StorageIcon = kind === 'local' ? Server : Cloud;

  const downloadCsv = async () => {
    try {
      downloadFile(`activtrack-tasks-${format(new Date(), 'yyyy-MM-dd')}.csv`, await exportTasksCsv(), 'text/csv;charset=utf-8');
      toast.success('Tasks exported');
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <section className="card">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          <StorageIcon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium">{kind === 'local' ? 'Stored on your server' : 'Stored in the cloud'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {kind === 'local'
              ? 'Everything is saved in the data folder of the machine ActivTrack is installed on. Back up that folder to keep a copy.'
              : 'Everything is saved securely online, so you see the same projects on every device you sign in from.'}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <FileSpreadsheet className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Export tasks to CSV</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Every task you can see, ready for Excel, Numbers or Google Sheets.</p>
          </div>
        </div>
        <button className="btn-secondary w-full shrink-0 sm:ml-4 sm:w-auto" onClick={downloadCsv}>Export CSV</button>
      </div>
    </section>
  );
}
