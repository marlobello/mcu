export interface SessionUser {
  userId: string;
  username: string;
  avatar: string | null;
}

export interface Movie {
  imdbId: string;
  title: string;
  year: string;
  rating: string;
  studio: string;
  posterUrl: string | null;
  imdbUrl: string;
  addedByUserId: string;
  addedByUsername: string;
  createdAt: string;
}

export interface WatchedEntry {
  userId: string;
  imdbId: string;
}

export interface WatchedSummary {
  imdbId: string;
  watchCount: number;
  rank: number;
}
