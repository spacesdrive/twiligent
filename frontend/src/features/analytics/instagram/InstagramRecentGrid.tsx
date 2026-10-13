import { Eye, Heart, Image, MessageCircle } from 'lucide-react';
import SurfaceBox from '@/components/SurfaceBox';
import { MediaChip } from '@/components/MediaCard';
import { EmptyState } from '@/components/StateViews';
import type { SyntheticEvent } from 'react';
import { fmtNum } from '../../../utils/formatters';
import { fmtIGViews, igContentTypeMeta, igThumbnail } from '../../../utils/instagramContent';
import type { InstagramMedia } from '@shared/types/instagram.ts';

function hideBrokenImage(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = 'none';
}

interface RecentPostProps {
  post: InstagramMedia;
}

function RecentPost({ post }: RecentPostProps) {
  const thumb = igThumbnail(post);
  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${igContentTypeMeta(post.contentType).label.toLowerCase()} on Instagram`}
      className="group relative aspect-square overflow-hidden rounded-control border border-line bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {thumb && <img src={thumb} alt="" loading="lazy" className="size-full object-cover" onError={hideBrokenImage} />}
      {post.contentType !== 'post' && (
        <span className="absolute top-1 right-1"><MediaChip className="px-1.5 text-[0.625rem]">{igContentTypeMeta(post.contentType).label}</MediaChip></span>
      )}
      <span className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-gradient-to-t from-[#0C0809]/80 to-transparent pt-4 pb-1 text-[0.625rem] font-semibold text-white opacity-0 transition-opacity duration-(--duration-base) group-hover:opacity-100 group-focus-visible:opacity-100 [&_svg]:size-2.5">
        <span className="flex items-center gap-0.5"><Eye />{fmtIGViews(post.viewCount)}</span>
        <span className="flex items-center gap-0.5"><Heart />{fmtNum(post.likeCount)}</span>
        <span className="flex items-center gap-0.5"><MessageCircle />{fmtNum(post.commentsCount)}</span>
      </span>
    </a>
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
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
          {posts.map(post => <RecentPost key={post.id} post={post} />)}
        </div>
      ) : (
        <EmptyState compact icon={<Image />} title="No posts yet" description="This account has not published anything we can read." />
      )}
    </SurfaceBox>
  );
}
