import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, RefObject } from 'react';
import { api } from '../../../services/api';
import { isRedditItem } from '../../../utils/trackedContent';
import { imageFileError, parseManualViews } from './trackedList.ts';
import type { TrackedContentItem, TrackedContentUpdateRequest } from '@shared/types/domain.ts';
import type { CloudinaryConfigResponse } from '@shared/types/instagram.ts';
import type { ShowToast } from './useTrackedItems';

export interface TrackedEditFields {
  label: string;
  category: string;
  views: string;
}

interface UseTrackedImageOptions {
  cloudConfig: CloudinaryConfigResponse | null;
  showToast: ShowToast;
}

export interface UseTrackedEditorOptions extends UseTrackedImageOptions {
  replaceItem: (id: string, updated: TrackedContentItem) => void;
}

function clearInput(inputRef: RefObject<HTMLInputElement | null>) {
  if (inputRef.current) inputRef.current.value = '';
}

function useTrackedImage({ cloudConfig, showToast }: UseTrackedImageOptions) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = imageFileError(file, Boolean(cloudConfig));
    if (error) { showToast(error, 'error'); return; }
    setUploading(true);
    try {
      // the Worker never takes binary uploads, so only the returned url is saved
      setImageUrl(await api.uploadImage(file, cloudConfig!));
      showToast('Image uploaded');
    } catch (err) {
      showToast(`Image upload failed. ${(err as Error).message}`, 'error');
    } finally {
      setUploading(false);
      clearInput(imageInputRef);
    }
  };

  return { imageUrl, setImageUrl, uploading, imageInputRef, handleImageSelect };
}

export function useTrackedEditor({ cloudConfig, replaceItem, showToast }: UseTrackedEditorOptions) {
  const image = useTrackedImage({ cloudConfig, showToast });
  const [editItem, setEditItem] = useState<TrackedContentItem | null>(null);
  const [fields, setFields] = useState<TrackedEditFields>({ label: '', category: '', views: '' });
  const [saving, setSaving] = useState(false);

  const setField = (name: keyof TrackedEditFields, value: string) => setFields(prev => ({ ...prev, [name]: value }));

  const openEdit = (item: TrackedContentItem) => {
    setEditItem(item);
    setFields({ label: item.label || '', category: item.category || '', views: item.manualViews != null ? String(item.manualViews) : '' });
    image.setImageUrl(item.imageUrl || null);
    clearInput(image.imageInputRef);
  };

  const handleSaveEdit = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!editItem) return;
    const updates: TrackedContentUpdateRequest = { label: fields.label, category: fields.category };
    if (isRedditItem(editItem)) {
      const views = parseManualViews(fields.views);
      if (views.error) { showToast(views.error, 'error'); return; }
      updates.manualViews = views.value;
      updates.imageUrl = image.imageUrl || null;
    }
    setSaving(true);
    try {
      replaceItem(editItem.id, await api.updateTrackedContent(editItem.id, updates));
      setEditItem(null);
      showToast('Changes saved');
    } catch (err) {
      showToast(`Couldn't save the changes. ${(err as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return { ...image, editItem, setEditItem, fields, setField, saving, openEdit, handleSaveEdit, cloudConfig };
}

export type TrackedEditor = ReturnType<typeof useTrackedEditor>;
