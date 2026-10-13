import { ExternalLink } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import { fmtNum } from '../../../utils/formatters';
import type { RedditSubredditStats } from '@shared/types/reddit.ts';

export interface RedditSubredditTableProps {
  subreddits: RedditSubredditStats[];
}

export default function RedditSubredditTable({ subreddits }: RedditSubredditTableProps) {
  return (
    <SurfaceBox title="Top subreddits" content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead>Subreddit</TableHead>
            <TableHead className="text-right">Posts</TableHead>
            <TableHead className="text-right">Total karma</TableHead>
            <TableHead className="text-right">Average karma</TableHead>
            <TableHead className="text-right">Average comments</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subreddits.map((sub, i) => (
            <TableRow key={sub.subreddit}>
              <TableCell className="text-right font-mono text-caption text-ink-faint">{i + 1}</TableCell>
              <TableCell>
                <a href={`https://reddit.com/r/${sub.subreddit}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium text-ink hover:underline">
                  r/{sub.subreddit}
                  <ExternalLink className="size-3 text-ink-faint" />
                </a>
              </TableCell>
              <TableCell className="text-right text-ink-muted">{sub.posts}</TableCell>
              <TableCell className="text-right font-semibold text-ink">{fmtNum(sub.totalScore)}</TableCell>
              <TableCell className="text-right text-ink-muted">{fmtNum(sub.avgScore)}</TableCell>
              <TableCell className="text-right text-ink-muted">{fmtNum(sub.avgComments)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
