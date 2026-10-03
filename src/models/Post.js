const { query, transaction } = require('../config/database');
const { generateUniqueSlug, calculateReadingTime, extractExcerpt } = require('../utils/helpers');
const Tag = require('./Tag');

const SELECT = `
  SELECT p.post_id, p.title, p.slug, p.excerpt, p.status, p.featured_image, p.view_count, p.like_count,
    p.created_at, p.updated_at, p.published_at, p.is_featured, p.allow_comments, p.reading_time,
    p.author_id, p.category_id, p.meta_title, p.meta_description, p.meta_keywords
    %CONTENT%,
    u.username AS author, c.name AS category_name, c.slug AS category_slug,
    COALESCE((SELECT json_agg(json_build_object('tag_id',t.tag_id,'name',t.name,'slug',t.slug))
              FROM post_tags pt JOIN tags t ON t.tag_id=pt.tag_id WHERE pt.post_id=p.post_id),'[]') AS tags
  FROM posts p
  LEFT JOIN users u ON u.user_id=p.author_id
  LEFT JOIN categories c ON c.category_id=p.category_id`;

const SORTS = { published_at: 'p.published_at', created_at: 'p.created_at', updated_at: 'p.updated_at',
  view_count: 'p.view_count', like_count: 'p.like_count', title: 'p.title' };

