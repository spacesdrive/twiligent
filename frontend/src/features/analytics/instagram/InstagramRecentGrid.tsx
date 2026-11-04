import { Image } from 'lucide-react';
import SurfaceBox from '@/components/SurfaceBox';
import { MediaChip } from '@/components/MediaCard';
import { EmptyState } from '@/components/StateViews';
import { METRIC_ICONS } from '@/lib/metricIcons';
import type { SyntheticEvent } from 'react';
import { fmtNum } from '../../../utils/formatters';
import { fmtIGViews, igContentTypeMeta, igThumbnail } from '../../../utils/instagramContent';
import type { InstagramMedia } from '@shared/types/instagram.ts';

const { views: Views, instagramLikes: Likes, comments: Comments } = METRIC_ICONS;

function hideBrokenImage(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = 'none';
}

interface RecentPostProps {
  post: InstagramMedia;
}

// the figures sit under the picture at all times: hover never reaches a touch screen or a screen reader
function RecentPost({ post }: RecentPostProps) {
  const thumb = igThumbnail(post);
  const type = igContentTypeMeta(post.contentType).label;
  return (
    <li>
      <a
        href={post.permalink}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex flex-col gap-1.5 rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="relative block aspect-square overflow-hidden rounded-control border border-line bg-surface-sunken">
          {thumb && <img src={thumb} alt="" loading="lazy" className="size-full object-cover" onError={hideBrokenImage} />}
          {post.contentType !== 'post' && (
            <span className="absolute top-1 right-1"><MediaChip>{type}</MediaChip></span>
          )}
        </span>
        <span className="sr-only">Open {type.toLowerCase()} on Instagram (opens in a new tab):</span>
        <span className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-caption text-ink-muted tabular-nums [&_svg]:size-3 [&_svg]:stroke-[1.75]">
          <span className="flex items-center gap-0.5"><Views aria-hidden="true" />{fmtIGViews(post.viewCount)}<span className="sr-only"> views,</span></span>
          <span className="flex items-center gap-0.5"><Likes aria-hidden="true" />{fmtNum(post.likeCount)}<span className="sr-only"> likes,</span></span>
          <span className="flex items-center gap-0.5"><Comments aria-hidden="true" />{fmtNum(post.commentsCount)}<span className="sr-only"> comments</span></span>
        </span>
      </a>
    </li>
  );
}

export interface InstagramRecentGridProps {
  posts: InstagramMedia[];
  fetchedPosts: number | undefined;
}

export default function InstagramRecentGrid({ posts, fetchedPosts }: InstagramRecentGridProps) {
  return (
    <SurfaceBox title="Recent posts" subheader={`${fetchedPosts || 0} loaded`}>
      {posts.length > 0 ? (
        <ul className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
          {posts.map(post => <RecentPost key={post.id} post={post} />)}
        </ul>
      ) : (
        <EmptyState compact icon={<Image />} title="No posts yet" description="This account has not published anything Instagram lets Twiligent read." />
      )}
    </SurfaceBox>
  );
}
