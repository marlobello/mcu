import { useMemo, useState } from 'react'
import type { Movie, RequestFn } from '../types'
import { AddMovieDialog } from './AddMovieDialog'
import { EmptyState } from './EmptyState'
import { MovieCard } from './MovieCard'

const scoreOptions = [60, 70, 75, 80, 85, 90]

export function MunchMovieShelf({ movies, watched, shelf, request, onCatalogChange, setWatched, setOnShelf }: {
  movies: Movie[]
  watched: Set<string>
  shelf: Set<string>
  request: RequestFn
  onCatalogChange: () => Promise<void>
  setWatched: (imdbId: string, watched: boolean) => Promise<void>
  setOnShelf: (imdbId: string, onShelf: boolean) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [rating, setRating] = useState('')
  const [minimumScore, setMinimumScore] = useState('')
  const [year, setYear] = useState('')
  const [adding, setAdding] = useState(false)

  const filtered = useMemo(() => movies.filter((movie) => {
    const text = `${movie.title} ${movie.studio}`.toLowerCase()
    return (!query || text.includes(query.toLowerCase()))
      && (!rating || movie.rating === rating)
      && (!minimumScore || Math.round(movie.tmdbScore * 10) >= Number(minimumScore))
      && (!year || movie.year.startsWith(year))
  }), [movies, query, rating, minimumScore, year])

  const ratings = useMemo(
    () => [...new Set(movies.map((movie) => movie.rating))].sort(),
    [movies],
  )

  return (
    <section>
      <div className="section-heading">
        <div><span className="eyebrow">Shared collection</span><h1>Munch movie shelf</h1><p>{movies.length} classics and counting.</p></div>
        <button className="primary-button" onClick={() => setAdding(true)}>Add a movie</button>
      </div>
      <div className="filters">
        <label><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title or studio" /></label>
        <label>
          <span>Rating</span>
          <select value={rating} onChange={(event) => setRating(event.target.value)}>
            <option value="">All ratings</option>
            {ratings.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <span>TMDB score</span>
          <select value={minimumScore} onChange={(event) => setMinimumScore(event.target.value)}>
            <option value="">Any score</option>
            {scoreOptions.map((value) => <option key={value} value={value}>{value}%+</option>)}
          </select>
        </label>
        <label><span>Year</span><input value={year} onChange={(event) => setYear(event.target.value)} inputMode="numeric" placeholder="e.g. 1985" /></label>
      </div>
      {filtered.length === 0 ? <EmptyState title="No movies found" detail="Adjust the filters or add the first matching classic." /> : (
        <div className="movie-grid">
          {filtered.map((movie) => {
            const isWatched = watched.has(movie.imdbId)
            const isOnShelf = shelf.has(movie.imdbId)
            return (
              <MovieCard
                key={movie.imdbId}
                movie={movie}
                actions={(
                  <>
                    <button className={isWatched ? 'watched' : ''} onClick={() => setWatched(movie.imdbId, !isWatched)}>
                      {isWatched ? '✓ Watched with the kids' : 'Mark as watched'}
                    </button>
                    <button
                      className={isOnShelf ? 'on-shelf' : ''}
                      disabled={isOnShelf}
                      onClick={() => setOnShelf(movie.imdbId, true)}
                    >
                      {isOnShelf ? '✓ On my shelf' : 'Add to my shelf'}
                    </button>
                  </>
                )}
              />
            )
          })}
        </div>
      )}
      {adding && <AddMovieDialog request={request} onAdded={onCatalogChange} close={() => setAdding(false)} />}
    </section>
  )
}
