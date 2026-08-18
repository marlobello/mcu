const voteCountFormatter = new Intl.NumberFormat('en-US')

export function TmdbRating({ movie }: { movie: { tmdbScore: number; tmdbVoteCount: number } }) {
  return (
    <span className="tmdb-rating">
      {movie.tmdbVoteCount > 0
        ? `${Math.round(movie.tmdbScore * 10)}% TMDB · ${voteCountFormatter.format(movie.tmdbVoteCount)} votes`
        : 'TMDB rating unavailable'}
    </span>
  )
}
