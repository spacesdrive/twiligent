import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Image, Video, Link2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import ColumnHint from '@/components/ColumnHint';
import Num from '@/components/Num';
import { AccountAvatar } from '@/components/platform';
import { MEDIA_TYPE_LABELS } from './redditPostUtils';
import { fmtDate } from '../../../utils/formatters';
import type { RedditMediaType } from '@shared/types/reddit.ts';
import type { AppAccount } from '../../../utils/formatters';
import type { RedditPostRow } from './redditPostUtils';

const MEDIA_TYPE_ICONS: Record<RedditMediaType, LucideIcon> = { image: Image, video: Video, link: Link2, text: FileText };

function MediaTypeIcon({ type }: { type: RedditMediaType }) {
  const Icon = MEDIA_TYPE_ICONS[type] || FileText;
  return <Icon className="size-3.5" aria-hidden="true" />;
}

export interface RedditPostTableProps {
  posts: RedditPostRow[];
  // rank of the first post on this page
  offset?: number;
  showAccount?: boolean;
  accountsById?: Record<string, AppAccount>;
}

export default function RedditPostTable({ posts, offset = 0, showAccount = false, accountsById = {} }: RedditPostTableProps) {
  return (
    <SurfaceBox title="Posts" content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="hidden w-10 text-right sm:table-cell">#</TableHead>
            <TableHead className="sticky left-0 z-[1] bg-surface-raised">Post</TableHead>
            {showAccount && <TableHead className="hidden w-40 lg:table-cell">Account</TableHead>}
            <TableHead className="hidden w-24 md:table-cell">Type</TableHead>
            <TableHead className="w-24 text-right">Karma</TableHead>
            <TableHead className="hidden w-24 text-right sm:table-cell">Comments</TableHead>
            <TableHead className="hidden w-32 text-right md:table-cell"><ColumnHint label="Upvote rate" hint="Share of votes on the post that are upvotes. 96% means 96 of every 100 votes were up." /></TableHead>
            <TableHead className="hidden w-28 text-right md:table-cell">Posted</TableHead>
            <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((post, i) => (
            <TableRow key={`${post.accountId || ''}-${post.id}`}>
              <TableCell className="hidden text-right font-mono text-caption text-ink-faint sm:table-cell">{offset + i + 1}</TableCell>
              <TableCell className="sticky left-0 z-[1] bg-surface-raised whitespace-normal">
                <div className="max-w-56 sm:max-w-md">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-ink" title={post.title}>{post.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-caption text-ink-faint">{post.subredditPrefixed}</span>
                    {post.flair && <Badge variant="outline">{post.flair}</Badge>}
                    {post.isNsfw && <Badge variant="destructive">NSFW</Badge>}
                  </div>
                </div>
              </TableCell>
              {showAccount && (
                <TableCell className="hidden lg:table-cell">
                  <Link to={`/reddit/${post.accountId}`} className="flex items-center gap-2 text-small text-ink-muted underline-offset-4 hover:text-ink hover:underline">
                    <AccountAvatar account={accountsById[post.accountId!] || { platform: 'reddit', username: post.accountUsername, iconUrl: post.accountIconUrl }} size="xs" decorative />
                    u/{post.accountUsername}
                  </Link>
                </TableCell>
              )}
              <TableCell className="hidden md:table-cell">
                <span className="flex items-center gap-1.5 text-small text-ink-muted">
                  <MediaTypeIcon type={post.mediaType} />
                  {MEDIA_TYPE_LABELS[post.mediaType] || post.mediaType}
                </span>
              </TableCell>
              <TableCell className="text-right font-semibold text-ink"><Num value={post.score} /></TableCell>
              <TableCell className="hidden text-right text-ink-muted sm:table-cell"><Num value={post.numComments} /></TableCell>
              <TableCell className="hidden text-right text-ink-muted md:table-cell">{Math.round((post.upvoteRatio ?? 0) * 100)}%</TableCell>
              <TableCell className="hidden text-right text-small text-ink-faint md:table-cell">{fmtDate(post.createdAt)}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  render={<a href={post.permalink} target="_blank" rel="noopener noreferrer" aria-label={`Open "${post.title}" on Reddit (opens in a new tab)`} />}
                >
                  <ExternalLink aria-hidden="true" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
