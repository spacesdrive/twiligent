import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { toast } from 'sonner';
import { UNDO_WINDOW_MS } from '@/lib/undoToast';
import {
  applyCaptionToPending, newQueueItem, patchQueueItem, removeQueueItem, revokePreview,
} from './queueHelpers.ts';
import type { QueueItem, QueueItemPatch } from './queueHelpers.ts';

export interface BulkQueueOptions {
  sharedCaption: string;
  onFirstFiles: () => void;
}

export function useBulkQueue({ sharedCaption, onFirstFiles }: BulkQueueOptions) {
  const [files, setFiles] = useState<QueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);
  const cancelRef = useRef(false);

  const handleFilesSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const newItems = picked.map(file => newQueueItem(file, ++idCounter.current));
    setFiles(prev => {
      if (prev.length === 0) onFirstFiles();
      return [...prev, ...newItems];
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: number) => setFiles(prev => removeQueueItem(prev, id));

  const patchFile = (id: number, patch: QueueItemPatch) => setFiles(prev => patchQueueItem(prev, id, patch));

  // overwriting typed captions is easy to do by accident, so the old ones come back with Undo
  const applySharedCaption = () => {
    if (!sharedCaption) return;
    const before = files;
    const pending = files.filter(item => item.status === 'pending').length;
    const typed = files.filter(item => item.status === 'pending' && item.caption && item.caption !== sharedCaption).length;
    setFiles(prev => applyCaptionToPending(prev, sharedCaption));
    toast.success(`Caption applied to ${pending} pending ${pending === 1 ? 'file' : 'files'}${typed ? `, replacing ${typed} typed ${typed === 1 ? 'caption' : 'captions'}` : ''}`, {
      duration: UNDO_WINDOW_MS,
      action: { label: 'Undo', onClick: () => setFiles(current => current.map(item => before.find(old => old.id === item.id && item.status === 'pending') ?? item)) },
    });
  };

  // the list comes back with Undo; previews are released only once the Undo window has passed
  const clearFiles = () => {
    const cleared = files;
    setFiles([]);
    setProcessing(false);
    cancelRef.current = false;
    let restored = false;
    const release = setTimeout(() => { if (!restored) cleared.forEach(revokePreview); }, UNDO_WINDOW_MS + 1000);
    toast.success(`${cleared.length} ${cleared.length === 1 ? 'file' : 'files'} cleared`, {
      duration: UNDO_WINDOW_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          restored = true;
          clearTimeout(release);
          setFiles(current => [...cleared, ...current]);
        },
      },
    });
  };

  return {
    files, processing, setProcessing, fileInputRef, cancelRef,
    handleFilesSelect, removeFile, patchFile, applySharedCaption, clearFiles,
  };
}

export type BulkQueue = ReturnType<typeof useBulkQueue>;
