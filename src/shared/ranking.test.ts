import { describe, expect, it } from 'vitest';
import { aggregateRankings } from './ranking.js';

describe('aggregateRankings', () => {
  it('normalizes partial lists and excludes unranked movies', () => {
    const result = aggregateRankings([
      { userId: 'a', username: 'A', orderedMovieIds: ['tt1', 'tt2', 'tt3'] },
      { userId: 'b', username: 'B', orderedMovieIds: ['tt2', 'tt1'] },
    ]);

    expect(result).toEqual([
      { imdbId: 'tt2', score: 75, rankCount: 2 },
      { imdbId: 'tt1', score: 50, rankCount: 2 },
      { imdbId: 'tt3', score: 0, rankCount: 1 },
    ]);
  });

  it('gives a single ranked movie a full score', () => {
    expect(aggregateRankings([
      { userId: 'a', username: 'A', orderedMovieIds: ['tt1'] },
    ])).toEqual([{ imdbId: 'tt1', score: 100, rankCount: 1 }]);
  });
});
