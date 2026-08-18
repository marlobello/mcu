import { useMemo } from 'react'
import type { Movie } from '../types'
import { EmptyState } from './EmptyState'
import { Poster } from './Poster'
import { TmdbRating } from './TmdbRating'

export function MyWatchedMovies({ movies, watched, setWatched }: {
  movies: Movie[]
  watched: Set<string>
  setWatched: (imdbId: string, watched: boolean) => Promise<void>
}) {
  const watchedMovies = useMemo(
    () => movies.filter((movie) => watched.has(movie.imdbId)).sort((a, b) => a.title.localeCompare(b.title)),
    [movies, watched],
  )

  return (
    <section>
      <div className="section-heading">
        <div><span className="eyebrow">Your family movie history</span><h1>My Watched Movies</h1><p>{watchedMovies.length} movies marked as watched with the kids.</p></div>
      </div>
      {watchedMovies.length === 0 ? (
        <EmptyState title="No watched movies yet" detail="Mark movies as watched from the movie shelf to build this list." />
      ) : (
        <div className="watched-list">
          {watchedMovies.map((movie) => (
            <article key={movie.imdbId}>
              <Poster movie={movie} compact />
              <div><strong>{movie.title}</strong><span>{movie.year} · {movie.rating}</span><TmdbRating movie={movie} /></div>
              <button onClick={() => setWatched(movie.imdbId, false)} aria-label={`Mark ${movie.title} unwatched`}>Unwatch</button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
