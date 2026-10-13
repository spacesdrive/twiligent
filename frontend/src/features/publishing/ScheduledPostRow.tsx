import { CheckCircle2, Image as ImageIcon, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AccountAvatar } from '@/components/platform';
import { cn } from '@/lib/utils';
import ScheduledPostEditRow from './ScheduledPostEditRow';
import StatusBadge from './StatusBadge';
import { POST_STATUS, contentTypeOf } from './publishConstants';
import { formatScheduleDate, isPastDue } from './scheduleHelpers.ts';

function PostActions({ post, isEditing, editor, onDelete }) {
  // mirrors the backend edit check, which also accepts a 'scheduled' status
  const canEdit = post.status === 'pending' || post.status === 'scheduled';
  const deleteLabel = post.status === 'published' ? 'Remove record' : 'Delete scheduled post';
  return (
    <TableCell className="text-right whitespace-nowrap">
      {canEdit && !isEditing && (
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => editor.startEditPost(post)} aria-label="Edit scheduled post" />}><Pencil /></TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      )}
      {isEditing && <Button variant="ghost" size="icon-xs" onClick={editor.cancelEdit} aria-label="Cancel editing"><X /></Button>}
      {post.status !== 'publishing' && (
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => onDelete(post)} aria-label={deleteLabel} className="hover:bg-danger-soft hover:text-danger" />}><Trash2 /></TooltipTrigger>
          <TooltipContent>{post.status === 'published' ? 'Remove record' : 'Delete'}</TooltipContent>
        </Tooltip>
      )}
    </TableCell>
  );
}

export default function ScheduledPostRow({ post, position, account, editor, onDelete }) {
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
            {account && <AccountAvatar account={account} size="xs" />}
            <span className="text-small font-medium text-ink">{account?.username ? `@${account.username}` : post.accountId}</span>
          </span>
        </TableCell>
        <TableCell>
          <span className="flex items-center gap-1.5 text-small text-ink-muted"><TypeIcon className="size-3.5" />{typeInfo?.label || post.mediaType}</span>
        </TableCell>
        <TableCell>
          <Tooltip>
            <TooltipTrigger render={<p className="max-w-48 cursor-default truncate text-small text-ink-muted" />}>{post.caption || 'No caption'}</TooltipTrigger>
            <TooltipContent className="max-w-sm">{post.caption || 'No caption'}</TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell>
          <span className={cn('text-small', pastDue ? 'text-warning' : 'text-ink-muted')}>{formatScheduleDate(post.scheduledAt)}</span>
          {pastDue && <p className="text-caption text-warning">Overdue</p>}
        </TableCell>
        <TableCell>
          <span className="flex items-center gap-1 text-small text-ink-muted">
            {formatScheduleDate(post.publishedAt)}
            {post.publishedMediaId && (
              <Tooltip>
                <TooltipTrigger render={<span className="text-success" />}><CheckCircle2 className="size-3.5" /></TooltipTrigger>
                <TooltipContent>Media ID {post.publishedMediaId}</TooltipContent>
              </Tooltip>
            )}
          </span>
        </TableCell>
        <TableCell><StatusBadge status={post.status} map={POST_STATUS} /></TableCell>
        <TableCell>
          {post.error ? (
            <Tooltip>
              <TooltipTrigger render={<p className="max-w-40 cursor-help truncate text-small text-danger" />}>{post.error}</TooltipTrigger>
              <TooltipContent className="max-w-sm">{post.error}</TooltipContent>
            </Tooltip>
          ) : <span className="text-ink-faint">-</span>}
        </TableCell>
        <PostActions post={post} isEditing={isEditing} editor={editor} onDelete={onDelete} />
      </TableRow>
      {isEditing && <ScheduledPostEditRow editor={editor} />}
    </>
  );
}
