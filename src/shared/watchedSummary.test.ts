import { describe, expect, it } from 'vitest';
import { aggregateWatched } from './watchedSummary.js';

describe('aggregateWatched', () => {
  it('counts unique users and assigns dense shared ranks', () => {
    expect(aggregateWatched([
      { userId: 'a', imdbId: 'tt1' },
      { userId: 'a', imdbId: 'tt1' },
      { userId: 'b', imdbId: 'tt1' },
      { userId: 'a', imdbId: 'tt2' },
      { userId: 'c', imdbId: 'tt2' },
      { userId: 'a', imdbId: 'tt3' },
    ])).toEqual([
      { imdbId: 'tt1', watchCount: 2, rank: 1 },
      { imdbId: 'tt2', watchCount: 2, rank: 1 },
      { imdbId: 'tt3', watchCount: 1, rank: 2 },
    ]);
  });

  it('returns an empty list when no movies are watched', () => {
    expect(aggregateWatched([])).toEqual([]);
  });
});
