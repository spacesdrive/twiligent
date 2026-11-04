import { CheckCircle2, Image as ImageIcon, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AccountAvatar } from '@/components/platform';
import { cn } from '@/lib/utils';
import ScheduledPostEditRow from './ScheduledPostEditRow';
import StatusBadge from './StatusBadge';
import { POST_STATUS, contentTypeOf } from './publishConstants';
import { formatScheduleDate, isPastDue, isRetrying } from './scheduleHelpers.ts';
import { editButtonId } from './useScheduledPostEdit';
import type { ScheduledPost } from '@shared/types/domain.ts';
import type { AppAccount } from '../../utils/formatters';
import type { ScheduledPostEditor } from './useScheduledPostEdit';

interface PostActionsProps {
  post: ScheduledPost;
  isEditing: boolean;
  editor: ScheduledPostEditor;
  onDelete: (post: ScheduledPost) => void;
}

interface ScheduledPostRowProps {
  post: ScheduledPost;
  position: number;
  account: AppAccount | undefined;
  editor: ScheduledPostEditor;
  onDelete: (post: ScheduledPost) => void;
}

// every row has the same buttons, so each name says which post it acts on
function PostActions({ post, isEditing, editor, onDelete }: PostActionsProps) {
  const canEdit = post.status === 'pending';
  const when = formatScheduleDate(post.scheduledAt);
  const deleteLabel = post.status === 'published' ? `Remove the record of the post published ${formatScheduleDate(post.publishedAt)}` : `Delete the post scheduled for ${when}`;
  return (
    <TableCell className="text-right whitespace-nowrap">
      {canEdit && !isEditing && (
        <Tooltip>
          <TooltipTrigger render={<Button id={editButtonId(post.id)} variant="ghost" size="icon-sm" onClick={() => editor.startEditPost(post)} aria-label={`Edit the post scheduled for ${when}`} />}><Pencil /></TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      )}
      {isEditing && <Button variant="ghost" size="icon-sm" onClick={editor.cancelEdit} aria-label="Cancel editing"><X /></Button>}
      {post.status !== 'publishing' && (
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={() => onDelete(post)} aria-label={deleteLabel} className="ml-2 hover:bg-danger-soft hover:text-danger" />}><Trash2 /></TooltipTrigger>
          <TooltipContent>{post.status === 'published' ? 'Remove record' : 'Delete'}</TooltipContent>
        </Tooltip>
      )}
    </TableCell>
  );
}

export default function ScheduledPostRow({ post, position, account, editor, onDelete }: ScheduledPostRowProps) {
  const typeInfo = contentTypeOf(post.mediaType);
  const TypeIcon = typeInfo?.icon || ImageIcon;
  const isEditing = editor.draft.postId === post.id;
  const pastDue = isPastDue(post);
  return (
    <>
      <TableRow data-state={isEditing ? 'selected' : undefined}>
        <TableCell className="text-right font-mono text-caption text-ink-faint">{position}</TableCell>
        <TableCell>
          <span className="flex items-center gap-2">
            {account && <AccountAvatar account={account} size="xs" decorative />}
            <span className="text-small font-medium text-ink">{account?.username ? `@${account.username}` : post.accountId}</span>
          </span>
        </TableCell>
        <TableCell>
          <span className="flex items-center gap-1.5 text-small text-ink-muted"><TypeIcon className="size-3.5" aria-hidden="true" />{typeInfo?.label || post.mediaType}</span>
        </TableCell>
        <TableCell className="whitespace-normal">
          <p className="line-clamp-3 max-w-64 text-small break-words text-ink-muted" title={post.caption || undefined}>{post.caption || 'No caption'}</p>
        </TableCell>
        <TableCell>
          <span className={cn('text-small', pastDue ? 'text-warning' : 'text-ink-muted')}>{formatScheduleDate(post.scheduledAt)}</span>
          {pastDue && <p className="text-caption text-warning">Overdue</p>}
        </TableCell>
        <TableCell>
          <span className="flex flex-col text-small text-ink-muted">
            <span className="flex items-center gap-1">
              {formatScheduleDate(post.publishedAt)}
              {post.publishedMediaId && <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />}
            </span>
            {post.publishedMediaId && <span className="font-mono text-caption text-ink-faint">Media ID {post.publishedMediaId}</span>}
          </span>
        </TableCell>
        <TableCell>
          <StatusBadge status={post.status} map={POST_STATUS} />
          {isRetrying(post) && <p className="mt-1 text-caption text-ink-faint">Trying again on the next run</p>}
        </TableCell>
        <TableCell className="whitespace-normal">
          {post.error
            ? <p className="max-w-64 text-small break-words text-danger"><span className="sr-only">Error: </span>{post.error}</p>
            : <span className="text-ink-faint">-</span>}
        </TableCell>
        <PostActions post={post} isEditing={isEditing} editor={editor} onDelete={onDelete} />
      </TableRow>
      {isEditing && <ScheduledPostEditRow editor={editor} />}
    </>
  );
}
