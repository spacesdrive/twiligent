import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
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

  const applySharedCaption = () => {
    if (!sharedCaption) return;
    setFiles(prev => applyCaptionToPending(prev, sharedCaption));
  };

  const clearFiles = () => {
    files.forEach(revokePreview);
    setFiles([]);
    setProcessing(false);
    cancelRef.current = false;
  };

  return {
    files, processing, setProcessing, fileInputRef, cancelRef,
    handleFilesSelect, removeFile, patchFile, applySharedCaption, clearFiles,
  };
}

export type BulkQueue = ReturnType<typeof useBulkQueue>;
