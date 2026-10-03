const { query } = require('../config/database');
const { generateSlug } = require('../utils/helpers');

const Tag = {
  list: async () =>
    (await query(
      `SELECT t.*, COUNT(p.post_id) FILTER (WHERE p.status='published')::int AS post_count
       FROM tags t LEFT JOIN post_tags pt ON pt.tag_id=t.tag_id LEFT JOIN posts p ON p.post_id=pt.post_id
       GROUP BY t.tag_id ORDER BY t.name`)).rows,
  findById: async (id) => (await query('SELECT * FROM tags WHERE tag_id=$1', [id])).rows[0],
  create: async (d) =>
    (await query('INSERT INTO tags (name,slug,description) VALUES ($1,$2,$3) RETURNING *',
      [d.name, generateSlug(d.name), d.description || null])).rows[0],
  update: async (id, d) =>
    (await query(
      `UPDATE tags SET name=COALESCE($2,name), slug=COALESCE($3,slug), description=COALESCE($4,description)
       WHERE tag_id=$1 RETURNING *`,
      [id, d.name || null, d.name ? generateSlug(d.name) : null, d.description ?? null])).rows[0],
  remove: async (id) => (await query('DELETE FROM tags WHERE tag_id=$1', [id])).rowCount > 0,
  // Upserts tags by name inside a transaction client and returns their ids.
  upsertMany: async (client, names) => {
    const ids = [];
    for (const name of [...new Set(names.map((n) => n.trim()).filter(Boolean))]) {
      const { rows } = await client.query(
        `INSERT INTO tags (name, slug) VALUES ($1,$2)
         ON CONFLICT (slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING tag_id`,
        [name, generateSlug(name)]);
      ids.push(rows[0].tag_id);
    }
    return ids;
  },
};

module.exports = Tag;
