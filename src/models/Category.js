const { query } = require('../config/database');
const { generateUniqueSlug } = require('../utils/helpers');

const Category = {
  list: async ({ includeInactive = false } = {}) =>
    (await query(
      `SELECT c.*, get_category_post_count(c.category_id) AS post_count
       FROM categories c ${includeInactive ? '' : 'WHERE c.is_active = true'}
       ORDER BY c.display_order, c.name`)).rows,
  findById: async (id) => (await query('SELECT * FROM categories WHERE category_id=$1', [id])).rows[0],
  findBySlug: async (slug) => (await query('SELECT * FROM categories WHERE slug=$1', [slug])).rows[0],
  create: async (d) => {
    const slug = await generateUniqueSlug(d.name, async (s) => (await query('SELECT 1 FROM categories WHERE slug=$1', [s])).rowCount > 0);
    return (await query(
      `INSERT INTO categories (name,slug,description,parent_id,display_order) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [d.name, slug, d.description || null, d.parent_id || null, d.display_order || 0])).rows[0];
  },
  update: async (id, d) => {
    const allowed = ['name', 'description', 'parent_id', 'display_order', 'is_active'];
    const keys = Object.keys(d).filter((k) => allowed.includes(k) && d[k] !== undefined);
    if (!keys.length) return Category.findById(id);
    const sets = keys.map((k, i) => `${k}=$${i + 2}`).join(', ');
    return (await query(`UPDATE categories SET ${sets} WHERE category_id=$1 RETURNING *`, [id, ...keys.map((k) => d[k])])).rows[0];
  },
  remove: async (id) => (await query('DELETE FROM categories WHERE category_id=$1', [id])).rowCount > 0,
};

module.exports = Category;
