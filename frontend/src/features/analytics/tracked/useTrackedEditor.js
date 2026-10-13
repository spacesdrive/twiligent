import { useRef, useState } from 'react';
import { api } from '../../../services/api';
import { isRedditItem } from '../../../utils/trackedContent';
import { imageFileError, parseManualViews } from './trackedList.js';

function clearInput(inputRef) {
  if (inputRef.current) inputRef.current.value = '';
}

function useTrackedImage({ cloudConfig, showToast }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef(null);

  const handleImageSelect = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = imageFileError(file, !!cloudConfig);
    if (error) { showToast(error, 'error'); return; }
    setUploading(true);
    try {
      // the Worker never handles binary uploads, so only the returned url is saved on the item
      setImageUrl(await api.uploadImage(file, cloudConfig));
      showToast('Image uploaded');
    } catch (err) {
      showToast(`Image upload failed. ${err.message}`, 'error');
    } finally {
      setUploading(false);
      clearInput(imageInputRef);
    }
  };

  return { imageUrl, setImageUrl, uploading, imageInputRef, handleImageSelect };
}

export function useTrackedEditor({ cloudConfig, replaceItem, showToast }) {
  const image = useTrackedImage({ cloudConfig, showToast });
  const [editItem, setEditItem] = useState(null);
  const [fields, setFields] = useState({ label: '', category: '', views: '' });
  const [saving, setSaving] = useState(false);

  const setField = (name, value) => setFields(prev => ({ ...prev, [name]: value }));

  const openEdit = item => {
    setEditItem(item);
    setFields({ label: item.label || '', category: item.category || '', views: item.manualViews != null ? String(item.manualViews) : '' });
    image.setImageUrl(item.imageUrl || null);
    clearInput(image.imageInputRef);
  };

  const handleSaveEdit = async e => {
    e?.preventDefault();
    if (!editItem) return;
    const updates = { label: fields.label, category: fields.category };
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
      showToast(`Couldn't save the changes. ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return { ...image, editItem, setEditItem, fields, setField, saving, openEdit, handleSaveEdit, cloudConfig };
}
