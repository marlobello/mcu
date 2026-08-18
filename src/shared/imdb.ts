const imdbIdPattern = /^tt\d{7,10}$/;

/** IMDb IDs are used directly as Table Storage row keys, so they are validated before every lookup. */
export function isImdbId(value: string | null | undefined): value is string {
  return Boolean(value && imdbIdPattern.test(value));
}
