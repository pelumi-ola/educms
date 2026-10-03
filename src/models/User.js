const { query } = require('../config/database');

const PUBLIC = `user_id, username, email, first_name, last_name, role, bio, avatar,
  created_at, updated_at, last_login, is_active, email_verified`;

const User = {
  PUBLIC,
  findById: async (id) => (await query('SELECT * FROM users WHERE user_id=$1', [id])).rows[0],
  findByLogin: async (login) =>
    (await query('SELECT * FROM users WHERE LOWER(email)=LOWER($1) OR LOWER(username)=LOWER($1)', [login])).rows[0],
  exists: async (email, username) =>
    (await query('SELECT 1 FROM users WHERE LOWER(email)=LOWER($1) OR LOWER(username)=LOWER($2)', [email, username])).rowCount > 0,
  create: async (d) =>
    (await query(
      `INSERT INTO users (username,email,password_hash,first_name,last_name,role,verification_token,email_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${PUBLIC}`,
      [d.username, d.email, d.password_hash, d.first_name || null, d.last_name || null,
        d.role || 'subscriber', d.verification_token || null, d.email_verified || false]
    )).rows[0],
  update: async (id, fields) => {
    const allowed = ['username', 'email', 'first_name', 'last_name', 'bio', 'avatar', 'role', 'is_active'];
    const keys = Object.keys(fields).filter((k) => allowed.includes(k) && fields[k] !== undefined);
    if (!keys.length) return User.findById(id).then((u) => u && User.sanitize(u));
    const sets = keys.map((k, i) => `${k}=$${i + 2}`).join(', ');
    const { rows } = await query(`UPDATE users SET ${sets} WHERE user_id=$1 RETURNING ${PUBLIC}`, [id, ...keys.map((k) => fields[k])]);
    return rows[0];
  },
  setPassword: (id, hash) => query('UPDATE users SET password_hash=$2 WHERE user_id=$1', [id, hash]),
  touchLogin: (id) => query('UPDATE users SET last_login=NOW() WHERE user_id=$1', [id]),
  verifyEmail: async (token) =>
    (await query(
      `UPDATE users SET email_verified=true, verification_token=NULL
       WHERE verification_token=$1 RETURNING ${PUBLIC}`, [token])).rows[0],
  remove: async (id) => (await query('DELETE FROM users WHERE user_id=$1', [id])).rowCount > 0,
  list: async ({ role, q, is_active }, { limit, offset }) => {
    const where = []; const params = [];
    if (role) { params.push(role); where.push(`role=$${params.length}`); }
    if (is_active !== undefined) { params.push(is_active === 'true' || is_active === true); where.push(`is_active=$${params.length}`); }
    if (q) { params.push(`%${q}%`); where.push(`(username ILIKE $${params.length} OR email ILIKE $${params.length})`); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = parseInt((await query(`SELECT COUNT(*) FROM users ${w}`, params)).rows[0].count, 10);
    const rows = (await query(
      `SELECT ${PUBLIC} FROM users ${w} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset])).rows;
    return { rows, total };
  },
  sanitize: (u) => {
    if (!u) return u;
    const { password_hash, verification_token, ...safe } = u;
    return safe;
  },
};

module.exports = User;
