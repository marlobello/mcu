import type { ReactNode } from 'react'
import type { Movie } from '../types'
import { Poster } from './Poster'
import { TmdbRating } from './TmdbRating'

/** Shared presentation for a full-size movie card; each view supplies its own action buttons. */
export function MovieCard({ movie, actions }: { movie: Movie; actions: ReactNode }) {
  return (
    <article className="movie-card">
      <Poster movie={movie} />
      <div className="movie-copy">
        <div className="movie-title">
          <div>
            <h2>{movie.title}</h2>
            <p>{movie.year} · {movie.rating}</p>
            <TmdbRating movie={movie} />
          </div>
          <span className="pill">{movie.studio}</span>
        </div>
        <p className="added-by">Added by {movie.addedByUsername}</p>
        <div className="card-actions">
          <div className="card-action-buttons">{actions}</div>
          <a href={movie.imdbUrl} target="_blank" rel="noreferrer">IMDb ↗</a>
        </div>
      </div>
    </article>
  )
}
