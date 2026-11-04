import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import Num from '@/components/Num';
import { fmtDate } from '../../../utils/formatters';
import { fmtIGViews } from '../../../utils/instagramContent';
import TypeBadge from './TypeBadge';
import type { InstagramTopPost } from '@shared/types/instagram.ts';

export interface InstagramTopPostsTableProps {
  posts: InstagramTopPost[];
}

export default function InstagramTopPostsTable({ posts }: InstagramTopPostsTableProps) {
  return (
    <SurfaceBox title="Top performing posts" subheader="Ranked by interactions: likes plus comments" content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead className="sticky left-0 z-10 bg-surface-raised">Caption</TableHead>
            <TableHead className="hidden sm:table-cell">Type</TableHead>
            <TableHead className="hidden text-right md:table-cell">Views</TableHead>
            <TableHead className="text-right">Likes</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Comments</TableHead>
            <TableHead className="text-right">Interactions</TableHead>
            <TableHead className="hidden text-right md:table-cell">Posted</TableHead>
            <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.slice(0, 10).map((post, i) => (
            <TableRow key={post.id}>
              <TableCell className="text-right font-mono text-caption text-ink-faint">{i + 1}</TableCell>
              <TableCell className="sticky left-0 z-10 max-w-56 bg-surface-raised whitespace-normal">
                <p className="line-clamp-2 text-sm text-ink" title={post.caption || undefined}>{post.caption || 'No caption'}</p>
              </TableCell>
              <TableCell className="hidden sm:table-cell"><TypeBadge type={post.contentType} /></TableCell>
              <TableCell className="hidden text-right text-ink-muted md:table-cell">{fmtIGViews(post.viewCount)}</TableCell>
              <TableCell className="text-right font-semibold text-ink"><Num value={post.likeCount} /></TableCell>
              <TableCell className="hidden text-right text-ink-muted sm:table-cell"><Num value={post.commentsCount} /></TableCell>
              <TableCell className="text-right text-ink-muted"><Num value={post.engagement} /></TableCell>
              <TableCell className="hidden text-right text-small text-ink-faint md:table-cell">{fmtDate(post.timestamp)}</TableCell>
              <TableCell>
                {post.permalink && (
                  <Button variant="ghost" size="icon-xs" render={<a href={post.permalink} target="_blank" rel="noopener noreferrer" aria-label={`Open post ${i + 1} on Instagram (opens in a new tab)`} />}>
                    <ExternalLink aria-hidden="true" />
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
