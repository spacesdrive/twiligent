import { ExternalLink } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SurfaceBox from '@/components/SurfaceBox';
import Num from '@/components/Num';
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
            <TableHead className="hidden text-right sm:table-cell">Average karma</TableHead>
            <TableHead className="hidden text-right md:table-cell">Average comments</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subreddits.map((sub, i) => (
            <TableRow key={sub.subreddit}>
              <TableCell className="text-right font-mono text-caption text-ink-faint">{i + 1}</TableCell>
              <TableCell>
                <a href={`https://reddit.com/r/${sub.subreddit}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium text-ink underline-offset-4 hover:underline">
                  r/{sub.subreddit}
                  <ExternalLink className="size-3 text-ink-faint" aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </TableCell>
              <TableCell className="text-right text-ink-muted">{sub.posts}</TableCell>
              <TableCell className="text-right font-semibold text-ink"><Num value={sub.totalScore} /></TableCell>
              <TableCell className="hidden text-right text-ink-muted sm:table-cell"><Num value={sub.avgScore} /></TableCell>
              <TableCell className="hidden text-right text-ink-muted md:table-cell"><Num value={sub.avgComments} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
