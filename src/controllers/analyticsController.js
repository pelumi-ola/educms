const { query } = require('../config/database');
const { successResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');
const { remember } = require('../services/cacheService');

exports.overview = asyncHandler(async (req, res) => {
  const data = await remember('analytics:overview', 60, async () => {
    const [users, posts, comments, views, top, daily, activity] = await Promise.all([
      query('SELECT role, COUNT(*)::int AS count FROM users GROUP BY role'),
      query('SELECT status, COUNT(*)::int AS count FROM posts GROUP BY status'),
      query('SELECT status, COUNT(*)::int AS count FROM comments GROUP BY status'),
      query('SELECT COALESCE(SUM(view_count),0)::int AS views, COALESCE(SUM(like_count),0)::int AS likes FROM posts'),
      query(`SELECT post_id, title, slug, view_count, like_count FROM posts
             WHERE status='published' ORDER BY view_count DESC LIMIT 5`),
      query(`SELECT to_char(d::date,'YYYY-MM-DD') AS day, COUNT(p.post_id)::int AS posts
             FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE, '1 day') d
             LEFT JOIN posts p ON p.created_at::date = d::date GROUP BY d ORDER BY d`),
      query(`SELECT a.action, a.entity_type, a.entity_id, a.created_at, u.username
             FROM activity_log a LEFT JOIN users u ON u.user_id=a.user_id ORDER BY a.created_at DESC LIMIT 10`),
    ]);
    const toMap = (rows, k) => Object.fromEntries(rows.map((r) => [r[k], r.count]));
    return {
      users_by_role: toMap(users.rows, 'role'),
      posts_by_status: toMap(posts.rows, 'status'),
      comments_by_status: toMap(comments.rows, 'status'),
      total_views: views.rows[0].views,
      total_likes: views.rows[0].likes,
      top_posts: top.rows,
      posts_last_30_days: daily.rows,
      recent_activity: activity.rows,
    };
  });
  res.json(successResponse(data));
});
