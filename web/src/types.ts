export interface User {
  userId: string
  username: string
  avatar: string | null
}

export interface Movie {
  imdbId: string
  title: string
  year: string
  rating: string
  tmdbScore: number
  tmdbVoteCount: number
  studio: string
  posterUrl: string | null
  imdbUrl: string
  addedByUsername: string
}

export interface WatchedSummary {
  imdbId: string
  watchCount: number
  rank: number
}

export interface SearchResult {
  tmdbId: number
  imdbId: string
  title: string
  year: string
  posterUrl: string | null
  alreadyAdded: boolean
}

export type AuthState = 'checking' | 'authenticated' | 'anonymous' | 'error'

export type TabName = 'catalog' | 'shelf' | 'mine' | 'munch'

export type RequestFn = <T>(path: string, init?: RequestInit) => Promise<T>
