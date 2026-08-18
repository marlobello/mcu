import { beforeEach, describe, expect, it, vi } from 'vitest';

const createTable = vi.fn();
const tableClientInstances: string[] = [];

vi.mock('@azure/data-tables', () => ({
  odata: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.raw.map((part, index) => part + (index < values.length ? String(values[index]) : '')).join(''),
  TableServiceClient: class {
    createTable = createTable;
  },
  TableClient: class {
    constructor(_endpoint: string, name: string) {
      tableClientInstances.push(name);
    }

    listEntities() {
      return { async *[Symbol.asyncIterator]() {} };
    }
  },
}));

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: class {},
  ManagedIdentityCredential: class {},
}));

async function loadStorage() {
  vi.resetModules();
  return import('./storage.js');
}

beforeEach(() => {
  process.env.STORAGE_TABLE_ENDPOINT = 'https://example.table.core.windows.net';
  delete process.env.AZURE_STORAGE_CONNECTION_STRING;
  createTable.mockReset();
  tableClientInstances.length = 0;
});

describe('table initialization', () => {
  it('does not cache a failed initialization', async () => {
    const storage = await loadStorage();
    createTable.mockRejectedValueOnce(new Error('transient failure'));

    await expect(storage.listMovieIds()).rejects.toThrow('transient failure');

    // A poisoned cache would make every later call fail for the life of the process.
    createTable.mockResolvedValue(undefined);
    await expect(storage.listMovieIds()).resolves.toBeInstanceOf(Set);
  });

  it('creates each table only once across calls', async () => {
    const storage = await loadStorage();
    createTable.mockResolvedValue(undefined);

    await storage.listMovieIds();
    const callsAfterFirst = createTable.mock.calls.length;
    await storage.listMovieIds();

    expect(createTable.mock.calls.length).toBe(callsAfterFirst);
  });

  it('tolerates tables that already exist', async () => {
    const storage = await loadStorage();
    createTable.mockRejectedValue(Object.assign(new Error('conflict'), { statusCode: 409 }));

    await expect(storage.listMovieIds()).resolves.toBeInstanceOf(Set);
  });
});

describe('table clients', () => {
  it('reuses one client per table so credential tokens stay cached', async () => {
    const storage = await loadStorage();
    createTable.mockResolvedValue(undefined);

    await storage.listMovieIds();
    await storage.listMovieIds();
    await storage.listAllWatched();

    expect(tableClientInstances.filter((name) => name === 'Movies')).toHaveLength(1);
    expect(tableClientInstances.filter((name) => name === 'Watched')).toHaveLength(1);
  });
});
