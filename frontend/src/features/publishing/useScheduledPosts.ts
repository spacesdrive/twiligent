import { useCallback, useState } from 'react';
import { api } from '../../services/api';
import type { ScheduledPost } from '@shared/types/domain.ts';
import type { StatusFilter } from './scheduleHelpers.ts';

export function useScheduledPosts() {
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadScheduledPosts = useCallback(async () => {
    try {
      const res = await api.getScheduledPosts();
      if (res.success) setScheduledPosts(res.posts || []);
    } catch {
      // the schedule list is optional, publishing still works
      return;
    }
  }, []);

  return { scheduledPosts, loadScheduledPosts, statusFilter, setStatusFilter };
}

export type ScheduledPostsState = ReturnType<typeof useScheduledPosts>;
