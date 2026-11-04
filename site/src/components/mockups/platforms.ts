export type Platform = 'youtube' | 'instagram';

const LABELS: Record<Platform, string> = { youtube: 'YouTube', instagram: 'Instagram' };

export function platformLabel(platform: Platform): string {
  return LABELS[platform];
}
