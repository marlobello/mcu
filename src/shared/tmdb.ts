import type { Movie } from './types.js';

interface TmdbSearchMovie {
  id: number;
}

interface TmdbMovieDetails {
  id: number;
  imdb_id: string | null;
  title: string;
  release_date: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  production_companies: Array<{ name: string }>;
}

interface TmdbReleaseDates {
  results: Array<{
    iso_3166_1: string;
    release_dates: Array<{
      certification: string;
      release_date: string;
      type: number;
    }>;
  }>;
}

export interface TmdbMovieSuggestion {
  tmdbId: number;
  imdbId: string;
  title: string;
  year: string;
  posterUrl: string | null;
}

export class TmdbApiError extends Error {}

const apiBase = 'https://api.themoviedb.org/3';
const imageBase = 'https://image.tmdb.org/t/p/w500';

export async function searchTmdbMovies(query: string): Promise<TmdbMovieSuggestion[]> {
  const search = await tmdbFetch<{ results: TmdbSearchMovie[] }>('/search/movie', {
    query,
    include_adult: 'false',
  });
  const details = await Promise.all(
    search.results.slice(0, 10).map((movie) => tmdbFetch<TmdbMovieDetails>(`/movie/${movie.id}`)),
  );
  return details.flatMap((movie) => {
    if (!validImdbId(movie.imdb_id)) return [];
    return [{
      tmdbId: movie.id,
      imdbId: movie.imdb_id,
      title: movie.title,
      year: yearFromDate(movie.release_date),
      posterUrl: posterUrl(movie.poster_path),
    }];
  });
}

export async function getTmdbMovie(
  tmdbId: number,
  addedByUserId: string,
  addedByUsername: string,
): Promise<Movie | null> {
  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) return null;
  const metadata = await getTmdbMetadata(tmdbId);
  if (!metadata) return null;
  return {
    ...metadata,
    addedByUserId,
    addedByUsername,
    createdAt: new Date().toISOString(),
  };
}

export async function refreshMovieFromTmdb(movie: Movie): Promise<Movie | null> {
  if (!validImdbId(movie.imdbId)) return null;
  const match = await tmdbFetch<{ movie_results: TmdbSearchMovie[] }>(
    `/find/${encodeURIComponent(movie.imdbId)}`,
    { external_source: 'imdb_id' },
  );
  const tmdbId = match.movie_results[0]?.id;
  if (!tmdbId) return null;
  const metadata = await getTmdbMetadata(tmdbId);
  return metadata ? { ...movie, ...metadata } : null;
}

async function getTmdbMetadata(tmdbId: number): Promise<Omit<Movie, 'addedByUserId' | 'addedByUsername' | 'createdAt'> | null> {
  const [details, releaseDates] = await Promise.all([
    tmdbFetch<TmdbMovieDetails>(`/movie/${tmdbId}`),
    tmdbFetch<TmdbReleaseDates>(`/movie/${tmdbId}/release_dates`),
  ]);
  if (!validImdbId(details.imdb_id)) return null;
  return {
    imdbId: details.imdb_id,
    title: details.title,
    year: yearFromDate(details.release_date),
    rating: usCertification(releaseDates),
    tmdbScore: validScore(details.vote_average),
    tmdbVoteCount: validVoteCount(details.vote_count),
    studio: details.production_companies.map((company) => company.name).filter(Boolean).join(', ') || 'Unknown',
    posterUrl: posterUrl(details.poster_path),
    imdbUrl: `https://www.imdb.com/title/${details.imdb_id}/`,
  };
}

async function tmdbFetch<T>(path: string, parameters: Record<string, string> = {}): Promise<T> {
  const token = process.env.TMDB_API_TOKEN?.trim();
  if (!token) throw new TmdbApiError('TMDB_API_TOKEN is required');
  const url = new URL(`${apiBase}${path}`);
  url.search = new URLSearchParams({ language: 'en-US', ...parameters }).toString();
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new TmdbApiError(`TMDB request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

function usCertification(data: TmdbReleaseDates): string {
  const priority = new Map([[3, 0], [2, 1], [1, 2], [4, 3], [5, 4], [6, 5]]);
  const releases = data.results.find((result) => result.iso_3166_1 === 'US')?.release_dates ?? [];
  return releases
    .filter((release) => release.certification.trim())
    .sort((a, b) => (priority.get(a.type) ?? 99) - (priority.get(b.type) ?? 99)
      || a.release_date.localeCompare(b.release_date))[0]?.certification.trim() || 'Unrated';
}

function posterUrl(path: string | null): string | null {
  return path && /^\/[A-Za-z0-9._-]+$/.test(path) ? `${imageBase}${path}` : null;
}

function yearFromDate(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 4) : 'Unknown';
}

function validScore(value: number): number {
  return Number.isFinite(value) && value >= 0 && value <= 10 ? value : 0;
}

function validVoteCount(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function validImdbId(value: string | null): value is string {
  return Boolean(value && /^tt\d{7,10}$/.test(value));
}
