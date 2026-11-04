import ConfirmDialog from '@/components/ConfirmDialog';
import type { ScheduledPostRemoval } from './useScheduledPostDelete';

interface ScheduledPostDialogsProps {
  removal: ScheduledPostRemoval;
}

// deleting one post has Undo instead; deleting every post cannot be undone, so it asks first
export default function ScheduledPostDialogs({ removal }: ScheduledPostDialogsProps) {
  return (
    <ConfirmDialog
      open={removal.confirmDeleteAll}
      onOpenChange={removal.setConfirmDeleteAll}
      title="Delete all scheduled posts?"
      description="Every record is removed: pending, published and failed. Pending posts will not go out. Posts already on Instagram stay live; only Twiligent's records are deleted. Posts that are publishing right now are kept."
      confirmLabel="Delete all posts"
      busyLabel="Deleting"
      onConfirm={removal.handleDeleteAll}
      busy={removal.deleting}
      hold
    />
  );
}
