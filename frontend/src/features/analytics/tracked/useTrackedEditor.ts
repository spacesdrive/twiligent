import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, RefObject } from 'react';
import { api } from '../../../services/api';
import { isRedditItem } from '../../../utils/trackedContent';
import { imageFileError, parseManualViews } from './trackedList.ts';
import { normalizeViewsText } from './viewsInput.ts';
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

// image problems are shown under the image field, where the person chose the file
function useTrackedImage({ cloudConfig, showToast }: UseTrackedImageOptions) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = imageFileError(file, Boolean(cloudConfig));
    if (error) { setImageError(error); return; }
    setUploading(true);
    setImageError(null);
    try {
      // the Worker never takes binary uploads, so only the returned url is saved
      setImageUrl(await api.uploadImage(file, cloudConfig!));
      showToast('Image uploaded');
    } catch (err) {
      setImageError(`Couldn't upload the image. ${(err as Error).message}`);
    } finally {
      setUploading(false);
      clearInput(imageInputRef);
    }
  };

  return { imageUrl, setImageUrl, uploading, imageInputRef, handleImageSelect, imageError, setImageError };
}

export function useTrackedEditor({ cloudConfig, replaceItem, showToast }: UseTrackedEditorOptions) {
  const image = useTrackedImage({ cloudConfig, showToast });
  const [editItem, setEditItem] = useState<TrackedContentItem | null>(null);
  const [fields, setFields] = useState<TrackedEditFields>({ label: '', category: '', views: '' });
  const [saving, setSaving] = useState(false);
  const [viewsError, setViewsError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setField = (name: keyof TrackedEditFields, value: string) => {
    setFields(prev => ({ ...prev, [name]: value }));
    if (name === 'views') setViewsError(null);
    setSaveError(null);
  };

  const openEdit = (item: TrackedContentItem) => {
    setEditItem(item);
    setFields({ label: item.label || '', category: item.category || '', views: item.manualViews != null ? String(item.manualViews) : '' });
    image.setImageUrl(item.imageUrl || null);
    image.setImageError(null);
    setViewsError(null);
    setSaveError(null);
    clearInput(image.imageInputRef);
  };

  const handleSaveEdit = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!editItem || saving) return;
    const updates: TrackedContentUpdateRequest = { label: fields.label, category: fields.category };
    if (isRedditItem(editItem)) {
      const views = parseManualViews(normalizeViewsText(fields.views));
      if (views.error) {
        setViewsError(`${views.error} Separators and K or M work too, such as 12,500 or 12.5K.`);
        document.getElementById('edit-views')?.focus();
        return;
      }
      updates.manualViews = views.value;
      updates.imageUrl = image.imageUrl || null;
    }
    setSaving(true);
    setSaveError(null);
    try {
      replaceItem(editItem.id, await api.updateTrackedContent(editItem.id, updates));
      setEditItem(null);
      showToast('Changes saved');
    } catch (err) {
      setSaveError(`Couldn't save the changes. ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  // the typed views are shown as the number they will be saved as, once the field is left
  const tidyViews = () => setFields(prev => ({ ...prev, views: normalizeViewsText(prev.views) }));

  return {
    ...image, editItem, setEditItem, fields, setField, saving, openEdit, handleSaveEdit, cloudConfig, viewsError, saveError, tidyViews,
  };
}

export type TrackedEditor = ReturnType<typeof useTrackedEditor>;
