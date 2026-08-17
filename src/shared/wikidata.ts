import type { Movie } from './types.js';

interface Claim {
  mainsnak?: {
    datavalue?: {
      value?: unknown;
    };
  };
}

interface Entity {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, Claim[]>;
}

export interface WikidataMovieSuggestion {
  wikidataId: string;
  imdbId: string;
  title: string;
  year: string;
  posterUrl: string | null;
}

const endpoint = 'https://www.wikidata.org/w/api.php';
const headers = { 'User-Agent': 'MunchClassicsUniverse/1.0 (https://github.com/marlobello/mcu)' };

export async function searchWikidataMovies(query: string): Promise<WikidataMovieSuggestion[]> {
  const searchUrl = new URL(endpoint);
  searchUrl.search = new URLSearchParams({
    action: 'wbsearchentities',
    search: query,
    language: 'en',
    uselang: 'en',
    type: 'item',
    limit: '15',
    format: 'json',
    origin: '*',
  }).toString();
  const searchResponse = await fetch(searchUrl, { headers });
  if (!searchResponse.ok) throw new Error(`Wikidata search failed with ${searchResponse.status}`);
  const searchData = await searchResponse.json() as {
    search?: Array<{ id: string; description?: string }>;
  };
  const candidates = (searchData.search ?? [])
    .filter((item) => item.description?.toLowerCase().includes('film'))
    .map((item) => item.id);
  if (candidates.length === 0) return [];

  const entities = await getEntities(candidates);
  return entities
    .map(suggestionFromEntity)
    .filter((movie): movie is WikidataMovieSuggestion => movie !== null);
}

export async function getWikidataMovie(
  wikidataId: string,
  addedByUserId: string,
  addedByUsername: string,
): Promise<Movie | null> {
  if (!/^Q\d+$/.test(wikidataId)) return null;
  const [entity] = await getEntities([wikidataId]);
  if (!entity) return null;

  const suggestion = suggestionFromEntity(entity);
  if (!suggestion) return null;
  const studioIds = entityIds(entity, 'P272');
  const ratingIds = entityIds(entity, 'P1657');
  const labels = await getLabels([...studioIds, ...ratingIds]);

  return {
    imdbId: suggestion.imdbId,
    title: suggestion.title,
    year: suggestion.year,
    rating: ratingIds.map((id) => labels.get(id)).filter(Boolean).join(', ') || 'Unrated',
    studio: studioIds.map((id) => labels.get(id)).filter(Boolean).join(', ') || 'Unknown',
    posterUrl: suggestion.posterUrl,
    imdbUrl: `https://www.imdb.com/title/${suggestion.imdbId}/`,
    addedByUserId,
    addedByUsername,
    createdAt: new Date().toISOString(),
  };
}

async function getEntities(ids: string[]): Promise<Entity[]> {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    action: 'wbgetentities',
    ids: ids.join('|'),
    languages: 'en',
    props: 'labels|descriptions|claims',
    format: 'json',
    origin: '*',
  }).toString();
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Wikidata entity lookup failed with ${response.status}`);
  const data = await response.json() as { entities?: Record<string, Entity> };
  return ids.map((id) => data.entities?.[id]).filter((entity): entity is Entity => Boolean(entity));
}

async function getLabels(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const entities = await getEntities([...new Set(ids)]);
  return new Map(entities.map((entity) => [entity.id, entity.labels?.en?.value ?? entity.id]));
}

function suggestionFromEntity(entity: Entity): WikidataMovieSuggestion | null {
  const imdbId = stringValue(entity, 'P345');
  if (!imdbId || !/^tt\d{7,10}$/.test(imdbId)) return null;
  const title = entity.labels?.en?.value;
  if (!title) return null;
  const date = stringValue(entity, 'P577');
  const image = stringValue(entity, 'P18');
  return {
    wikidataId: entity.id,
    imdbId,
    title,
    year: date ? date.slice(1, 5) : 'Unknown',
    posterUrl: image
      ? `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(image)}?width=500`
      : null,
  };
}

function stringValue(entity: Entity, property: string): string | null {
  const value = entity.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'time' in value) {
    return String((value as { time: string }).time);
  }
  return null;
}

function entityIds(entity: Entity, property: string): string[] {
  return (entity.claims?.[property] ?? []).flatMap((claim) => {
    const value = claim.mainsnak?.datavalue?.value;
    return typeof value === 'object' && value !== null && 'id' in value
      ? [String((value as { id: string }).id)]
      : [];
  });
}
