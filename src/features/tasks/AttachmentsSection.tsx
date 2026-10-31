import { useRef, useState } from 'react';
import { Download, File as FileIcon, FileImage, FileText, Loader2, Paperclip, Trash2, Upload } from 'lucide-react';
import { useCurrentUser } from '@/features/auth/AuthProvider';
import { useQuery } from '@/hooks/useQuery';
import { useToast } from '@/hooks/useToast';
import { timeAgo } from '@/lib/dates';
import { deleteAttachment, formatBytes, isImage, listAttachments, openAttachment, uploadAttachment } from '@/lib/db/attachments';
import type { Attachment, Member, Task } from '@/lib/db/types';

const iconFor = (a: Attachment) => (isImage(a) ? FileImage : /pdf|text|word|document/i.test(a.mimeType) ? FileText : FileIcon);

/** Files on a card: drag and drop or pick to upload (25 MB each), open, download and delete. */
export function AttachmentsSection({ task, members, editable, manage }: { task: Task; members: Member[]; editable: boolean; manage: boolean }) {
  const me = useCurrentUser();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const { data: files = [] } = useQuery(() => listAttachments(task.id), `files:${task.id}`);
  const [uploading, setUploading] = useState<string[]>([]);
  const [over, setOver] = useState(false);

  const upload = async (list: FileList | File[]) => {
    for (const file of Array.from(list).slice(0, 10)) {
      setUploading((u) => [...u, file.name]);
      try {
        await uploadAttachment(task, file);
      } catch (error) {
        toast.error(error);
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
  };

  const act = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <section
      onDragOver={(e) => { if (editable && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (!editable) return; e.preventDefault(); setOver(false); void upload(e.dataTransfer.files); }}
      className={`rounded-xl transition-colors ${over ? 'bg-brand-50 ring-2 ring-brand-400 dark:bg-brand-500/10' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Paperclip className="h-4 w-4" /> Files {files.length > 0 && <span className="font-normal text-slate-500">{files.length}</span>}</h3>
        {editable && (
          <>
            <button className="btn-ghost py-1 text-xs" onClick={() => input.current?.click()}><Upload className="h-3.5 w-3.5" /> Add files</button>
            <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ''; }} />
          </>
        )}
      </div>

      {files.length > 0 || uploading.length > 0 ? (
        <ul className="space-y-1">
          {uploading.map((name) => (
            <li key={`up-${name}`} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> <span className="truncate">Uploading {name}…</span>
            </li>
          ))}
          {files.map((file) => {
            const Icon = iconFor(file);
            const who = file.uploadedBy === me.id ? me : members.find((m) => m.id === file.uploadedBy);
            return (
              <li key={file.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"><Icon className="h-4 w-4" /></span>
                <button className="min-w-0 flex-1 text-left" onClick={() => act(() => openAttachment(file))} title="Open">
                  <span className="block truncate text-sm font-medium hover:text-brand-700 dark:hover:text-brand-300">{file.name}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{formatBytes(file.size)} · {who?.name ?? 'Former member'} · {timeAgo(file.createdAt)}</span>
                </button>
                <button className="icon-btn h-8 w-8" onClick={() => act(() => openAttachment(file, true))} aria-label={`Download ${file.name}`}><Download className="h-4 w-4" /></button>
                {((file.uploadedBy === me.id && editable) || manage) && (
                  <button className="icon-btn h-8 w-8 hover:text-red-600" onClick={() => act(() => deleteAttachment(file))} aria-label={`Delete ${file.name}`}><Trash2 className="h-4 w-4" /></button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">{editable ? 'Drop files here or use Add files. Up to 25 MB each.' : 'No files.'}</p>
      )}
    </section>
  );
}
