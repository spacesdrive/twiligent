export type Platform = 'youtube' | 'instagram' | 'reddit';

const LABELS: Record<Platform, string> = { youtube: 'YouTube', instagram: 'Instagram', reddit: 'Reddit' };

export function platformLabel(platform: Platform): string {
  return LABELS[platform];
}
