const h = require('../src/utils/helpers');

describe('helpers', () => {
  test('generateSlug', () => expect(h.generateSlug('Hello, World! (Intro)')).toBe('hello-world-intro'));
  test('paginate clamps values', () => {
    expect(h.paginate(0, 1000)).toEqual({ page: 1, limit: 100, offset: 0 });
    expect(h.paginate(3, 10)).toEqual({ page: 3, limit: 10, offset: 20 });
  });
  test('getPaginationMeta', () => {
    const m = h.getPaginationMeta(25, 2, 10);
    expect(m).toMatchObject({ totalPages: 3, hasNextPage: true, hasPrevPage: true });
  });
  test('calculateReadingTime ignores HTML and has a 1 minute minimum', () => {
    expect(h.calculateReadingTime('<p>short</p>')).toBe(1);
    expect(h.calculateReadingTime('word '.repeat(450))).toBe(3);
  });
  test('extractExcerpt strips tags and truncates', () => {
    expect(h.extractExcerpt('<p>' + 'a'.repeat(300) + '</p>', 10)).toBe('aaaaaaaaaa...');
  });
  test('generateUniqueSlug avoids collisions', async () => {
    const taken = new Set(['my-post']);
    const slug = await h.generateUniqueSlug('My Post', async (s) => taken.has(s));
    expect(slug).toMatch(/^my-post-[0-9a-f]{6}$/);
  });
  test('isValidEmail', () => {
    expect(h.isValidEmail('a@b.co')).toBe(true);
    expect(h.isValidEmail('nope')).toBe(false);
  });
});
