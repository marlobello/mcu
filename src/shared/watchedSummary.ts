import type { WatchedEntry, WatchedSummary } from './types.js';

export function aggregateWatched(entries: WatchedEntry[]): WatchedSummary[] {
  const watchersByMovie = new Map<string, Set<string>>();

  for (const entry of entries) {
    const watchers = watchersByMovie.get(entry.imdbId) ?? new Set<string>();
    watchers.add(entry.userId);
    watchersByMovie.set(entry.imdbId, watchers);
  }

  const totals = [...watchersByMovie.entries()]
    .map(([imdbId, watchers]) => ({ imdbId, watchCount: watchers.size }))
    .sort((a, b) => b.watchCount - a.watchCount || a.imdbId.localeCompare(b.imdbId));

  let previousCount: number | null = null;
  let rank = 0;
  return totals.map((entry) => {
    if (entry.watchCount !== previousCount) {
      rank += 1;
      previousCount = entry.watchCount;
    }
    return { ...entry, rank };
  });
}
