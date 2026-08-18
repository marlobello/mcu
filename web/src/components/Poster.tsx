export function Poster({ movie, compact = false }: {
  movie: { title: string; posterUrl: string | null }
  compact?: boolean
}) {
  return movie.posterUrl
    ? <img className={compact ? 'poster compact' : 'poster'} src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" />
    : <div className={compact ? 'poster compact placeholder' : 'poster placeholder'} aria-label={`No poster for ${movie.title}`}>MCU</div>
}
