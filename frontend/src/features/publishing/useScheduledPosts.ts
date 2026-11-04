import { useCallback, useMemo, useState } from 'react';
import { useUrlChoice } from '@/hooks/use-url-state';
import { api } from '../../services/api';
import type { ScheduledPost } from '@shared/types/domain.ts';
import type { StatusFilter } from './scheduleHelpers.ts';

const STATUS_FILTERS: StatusFilter[] = ['all', 'pending', 'publishing', 'published', 'failed'];

export function useScheduledPosts() {
  const [loadedPosts, setLoadedPosts] = useState<ScheduledPost[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // the status filter is kept in the address, so a refresh or a shared link shows the same list
  const [statusFilter, setStatusFilter] = useUrlChoice<StatusFilter>('status', STATUS_FILTERS, 'all', { history: 'replace' });

  const loadScheduledPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getScheduledPosts();
      setLoadedPosts(res.posts);
      setLoadError(null);
    } catch (err) {
      // the list is optional and publishing still works, so the failure is shown on the list only
      setLoadError(`Couldn't load the scheduled posts. ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // a post waiting out its Undo window is hidden here, not removed, so Undo can bring it straight back
  const hidePost = useCallback((id: string) => setHiddenIds(ids => [...ids, id]), []);
  const showPost = useCallback((id: string) => setHiddenIds(ids => ids.filter(item => item !== id)), []);
  const scheduledPosts = useMemo(() => loadedPosts.filter(post => !hiddenIds.includes(post.id)), [hiddenIds, loadedPosts]);

  return { scheduledPosts, loadScheduledPosts, loading, loadError, statusFilter, setStatusFilter, hidePost, showPost };
}

export type ScheduledPostsState = ReturnType<typeof useScheduledPosts>;
