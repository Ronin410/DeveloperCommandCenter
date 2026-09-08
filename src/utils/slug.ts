/**
 * Turns a display name into a URL/id-safe slug: lowercase, ASCII, hyphenated.
 * Used when a user adds a service through the UI and only types a name.
 */
export function slugify(input: string): string {
  const base = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return base || 'service';
}

/**
 * Appends `-2`, `-3`, ... until the slug is not in `taken`. Keeps user-facing
 * slugs short and predictable instead of falling back to a random suffix.
 */
export function uniqueSlug(base: string, taken: ReadonlySet<string> | string[]): string {
  const takenSet = taken instanceof Set ? taken : new Set(taken);
  if (!takenSet.has(base)) return base;

  let attempt = 2;
  while (takenSet.has(`${base}-${attempt}`)) attempt += 1;
  return `${base}-${attempt}`;
}
