const { query } = require('../config/database');

const Media = {
  create: async (d) =>
    (await query(
      `INSERT INTO media (filename,original_name,file_path,file_type,file_size,mime_type,uploaded_by,alt_text,caption)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [d.filename, d.original_name, d.file_path, d.file_type, d.file_size, d.mime_type, d.uploaded_by,
        d.alt_text || null, d.caption || null])).rows[0],
  findById: async (id) => (await query('SELECT * FROM media WHERE media_id=$1', [id])).rows[0],
  list: async ({ type, uploaded_by }, { limit, offset }) => {
    const where = []; const params = [];
    if (type) { params.push(type); where.push(`file_type=$${params.length}`); }
    if (uploaded_by) { params.push(uploaded_by); where.push(`uploaded_by=$${params.length}`); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = parseInt((await query(`SELECT COUNT(*) FROM media ${w}`, params)).rows[0].count, 10);
    const rows = (await query(
      `SELECT * FROM media ${w} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset])).rows;
    return { rows, total };
  },
  update: async (id, d) =>
    (await query('UPDATE media SET alt_text=COALESCE($2,alt_text), caption=COALESCE($3,caption) WHERE media_id=$1 RETURNING *',
      [id, d.alt_text ?? null, d.caption ?? null])).rows[0],
  remove: async (id) => (await query('DELETE FROM media WHERE media_id=$1', [id])).rowCount > 0,
};

module.exports = Media;
