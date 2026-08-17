import type { AggregateRanking, UserRanking } from './types.js';

export function aggregateRankings(rankings: UserRanking[]): AggregateRanking[] {
  const scores = new Map<string, number[]>();

  for (const ranking of rankings) {
    const count = ranking.orderedMovieIds.length;
    ranking.orderedMovieIds.forEach((imdbId, index) => {
      const normalized = count <= 1 ? 1 : 1 - index / (count - 1);
      const values = scores.get(imdbId) ?? [];
      values.push(normalized);
      scores.set(imdbId, values);
    });
  }

  return [...scores.entries()]
    .map(([imdbId, values]) => ({
      imdbId,
      score: Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 1000) / 10,
      rankCount: values.length,
    }))
    .sort((a, b) => b.score - a.score || b.rankCount - a.rankCount || a.imdbId.localeCompare(b.imdbId));
}
