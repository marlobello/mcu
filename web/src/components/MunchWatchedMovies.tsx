import { useMemo } from 'react'
import type { Movie, WatchedSummary } from '../types'
import { EmptyState } from './EmptyState'
import { Poster } from './Poster'
import { TmdbRating } from './TmdbRating'

export function MunchWatchedMovies({ movies, community }: { movies: Movie[]; community: WatchedSummary[] }) {
  const entries = useMemo(() => {
    const byId = new Map(movies.map((movie) => [movie.imdbId, movie]))
    return community
      .flatMap((entry) => {
        const movie = byId.get(entry.imdbId)
        return movie ? [{ ...entry, movie }] : []
      })
      .sort((a, b) => b.watchCount - a.watchCount || a.movie.title.localeCompare(b.movie.title))
  }, [community, movies])

  return (
    <section>
      <div className="section-heading">
        <div><span className="eyebrow">The community watchlist</span><h1>Munch Watched Movies</h1><p>Ranked only by how many members have watched each movie.</p></div>
      </div>
      {entries.length === 0 ? (
        <EmptyState title="No watched movies yet" detail="The community list appears after someone marks a movie as watched." />
      ) : (
        <div className="watched-leaderboard">
          {entries.map(({ movie, rank, watchCount }) => (
            <article key={movie.imdbId}>
              <span className="rank-number">{rank}</span>
              <Poster movie={movie} compact />
              <div><strong>{movie.title}</strong><span>{movie.year}</span><TmdbRating movie={movie} /></div>
              <b>{watchCount} {watchCount === 1 ? 'watcher' : 'watchers'}</b>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
