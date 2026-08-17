export function mergeShelfMovieIds(shelfMovieIds: string[], watchedMovieIds: string[]): string[] {
  return [...new Set([...shelfMovieIds, ...watchedMovieIds])].sort();
}
