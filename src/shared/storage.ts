import { TableClient, TableServiceClient, odata } from '@azure/data-tables';
import { DefaultAzureCredential, ManagedIdentityCredential, type TokenCredential } from '@azure/identity';
import { mergeShelfMovieIds } from './movieShelf.js';
import type { Movie, SessionUser, WatchedEntry } from './types.js';

const tableNames = {
  movies: 'Movies',
  users: 'Users',
  watched: 'Watched',
  shelf: 'Shelf',
  exchangeCodes: 'ExchangeCodes',
};

let initialization: Promise<void> | undefined;
let cachedCredential: TokenCredential | undefined;
const tableClients = new Map<string, TableClient>();

// A single credential instance keeps the SDK's in-memory AAD token cache warm across requests.
function credential(): TokenCredential {
  if (!cachedCredential) {
    const clientId = process.env.AZURE_CLIENT_ID;
    cachedCredential = clientId ? new ManagedIdentityCredential(clientId) : new DefaultAzureCredential();
  }
  return cachedCredential;
}

function tableEndpoint(): string {
  const endpoint = process.env.STORAGE_TABLE_ENDPOINT;
  if (!endpoint) throw new Error('STORAGE_TABLE_ENDPOINT is required');
  return endpoint;
}

function serviceClient(): TableServiceClient {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connectionString) return TableServiceClient.fromConnectionString(connectionString);
  return new TableServiceClient(tableEndpoint(), credential());
}

function tableClient(name: string): TableClient {
  const existing = tableClients.get(name);
  if (existing) return existing;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const client = connectionString
    ? TableClient.fromConnectionString(connectionString, name)
    : new TableClient(tableEndpoint(), name, credential());
  tableClients.set(name, client);
  return client;
}

