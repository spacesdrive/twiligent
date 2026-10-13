import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import ColumnHint from '@/components/ColumnHint';
import { RankNumber } from '@/components/ListRow';
import { fmtDate, fmtNum } from '../../../utils/formatters';
import type { RedditPost } from '@shared/types/reddit.ts';

export interface RedditTopPostsTableProps {
  posts: RedditPost[];
}

export default function RedditTopPostsTable({ posts }: RedditTopPostsTableProps) {
  return (
    <SurfaceBox title="Top posts by karma" content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead>Post</TableHead>
            <TableHead className="text-right">Karma</TableHead>
            <TableHead className="text-right">Comments</TableHead>
            <TableHead className="text-right"><ColumnHint label="Upvote rate" hint="Share of votes on the post that are upvotes. 96% means 96 of every 100 votes were up." /></TableHead>
            <TableHead className="text-right">Posted</TableHead>
            <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((post, i) => (
            <TableRow key={post.id}>
              <TableCell className="text-right"><RankNumber rank={i + 1} className="w-auto" /></TableCell>
              <TableCell className="whitespace-normal">
                <div className="max-w-sm">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{post.title}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-caption text-ink-faint">{post.subredditPrefixed}</span>
                    {post.flair && <Badge variant="outline">{post.flair}</Badge>}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right font-semibold text-ink">{fmtNum(post.score)}</TableCell>
              <TableCell className="text-right text-ink-muted">{fmtNum(post.numComments)}</TableCell>
              <TableCell className="text-right text-ink-muted">{Math.round((post.upvoteRatio ?? 0) * 100)}%</TableCell>
              <TableCell className="text-right text-small text-ink-faint">{fmtDate(post.createdAt)}</TableCell>
              <TableCell>
                <Button variant="ghost" size="icon-xs" render={<a href={post.permalink} target="_blank" rel="noopener noreferrer" aria-label={`Open "${post.title}" on Reddit`} />}>
                  <ExternalLink />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
