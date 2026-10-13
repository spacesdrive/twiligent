import ConfirmDialog from '@/components/ConfirmDialog';

export default function ScheduledPostDialogs({ removal }) {
  const { pendingDelete, deleting } = removal;
  const isPublished = pendingDelete?.status === 'published';
  return (
    <>
      <ConfirmDialog
        open={removal.confirmDeleteAll}
        onOpenChange={removal.setConfirmDeleteAll}
        title="Delete all scheduled posts?"
        description="Every record is removed: pending, published and failed. Pending posts will not go out. Posts already on Instagram stay live; only Twiligent's records are deleted. Posts that are publishing right now are kept."
        confirmLabel="Delete all"
        onConfirm={removal.handleDeleteAll}
        busy={deleting}
        hold
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={open => { if (!open) removal.setPendingDelete(null); }}
        title={isPublished ? 'Remove this record?' : 'Delete this scheduled post?'}
        description={isPublished
          ? 'The post stays live on Instagram. Only the record in Twiligent is removed.'
          : 'It will not be published. The uploaded media stays in Cloudinary.'}
        confirmLabel={isPublished ? 'Remove' : 'Delete'}
        onConfirm={removal.handleDeleteScheduled}
        busy={deleting}
        hold
      />
    </>
  );
}
