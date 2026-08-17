import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTmdbMovie, refreshMovieFromTmdb, searchTmdbMovies } from './tmdb.js';
import type { Movie } from './types.js';

const originalToken = process.env.TMDB_API_TOKEN;

beforeEach(() => {
  process.env.TMDB_API_TOKEN = 'test-token';
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env.TMDB_API_TOKEN = originalToken;
});

describe('TMDB metadata', () => {
  it('searches movies and returns only results with IMDb IDs', async () => {
    mockFetch(
      { results: [{ id: 11 }, { id: 12 }] },
      details({ id: 11, imdb_id: 'tt0076759', title: 'Star Wars', release_date: '1977-05-25', poster_path: '/star.jpg' }),
      details({ id: 12, imdb_id: null, title: 'No IMDb movie', release_date: '', poster_path: null }),
    );

    await expect(searchTmdbMovies('Star Wars')).resolves.toEqual([{
      tmdbId: 11,
      imdbId: 'tt0076759',
      title: 'Star Wars',
      year: '1977',
      posterUrl: 'https://image.tmdb.org/t/p/w500/star.jpg',
    }]);
  });

  it('maps details, studios, and the preferred US theatrical certification', async () => {
    mockFetch(
      details({
        id: 11,
        imdb_id: 'tt0076759',
        title: 'Star Wars',
        release_date: '1977-05-25',
        poster_path: '/star.jpg',
        production_companies: [{ name: 'Lucasfilm Ltd.' }, { name: '20th Century Fox' }],
      }),
      {
        results: [{
          iso_3166_1: 'US',
          release_dates: [
            { certification: 'PG', release_date: '1977-05-25T00:00:00.000Z', type: 3 },
            { certification: 'TV-PG', release_date: '1980-01-01T00:00:00.000Z', type: 6 },
          ],
        }],
      },
    );

    await expect(getTmdbMovie(11, 'user-1', 'Leia')).resolves.toMatchObject({
      imdbId: 'tt0076759',
      title: 'Star Wars',
      year: '1977',
      rating: 'PG',
      tmdbScore: 8.2,
      tmdbVoteCount: 22061,
      studio: 'Lucasfilm Ltd., 20th Century Fox',
      posterUrl: 'https://image.tmdb.org/t/p/w500/star.jpg',
      addedByUserId: 'user-1',
      addedByUsername: 'Leia',
    });
  });

  it('refreshes metadata while preserving movie identity and audit fields', async () => {
    const existing: Movie = {
      imdbId: 'tt0076759',
      title: 'Old title',
      year: 'Unknown',
      rating: 'Unrated',
      tmdbScore: 0,
      tmdbVoteCount: 0,
      studio: 'Unknown',
      posterUrl: null,
      imdbUrl: 'https://www.imdb.com/title/tt0076759/',
      addedByUserId: 'user-1',
      addedByUsername: 'Leia',
      createdAt: '2026-08-17T00:00:00.000Z',
    };
    mockFetch(
      { movie_results: [{ id: 11 }] },
      details({ id: 11, imdb_id: 'tt0076759', title: 'Star Wars', release_date: '1977-05-25', poster_path: '/star.jpg' }),
      { results: [] },
    );

    await expect(refreshMovieFromTmdb(existing)).resolves.toMatchObject({
      imdbId: existing.imdbId,
      title: 'Star Wars',
      addedByUserId: existing.addedByUserId,
      addedByUsername: existing.addedByUsername,
      createdAt: existing.createdAt,
    });
  });
});

function details(overrides: Partial<{
  id: number;
  imdb_id: string | null;
  title: string;
  release_date: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  production_companies: Array<{ name: string }>;
}>) {
  return {
    id: 1,
    imdb_id: 'tt0000001',
    title: 'Movie',
    release_date: '2000-01-01',
    poster_path: null,
    vote_average: 8.2,
    vote_count: 22061,
    production_companies: [],
    ...overrides,
  };
}

function mockFetch(...bodies: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(
    async () => new Response(JSON.stringify(bodies.shift()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ));
}
