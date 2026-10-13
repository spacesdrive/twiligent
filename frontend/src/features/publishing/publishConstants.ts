import { Image as ImageIcon, Film, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import type { Badge } from '@/components/ui/badge';
import type { PostStatus } from '@shared/types/domain.ts';
import type { ContentTypeValue } from './publishHelpers.ts';
import type { QueueItemStatus } from './queueHelpers.ts';

export interface ContentTypeOption {
  value: ContentTypeValue;
  label: string;
  icon: LucideIcon;
  accept: string;
  desc: string;
}

export interface StatusEntry {
  label: string;
  variant: ComponentProps<typeof Badge>['variant'];
}

export const BULK_INTERVAL_OPTIONS = [
  { value: 720,   label: 'Every 12 hours' },
  { value: 1440,  label: 'Once a day' },
  { value: 2880,  label: 'Every 2 days' },
  { value: 4320,  label: 'Every 3 days' },
  { value: 10080, label: 'Once a week' },
];

export const CONTENT_TYPES: ContentTypeOption[] = [
  { value: 'IMAGE',   label: 'Photo', icon: ImageIcon, accept: 'image/jpeg', desc: 'JPEG, 4:5 to 1.91:1, up to 8MB' },
  { value: 'REELS',   label: 'Reel',  icon: Film,      accept: 'video/mp4,video/quicktime', desc: 'MP4 or MOV, 9:16, 3 seconds to 15 minutes, up to 300MB' },
  { value: 'STORIES', label: 'Story', icon: BookOpen,  accept: 'image/jpeg,video/mp4,video/quicktime', desc: 'Image or video, 9:16, up to 60 seconds' },
];

export const POST_STATUS: Record<PostStatus, StatusEntry> = {
  published:  { label: 'Published',  variant: 'success' },
  failed:     { label: 'Failed',     variant: 'destructive' },
  publishing: { label: 'Publishing', variant: 'info' },
  pending:    { label: 'Pending',    variant: 'warning' },
};

export const BULK_STATUS: Record<QueueItemStatus, StatusEntry> = {
  pending:    { label: 'Pending',    variant: 'secondary' },
  uploading:  { label: 'Uploading',  variant: 'info' },
  creating:   { label: 'Creating',   variant: 'info' },
  processing: { label: 'Processing', variant: 'info' },
  publishing: { label: 'Publishing', variant: 'info' },
  scheduling: { label: 'Scheduling', variant: 'info' },
  done:       { label: 'Published',  variant: 'success' },
  scheduled:  { label: 'Scheduled',  variant: 'warning' },
  error:      { label: 'Failed',     variant: 'destructive' },
};

export const ACTIVE_BULK: QueueItemStatus[] = ['uploading', 'creating', 'processing', 'publishing', 'scheduling'];
export const CAPTION_LIMIT = 2200;

export function contentTypeOf(value: string | undefined): ContentTypeOption | undefined {
  return CONTENT_TYPES.find(type => type.value === value);
}
