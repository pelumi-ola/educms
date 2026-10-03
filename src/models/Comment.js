const { query } = require('../config/database');

const Comment = {
  forPost: async (postId) =>
    (await query(
      `SELECT c.comment_id, c.parent_id, c.content, c.created_at, c.user_id, u.username
       FROM comments c LEFT JOIN users u ON u.user_id=c.user_id
       WHERE c.post_id=$1 AND c.status='approved' ORDER BY c.created_at ASC`, [postId])).rows,
  findById: async (id) => (await query('SELECT * FROM comments WHERE comment_id=$1', [id])).rows[0],
  create: async (d) =>
    (await query(
      `INSERT INTO comments (post_id,user_id,parent_id,content,status,ip_address,user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.post_id, d.user_id, d.parent_id || null, d.content, d.status, d.ip, d.user_agent])).rows[0],
  list: async ({ status, post_id }, { limit, offset }) => {
    const where = []; const params = [];
    if (status) { params.push(status); where.push(`c.status=$${params.length}`); }
    if (post_id) { params.push(post_id); where.push(`c.post_id=$${params.length}`); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = parseInt((await query(`SELECT COUNT(*) FROM comments c ${w}`, params)).rows[0].count, 10);
    const rows = (await query(
      `SELECT c.*, u.username, p.title AS post_title FROM comments c
       LEFT JOIN users u ON u.user_id=c.user_id LEFT JOIN posts p ON p.post_id=c.post_id
       ${w} ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset])).rows;
    return { rows, total };
  },
  setStatus: async (id, status) =>
    (await query('UPDATE comments SET status=$2 WHERE comment_id=$1 RETURNING *', [id, status])).rows[0],
  remove: async (id) => (await query('DELETE FROM comments WHERE comment_id=$1', [id])).rowCount > 0,
};

module.exports = Comment;
