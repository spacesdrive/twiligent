import { useState } from 'react';
import { useSinglePostMedia } from './useSinglePostMedia';

const INITIAL_FIELDS = {
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
  const [selectedAccount, setSelectedAccount] = useState('');
  const [contentType, setContentType] = useState('');
  const [fields, setFields] = useState(INITIAL_FIELDS);

  const setField = (name, value) => setFields(prev => ({ ...prev, [name]: value }));

  const changeContentType = value => {
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
  const canPublish = !!media.file && !!contentType && !!selectedAccount && !scheduleIncomplete;

  return {
    ...media, selectedAccount, setSelectedAccount, contentType, changeContentType,
    fields, setField, resetForm, canPublish,
  };
}
