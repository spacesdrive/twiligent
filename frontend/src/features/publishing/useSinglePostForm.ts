import { useState } from 'react';
import { useSinglePostMedia } from './useSinglePostMedia';
import type { ContentTypeValue, SinglePostFields } from './publishHelpers.ts';

const INITIAL_FIELDS: SinglePostFields = {
  caption: '',
  shareToFeed: true,
  audioName: '',
  thumbOffset: '',
  locationId: '',
  collaborators: '',
  userTags: '',
  altText: '',
  scheduleMode: false,
  scheduleDate: '',
  scheduleTime: '',
};

export function useSinglePostForm() {
  const media = useSinglePostMedia();
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [contentType, setContentType] = useState<ContentTypeValue | ''>('');
  const [fields, setFields] = useState<SinglePostFields>(INITIAL_FIELDS);

  const setField = <K extends keyof SinglePostFields>(name: K, value: SinglePostFields[K]) => setFields(prev => ({ ...prev, [name]: value }));

  const changeContentType = (value: ContentTypeValue) => {
    setContentType(value);
    media.clearFile();
  };

  // the account stays selected so the next post goes to the same place
  const resetForm = () => {
    media.clearFile();
    media.clearCover();
    setFields(INITIAL_FIELDS);
    setContentType('');
  };

  const scheduleIncomplete = fields.scheduleMode && (!fields.scheduleDate || !fields.scheduleTime);
  const canPublish = Boolean(media.file) && Boolean(contentType) && Boolean(selectedAccount) && !scheduleIncomplete;

  return {
    ...media, selectedAccount, setSelectedAccount, contentType, changeContentType,
    fields, setField, resetForm, canPublish,
  };
}

export type SinglePostForm = ReturnType<typeof useSinglePostForm>;
