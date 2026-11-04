import {
  Award, BarChart3, BookmarkCheck, Calendar, Camera, CirclePlay, Clapperboard, Clock, Film, Flame, Gauge, Hash, Heart, Image,
  MessageSquare, MessagesSquare, Percent, Scissors, Star, Tag, ThumbsUp, Timer, Trophy, UserPlus, Users, Video, Eye,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// one icon per meaning on every page, so the same picture never stands for two different numbers
export const METRIC_ICONS = {
  views: Eye,
  averageViews: Gauge,
  likes: ThumbsUp,
  instagramLikes: Heart,
  comments: MessageSquare,
  karma: Award,
  awards: Star,
  upvoteRate: Percent,
  rate: Percent,
  audience: Users,
  following: UserPlus,
  videos: CirclePlay,
  shorts: Scissors,
  regularVideos: Video,
  instagram: Camera,
  reels: Clapperboard,
  posts: Image,
  redditPosts: MessagesSquare,
  tracked: BookmarkCheck,
  category: Tag,
  tags: Hash,
  median: BarChart3,
  score: Flame,
  consistency: Trophy,
  quality: Film,
  duration: Timer,
  period: Calendar,
  time: Clock,
} satisfies Record<string, LucideIcon>;

export type MetricIconName = keyof typeof METRIC_ICONS;

// Instagram content types, with the same icons wherever they are counted or filtered
export const IG_TYPE_ICONS = { reel: Clapperboard, post: Image, video: Video } satisfies Record<string, LucideIcon>;
