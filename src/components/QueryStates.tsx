import { Loader2, AlertTriangle } from 'lucide-react';

export function LoadingState() {
  return (
    <div className="flex justify-center py-16 text-slate-400" role="status" aria-label="Loading">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto my-12 flex max-w-md items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
