import { useEffect, useState } from 'react';
import { clearDraft, readDraft, writeDraft } from '@/lib/sessionDraft';
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

const DRAFT_KEY = 'publish:single';

// the typed parts of a post; a chosen file cannot be kept, so it is chosen again after a reload
interface SinglePostDraft {
  contentType: ContentTypeValue | '';
  fields: SinglePostFields;
}

function hasTypedWork(fields: SinglePostFields): boolean {
  return JSON.stringify(fields) !== JSON.stringify(INITIAL_FIELDS);
}

export function useSinglePostForm() {
  const media = useSinglePostMedia();
  const [draft] = useState(() => readDraft<SinglePostDraft>(DRAFT_KEY));
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [contentType, setContentType] = useState<ContentTypeValue | ''>(() => draft?.contentType ?? '');
  const [fields, setFields] = useState<SinglePostFields>(() => ({ ...INITIAL_FIELDS, ...draft?.fields }));
  const [restored, setRestored] = useState(() => Boolean(draft && hasTypedWork({ ...INITIAL_FIELDS, ...draft.fields })));

  const typed = hasTypedWork(fields);
  // work that would be lost by leaving: a chosen file or anything typed
  const dirty = Boolean(media.file) || typed;

  useEffect(() => {
    if (typed) writeDraft<SinglePostDraft>(DRAFT_KEY, { contentType, fields });
    else clearDraft(DRAFT_KEY);
  }, [contentType, fields, typed]);

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
    setRestored(false);
    clearDraft(DRAFT_KEY);
  };

  const scheduleIncomplete = fields.scheduleMode && (!fields.scheduleDate || !fields.scheduleTime);
  const canPublish = Boolean(media.file) && Boolean(contentType) && Boolean(selectedAccount) && !scheduleIncomplete;

  return {
    ...media, selectedAccount, setSelectedAccount, contentType, changeContentType,
    fields, setField, resetForm, canPublish, dirty, restored, dismissRestored: () => setRestored(false),
  };
}

export type SinglePostForm = ReturnType<typeof useSinglePostForm>;
