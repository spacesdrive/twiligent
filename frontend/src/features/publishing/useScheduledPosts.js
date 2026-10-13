import { useCallback, useState } from 'react';
import { api } from '../../services/api';

export function useScheduledPosts() {
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');

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
