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

export interface UserRanking {
  userId: string;
  username: string;
  orderedMovieIds: string[];
}

export interface AggregateRanking {
  imdbId: string;
  score: number;
  rankCount: number;
}
