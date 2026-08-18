import { useMemo } from 'react'
import type { Movie } from '../types'
import { EmptyState } from './EmptyState'
import { MovieCard } from './MovieCard'

export function MyMovieShelf({ movies, watched, shelf, setWatched, setOnShelf }: {
  movies: Movie[]
  watched: Set<string>
  shelf: Set<string>
  setWatched: (imdbId: string, watched: boolean) => Promise<void>
  setOnShelf: (imdbId: string, onShelf: boolean) => Promise<void>
}) {
  const shelfMovies = useMemo(
    () => movies.filter((movie) => shelf.has(movie.imdbId)).sort((a, b) => a.title.localeCompare(b.title)),
    [movies, shelf],
  )

  return (
    <section>
      <div className="section-heading">
        <div><span className="eyebrow">Your watch list</span><h1>My movie shelf</h1><p>{shelfMovies.length} movies saved to watch or already watched.</p></div>
      </div>
      {shelfMovies.length === 0 ? (
        <EmptyState title="Your movie shelf is empty" detail="Add movies from the Munch movie shelf to build your watch list." />
      ) : (
        <div className="movie-grid">
          {shelfMovies.map((movie) => (
            <MovieCard
              key={movie.imdbId}
              movie={movie}
              actions={watched.has(movie.imdbId) ? (
                <button className="watched" disabled>✓ Watched with the kids</button>
              ) : (
                <>
                  <button onClick={() => setWatched(movie.imdbId, true)}>Mark as watched</button>
                  <button onClick={() => setOnShelf(movie.imdbId, false)}>Remove from my shelf</button>
                </>
              )}
            />
          ))}
        </div>
      )}
    </section>
  )
}
