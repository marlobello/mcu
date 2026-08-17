import { TableClient, TableServiceClient, odata } from '@azure/data-tables';
import { DefaultAzureCredential, ManagedIdentityCredential } from '@azure/identity';
import type { Movie, SessionUser, UserRanking } from './types.js';

const tableNames = {
  movies: 'Movies',
  users: 'Users',
  rankings: 'Rankings',
  watched: 'Watched',
};

let initialization: Promise<void> | undefined;

function credential() {
  const clientId = process.env.AZURE_CLIENT_ID;
  return clientId ? new ManagedIdentityCredential(clientId) : new DefaultAzureCredential();
}

function serviceClient(): TableServiceClient {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connectionString) return TableServiceClient.fromConnectionString(connectionString);

  const endpoint = process.env.STORAGE_TABLE_ENDPOINT;
  if (!endpoint) throw new Error('STORAGE_TABLE_ENDPOINT is required');
  return new TableServiceClient(endpoint, credential());
}

function tableClient(name: string): TableClient {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connectionString) return TableClient.fromConnectionString(connectionString, name);

  const endpoint = process.env.STORAGE_TABLE_ENDPOINT;
  if (!endpoint) throw new Error('STORAGE_TABLE_ENDPOINT is required');
  return new TableClient(endpoint, name, credential());
}

async function ensureTables(): Promise<void> {
  initialization ??= (async () => {
    const service = serviceClient();
    for (const name of Object.values(tableNames)) {
      try {
        await service.createTable(name);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('TableAlreadyExists')) throw error;
      }
    }
  })();
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

export async function createMovie(movie: Movie): Promise<void> {
  await ensureTables();
  await tableClient(tableNames.movies).createEntity({
    partitionKey: 'movie',
    rowKey: movie.imdbId,
    ...movie,
    posterUrl: movie.posterUrl ?? '',
  });
}

export async function replaceMovie(movie: Movie): Promise<void> {
  await ensureTables();
  await tableClient(tableNames.movies).upsertEntity({
    partitionKey: 'movie',
    rowKey: movie.imdbId,
    ...movie,
    posterUrl: movie.posterUrl ?? '',
  }, 'Replace');
}

export async function replaceRanking(user: SessionUser, orderedMovieIds: string[]): Promise<void> {
  await ensureTables();
  const client = tableClient(tableNames.rankings);
  const existing: string[] = [];
  for await (const entity of client.listEntities({
    queryOptions: { filter: odata`PartitionKey eq ${user.userId}` },
  })) {
    if (entity.rowKey) existing.push(entity.rowKey);
  }

  for (let index = 0; index < orderedMovieIds.length; index += 1) {
    await client.upsertEntity({
      partitionKey: user.userId,
      rowKey: orderedMovieIds[index],
      position: index + 1,
      username: user.username,
      updatedAt: new Date().toISOString(),
    }, 'Replace');
  }

  const retained = new Set(orderedMovieIds);
  for (const movieId of existing) {
    if (!retained.has(movieId)) await client.deleteEntity(user.userId, movieId);
  }
}

export async function listRankings(): Promise<UserRanking[]> {
  await ensureTables();
  const grouped = new Map<string, Array<{ movieId: string; position: number; username: string }>>();
  for await (const entity of tableClient(tableNames.rankings).listEntities<Record<string, unknown>>()) {
    if (!entity.partitionKey || !entity.rowKey) continue;
    const entries = grouped.get(entity.partitionKey) ?? [];
    entries.push({
      movieId: entity.rowKey,
      position: Number(entity.position),
      username: String(entity.username ?? 'Unknown user'),
    });
    grouped.set(entity.partitionKey, entries);
  }

  return [...grouped.entries()].map(([userId, entries]) => ({
    userId,
    username: entries[0]?.username ?? 'Unknown user',
    orderedMovieIds: entries.sort((a, b) => a.position - b.position).map((entry) => entry.movieId),
  }));
}

export async function setWatched(userId: string, imdbId: string, watched: boolean): Promise<void> {
  await ensureTables();
  const client = tableClient(tableNames.watched);
  if (watched) {
    await client.upsertEntity({
      partitionKey: userId,
      rowKey: imdbId,
      watchedAt: new Date().toISOString(),
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

function movieFromEntity(entity: Record<string, unknown> & { rowKey?: string }): Movie {
  if (!entity.rowKey) throw new Error('Movie entity is missing its row key');
  return {
    imdbId: entity.rowKey,
    title: String(entity.title),
    year: String(entity.year),
    rating: String(entity.rating),
    studio: String(entity.studio),
    posterUrl: entity.posterUrl ? String(entity.posterUrl) : null,
    imdbUrl: String(entity.imdbUrl),
    addedByUserId: String(entity.addedByUserId),
    addedByUsername: String(entity.addedByUsername),
    createdAt: String(entity.createdAt),
  };
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    && (error as { statusCode?: number }).statusCode === 404;
}