const buildWhere = (f, viewer) => {
  const where = []; const params = [];
  const add = (sql, val) => { params.push(val); where.push(sql.replace('?', `$${params.length}`)); };

  // Visibility: anonymous/subscribers see published only; authors also see their own; staff see all.
  const role = viewer?.role;
  if (role === 'admin' || role === 'editor') { if (f.status) add('p.status = ?', f.status); }
  else if (role === 'author') {
    params.push(viewer.user_id);
    where.push(`(p.status='published' OR p.author_id=$${params.length})`);
    if (f.status) add('p.status = ?', f.status);
  } else where.push("p.status='published'");

  if (f.category) {
    /^\d+$/.test(f.category)
      ? add('p.category_id = ?', Number(f.category))
      : add('p.category_id = (SELECT category_id FROM categories WHERE slug = ?)', f.category);
  }
  if (f.tag) add('EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.tag_id=pt.tag_id WHERE pt.post_id=p.post_id AND t.slug = ?)', f.tag);
  if (f.author) {
    /^\d+$/.test(f.author)
      ? add('p.author_id = ?', Number(f.author))
      : add('p.author_id = (SELECT user_id FROM users WHERE username = ?)', f.author);
  }
  if (f.featured === 'true') where.push('p.is_featured = true');
  if (f.q) {
    params.push(f.q);
    const a = params.length; params.push(`%${f.q}%`);
    where.push(`(to_tsvector('english', p.title || ' ' || coalesce(p.excerpt,'') || ' ' || p.content) @@ plainto_tsquery('english', $${a}) OR p.title ILIKE $${params.length})`);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

const setTags = async (client, postId, names) => {
  await client.query('DELETE FROM post_tags WHERE post_id=$1', [postId]);
  const ids = await Tag.upsertMany(client, names);
  for (const tagId of ids) {
    await client.query('INSERT INTO post_tags (post_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [postId, tagId]);
  }
};

const snapshot = async (client, post, userId, note) => {
  await client.query(
    `INSERT INTO post_versions (post_id, version_number, title, content, excerpt, edited_by, change_note)
     VALUES ($1, (SELECT COALESCE(MAX(version_number),0)+1 FROM post_versions WHERE post_id=$1), $2,$3,$4,$5,$6)`,
    [post.post_id, post.title, post.content, post.excerpt, userId, note || null]);
};

const Post = {
  list: async (filters, viewer, { limit, offset }) => {
    const { sql, params } = buildWhere(filters, viewer);
    const total = parseInt((await query(`SELECT COUNT(*) FROM posts p ${sql}`, params)).rows[0].count, 10);
    const col = SORTS[filters.sort] || SORTS.published_at;
    const dir = String(filters.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const rows = (await query(
      `${SELECT.replace('%CONTENT%', '')} ${sql} ORDER BY ${col} ${dir} NULLS LAST, p.post_id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset])).rows;
    return { rows, total };
  },

  find: async (idOrSlug) => {
    const isId = /^\d+$/.test(String(idOrSlug));
    return (await query(
      `${SELECT.replace('%CONTENT%', ', p.content')} WHERE ${isId ? 'p.post_id' : 'p.slug'} = $1`,
      [isId ? Number(idOrSlug) : idOrSlug])).rows[0];
  },

  create: async (d, authorId) => {
    const id = await transaction(async (client) => {
      const slug = await generateUniqueSlug(d.title, async (s) =>
        (await client.query('SELECT 1 FROM posts WHERE slug=$1', [s])).rowCount > 0);
      const status = d.status || 'draft';
      const excerpt = d.excerpt || extractExcerpt(d.content);
      const { rows } = await client.query(
        `INSERT INTO posts (title,slug,content,excerpt,author_id,category_id,status,featured_image,
           published_at,meta_title,meta_description,meta_keywords,is_featured,allow_comments,reading_time)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [d.title, slug, d.content, excerpt, authorId, d.category_id || null, status, d.featured_image || null,
          status === 'published' ? new Date() : null, d.meta_title || null, d.meta_description || null,
          d.meta_keywords || null, !!d.is_featured, d.allow_comments !== false, calculateReadingTime(d.content)]);
      const post = rows[0];
      if (Array.isArray(d.tags)) await setTags(client, post.post_id, d.tags);
      await snapshot(client, post, authorId, 'Initial version');
      return post.post_id;
    });
    return Post.find(id);
  },

  update: async (id, d, userId, note) => {
    const updated = await transaction(async (client) => {
      const cur = (await client.query('SELECT * FROM posts WHERE post_id=$1 FOR UPDATE', [id])).rows[0];
      if (!cur) return null;
      const allowed = ['title', 'content', 'excerpt', 'category_id', 'status', 'featured_image', 'meta_title',
        'meta_description', 'meta_keywords', 'is_featured', 'allow_comments'];
      const fields = {};
      allowed.forEach((k) => { if (d[k] !== undefined) fields[k] = d[k]; });
      if (fields.content !== undefined) fields.reading_time = calculateReadingTime(fields.content);
      if (fields.content !== undefined && d.excerpt === undefined && !cur.excerpt) fields.excerpt = extractExcerpt(fields.content);
      if (fields.status === 'published' && !cur.published_at) fields.published_at = new Date();

      const keys = Object.keys(fields);
      let post = cur;
      if (keys.length) {
        const sets = keys.map((k, i) => `${k}=$${i + 2}`).join(', ');
        post = (await client.query(`UPDATE posts SET ${sets} WHERE post_id=$1 RETURNING *`,
          [id, ...keys.map((k) => fields[k])])).rows[0];
      }
      if (Array.isArray(d.tags)) await setTags(client, id, d.tags);
      if (['title', 'content', 'excerpt'].some((k) => fields[k] !== undefined && fields[k] !== cur[k])) {
        await snapshot(client, post, userId, note);
      }
      return post;
    });
    return updated ? Post.find(id) : null;
  },

  remove: async (id) => (await query('DELETE FROM posts WHERE post_id=$1', [id])).rowCount > 0,
  incrementViews: (id) => query('UPDATE posts SET view_count=view_count+1 WHERE post_id=$1', [id]),
  like: async (id) =>
    (await query('UPDATE posts SET like_count=like_count+1 WHERE post_id=$1 RETURNING like_count', [id])).rows[0],

  versions: async (id) =>
    (await query(
      `SELECT v.version_id, v.version_number, v.title, v.change_note, v.created_at, u.username AS edited_by
       FROM post_versions v LEFT JOIN users u ON u.user_id=v.edited_by
       WHERE v.post_id=$1 ORDER BY v.version_number DESC`, [id])).rows,
  version: async (postId, versionId) =>
    (await query('SELECT * FROM post_versions WHERE post_id=$1 AND version_id=$2', [postId, versionId])).rows[0],
};

module.exports = Post;
