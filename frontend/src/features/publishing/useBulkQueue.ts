import { useRef, useState } from 'react';
import {
  applyCaptionToPending, newQueueItem, patchQueueItem, removeQueueItem, revokePreview,
} from './queueHelpers.ts';

export function useBulkQueue({ sharedCaption, onFirstFiles }) {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef(null);
  const idCounter = useRef(0);
  const cancelRef = useRef(false);

  const handleFilesSelect = e => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const newItems = picked.map(file => newQueueItem(file, ++idCounter.current));
    setFiles(prev => {
      if (prev.length === 0) onFirstFiles();
      return [...prev, ...newItems];
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = id => setFiles(prev => removeQueueItem(prev, id));

  const patchFile = (id, patch) => setFiles(prev => patchQueueItem(prev, id, patch));

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
