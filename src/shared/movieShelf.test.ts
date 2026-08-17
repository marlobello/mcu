import { describe, expect, it } from 'vitest';
import { mergeShelfMovieIds } from './movieShelf.js';

describe('mergeShelfMovieIds', () => {
  it('includes watched movies and removes duplicate shelf entries', () => {
    expect(mergeShelfMovieIds(
      ['tt3', 'tt1'],
      ['tt2', 'tt1'],
    )).toEqual(['tt1', 'tt2', 'tt3']);
  });

  it('returns an empty list when the user has no shelf or watched movies', () => {
    expect(mergeShelfMovieIds([], [])).toEqual([]);
  });
});
