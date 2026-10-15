import type { Platform } from './platforms';

// the made-up creator every picture shows, so the same accounts and numbers agree from one picture to the next

export interface SampleAccount {
  platform: Platform;
  name: string;
  audience: number;
}

export const ACCOUNTS: SampleAccount[] = [
  { platform: 'youtube', name: 'Northwind Kitchen', audience: 84_213 },
  { platform: 'instagram', name: '@northwind.kitchen', audience: 31_702 },
  { platform: 'youtube', name: 'Northwind Shorts', audience: 22_940 },
  { platform: 'reddit', name: 'u/northwind_cooks', audience: 12_410 },
];

// weekly subscribers of the main channel and followers of the Instagram account, last 12 weeks
export const YOUTUBE_WEEKS = [
  71_800, 72_900, 73_400, 74_950, 76_300, 76_900, 78_400, 79_950, 80_600, 82_100, 83_150, 84_213,
];
export const INSTAGRAM_WEEKS = [
  27_100, 27_400, 27_950, 28_200, 28_900, 29_350, 29_600, 30_120, 30_640, 31_050, 31_380, 31_702,
];

export const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct'];
