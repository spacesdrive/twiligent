import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import { fmtDate, fmtNum } from '../../../utils/formatters';
import { fmtIGViews } from '../../../utils/instagramContent';
import TypeBadge from './TypeBadge';
import type { InstagramTopPost } from '@shared/types/instagram.ts';

export interface InstagramTopPostsTableProps {
  posts: InstagramTopPost[];
}

export default function InstagramTopPostsTable({ posts }: InstagramTopPostsTableProps) {
  return (
    <SurfaceBox title="Top performing posts" content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead>Caption</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Views</TableHead>
            <TableHead className="text-right">Likes</TableHead>
            <TableHead className="text-right">Comments</TableHead>
            <TableHead className="text-right">Engagement</TableHead>
            <TableHead>Posted</TableHead>
            <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.slice(0, 10).map((post, i) => (
            <TableRow key={post.id}>
              <TableCell className="text-right font-mono text-caption text-ink-faint">{i + 1}</TableCell>
              <TableCell className="max-w-[220px]"><p className="truncate text-sm text-ink">{post.caption || 'No caption'}</p></TableCell>
              <TableCell><TypeBadge type={post.contentType} /></TableCell>
              <TableCell className="text-right text-ink-muted">{fmtIGViews(post.viewCount)}</TableCell>
              <TableCell className="text-right font-semibold text-ink">{fmtNum(post.likeCount)}</TableCell>
              <TableCell className="text-right text-ink-muted">{fmtNum(post.commentsCount)}</TableCell>
              <TableCell className="text-right text-ink-muted">{fmtNum(post.engagement)}</TableCell>
              <TableCell className="text-small text-ink-faint">{fmtDate(post.timestamp)}</TableCell>
              <TableCell>
                {post.permalink && (
                  <Button variant="ghost" size="icon-xs" render={<a href={post.permalink} target="_blank" rel="noopener noreferrer" aria-label="Open post on Instagram" />}>
                    <ExternalLink />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