async function ensureTables(): Promise<void> {
  // A failed run must not be cached, otherwise a single transient error would
  // permanently break every later request handled by this instance.
  initialization ??= (async () => {
    const service = serviceClient();
    for (const name of Object.values(tableNames)) {
      try {
        await service.createTable(name);
      } catch (error) {
        if (!isAlreadyExists(error)) throw error;
      }
    }
  })().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

export async function saveUser(user: SessionUser): Promise<void> {
  await ensureTables();
  await tableClient(tableNames.users).upsertEntity({
    partitionKey: 'user',
    rowKey: user.userId,
    username: user.username,
    avatar: user.avatar ?? '',
    updatedAt: new Date().toISOString(),
  }, 'Replace');
}

/**
 * Records a one-time OAuth exchange code. The atomic create makes redemption single-use:
 * a replayed code loses the race and returns false.
 */
export async function claimExchangeCode(codeId: string): Promise<boolean> {
  await ensureTables();
  try {
    await tableClient(tableNames.exchangeCodes).createEntity({
      partitionKey: 'exchange',
      rowKey: codeId,
      redeemedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    if (isConflict(error)) return false;
    throw error;
  }
}
export async function getMovie(imdbId: string): Promise<Movie | null> {
  await ensureTables();
  try {
    const entity = await tableClient(tableNames.movies).getEntity<Record<string, unknown>>('movie', imdbId);
    return movieFromEntity(entity);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function listMovies(): Promise<Movie[]> {
  await ensureTables();
  const movies: Movie[] = [];
  for await (const entity of tableClient(tableNames.movies).listEntities<Record<string, unknown>>()) {
    movies.push(movieFromEntity(entity));
  }
  return movies.sort((a, b) => a.title.localeCompare(b.title));
}

/** Projects only the row key so catalog membership checks avoid transferring full movie rows. */
export async function listMovieIds(): Promise<Set<string>> {
  await ensureTables();
  const ids = new Set<string>();
  for await (const entity of tableClient(tableNames.movies).listEntities({
    queryOptions: { select: ['RowKey'] },
  })) {
    if (entity.rowKey) ids.add(entity.rowKey);
  }
  return ids;
}

export async function createMovie(movie: Movie): Promise<void> {
  await ensureTables();
  await tableClient(tableNames.movies).createEntity(movieEntity(movie));
}

export async function replaceMovie(movie: Movie): Promise<void> {
  await ensureTables();
  await tableClient(tableNames.movies).upsertEntity(movieEntity(movie), 'Replace');
}

export async function setWatched(userId: string, imdbId: string, watched: boolean): Promise<void> {
  await ensureTables();
  const client = tableClient(tableNames.watched);
  if (watched) {
    await setShelf(userId, imdbId, true);
    await client.upsertEntity({
      partitionKey: userId,
      rowKey: imdbId,
      watchedAt: new Date().toISOString(),
    }, 'Replace');
    return;
  }
  try {
    await client.getEntity(userId, imdbId);
    await setShelf(userId, imdbId, true);
    await client.deleteEntity(userId, imdbId);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

export async function setShelf(userId: string, imdbId: string, onShelf: boolean): Promise<void> {
  await ensureTables();
  const client = tableClient(tableNames.shelf);
  if (onShelf) {
    await client.upsertEntity({
      partitionKey: userId,
      rowKey: imdbId,
      addedAt: new Date().toISOString(),
    }, 'Replace');
    return;
  }
  try {
    await client.deleteEntity(userId, imdbId);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

export async function listWatched(userId: string): Promise<string[]> {
  await ensureTables();
  const watched: string[] = [];
  for await (const entity of tableClient(tableNames.watched).listEntities({
    queryOptions: { filter: odata`PartitionKey eq ${userId}` },
  })) {
    if (entity.rowKey) watched.push(entity.rowKey);
  }
  return watched;
}

export async function listShelf(userId: string): Promise<string[]> {
  await ensureTables();
  const shelf: string[] = [];
  for await (const entity of tableClient(tableNames.shelf).listEntities({
    queryOptions: { filter: odata`PartitionKey eq ${userId}` },
  })) {
    if (entity.rowKey) shelf.push(entity.rowKey);
  }
  return mergeShelfMovieIds(shelf, await listWatched(userId));
}

export async function listAllWatched(): Promise<WatchedEntry[]> {
  await ensureTables();
  const watched: WatchedEntry[] = [];
  for await (const entity of tableClient(tableNames.watched).listEntities()) {
    if (entity.partitionKey && entity.rowKey) {
      watched.push({ userId: entity.partitionKey, imdbId: entity.rowKey });
    }
  }
  return watched;
}

function movieEntity({ imdbId, posterUrl, ...movie }: Movie) {
  // imdbId is the row key, so it is not repeated as a column.
  return { partitionKey: 'movie', rowKey: imdbId, ...movie, posterUrl: posterUrl ?? '' };
}

function movieFromEntity(entity: Record<string, unknown> & { rowKey?: string }): Movie {
  if (!entity.rowKey) throw new Error('Movie entity is missing its row key');
  return {
    imdbId: entity.rowKey,
    title: text(entity.title, 'Untitled'),
    year: text(entity.year, 'Unknown'),
    rating: text(entity.rating, 'Unrated'),
    tmdbScore: Number(entity.tmdbScore) || 0,
    tmdbVoteCount: Number(entity.tmdbVoteCount) || 0,
    studio: text(entity.studio, 'Unknown'),
    posterUrl: entity.posterUrl ? String(entity.posterUrl) : null,
    imdbUrl: text(entity.imdbUrl, `https://www.imdb.com/title/${entity.rowKey}/`),
    addedByUserId: text(entity.addedByUserId, ''),
    addedByUsername: text(entity.addedByUsername, 'Unknown'),
    createdAt: text(entity.createdAt, ''),
  };
}

function text(value: unknown, fallback: string): string {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

function statusCode(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    ? (error as { statusCode?: number }).statusCode
    : undefined;
}

function isNotFound(error: unknown): boolean {
  return statusCode(error) === 404;
}

export function isConflict(error: unknown): boolean {
  return statusCode(error) === 409;
}

function isAlreadyExists(error: unknown): boolean {
  return isConflict(error) || (error instanceof Error && error.message.includes('TableAlreadyExists'));
}
