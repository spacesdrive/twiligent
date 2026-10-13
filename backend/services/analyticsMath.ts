import type { PostFrequency } from '../../shared/types/reddit.ts';

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_MS = 86400000;

export function sumOf<T>(items: T[], pickValue: (item: T) => number): number {
    return items.reduce((total, item) => total + pickValue(item), 0);
}

export function roundedAverage(total: number, count: number): number {
    return count > 0 ? Math.round(total / count) : 0;
}

export function medianOf(values: number[]): number {
    const sorted = [...values].sort((first, second) => first - second);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2) return sorted[middle];
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function countWithinDays(dates: Date[], now: number, days: number): number {
    return dates.filter(date => (now - date.getTime()) <= days * DAY_MS).length;
}

export function postFrequency(dates: Date[], postCount: number): PostFrequency {
    if (dates.length < 2) return { perWeek: 0, perMonth: 0 };
    const times = dates.map(date => date.getTime());
    const spanDays = Math.max(1, (Math.max(...times) - Math.min(...times)) / DAY_MS);
    return {
        perWeek: parseFloat((postCount / spanDays * 7).toFixed(1)),
        perMonth: parseFloat((postCount / spanDays * 30).toFixed(1)),
    };
}

function coefficientOfVariation(mean: number, stdDev: number): number {
    if (mean > 0) return stdDev / mean;
    return stdDev > 0 ? 10 : 0;
}

// 100 when all values are equal, lower as they spread out from their mean
export function consistencyScore(values: number[]): number {
    if (values.length < 3) return 0;
    const mean = values.reduce((total, value) => total + value, 0) / values.length;
    const variance = values.reduce((total, value) => total + Math.pow(value - mean, 2), 0) / values.length;
    const variation = coefficientOfVariation(mean, Math.sqrt(variance));
    return Math.max(0, Math.min(100, Math.round(100 / (1 + variation))));
}

export function bestToAverageRatio(best: number, average: number): number {
    return average > 0 ? parseFloat((best / average).toFixed(1)) : 0;
}

// undefined for an empty array
export function pickHighest<T extends Record<K, number>, K extends keyof T>(items: T[], field: K): T {
    return items.reduce((best, item) => item[field] > best[field] ? item : best, items[0]);
}

export function monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
