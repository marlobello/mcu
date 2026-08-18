import { describe, expect, it } from 'vitest';
import { isImdbId } from './imdb.js';

describe('isImdbId', () => {
  it('accepts well-formed IMDb IDs', () => {
    expect(isImdbId('tt0087332')).toBe(true);
    expect(isImdbId('tt1234567890')).toBe(true);
  });

  it('rejects values that are unsafe or malformed as row keys', () => {
    for (const value of ['', 'tt123', 'nm0087332', 'tt0087332/', 'tt00873320000', "tt0087332' or '1", null, undefined]) {
      expect(isImdbId(value)).toBe(false);
    }
  });
});
