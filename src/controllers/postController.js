const Post = require('../models/Post');
const { paginate, getPaginationMeta, successResponse } = require('../utils/helpers');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');
const { isStaff } = require('../middleware/auth');
const { logActivity } = require('../services/activityService');
const { invalidate } = require('../services/cacheService');

const canSee = (post, user) =>
  post.status === 'published' || isStaff(user) || (user && post.author_id === user.user_id);
const canEdit = (post, user) => isStaff(user) || post.author_id === user.user_id;

// Authors may write drafts but only editors/admins can publish, archive or feature.
const restrict = (body, user) => {
  const data = { ...body };
  if (!isStaff(user)) { delete data.is_featured; if (data.status && data.status !== 'draft') data.status = 'draft'; }
  return data;
};

const load = async (id) => {
  const post = await Post.find(id);
  if (!post) throw new ApiError(404, 'Post not found');
  return post;
};

exports.list = asyncHandler(async (req, res) => {
  const p = paginate(req.query.page, req.query.limit);
  const { rows, total } = await Post.list(req.query, req.user, p);
  res.json(successResponse({ posts: rows, pagination: getPaginationMeta(total, p.page, p.limit) }));
});

exports.get = asyncHandler(async (req, res) => {
  const post = await load(req.params.id);
  if (!canSee(post, req.user)) throw new ApiError(404, 'Post not found');
  if (post.status === 'published' && req.user?.user_id !== post.author_id) Post.incrementViews(post.post_id).catch(() => {});
  res.json(successResponse(post));
});

exports.create = asyncHandler(async (req, res) => {
  const post = await Post.create(restrict(req.body, req.user), req.user.user_id);
  logActivity(req, 'post.create', 'post', post.post_id, post.title);
  invalidate('categories:*');
  res.status(201).json(successResponse(post, 'Post created'));
});

exports.update = asyncHandler(async (req, res) => {
  const existing = await load(req.params.id);
  if (!canEdit(existing, req.user)) throw new ApiError(403, 'You can only edit your own posts');
  const post = await Post.update(existing.post_id, restrict(req.body, req.user), req.user.user_id, req.body.change_note);
  logActivity(req, 'post.update', 'post', post.post_id, post.title);
  invalidate('categories:*');
  res.json(successResponse(post, 'Post updated'));
});

exports.remove = asyncHandler(async (req, res) => {
  const existing = await load(req.params.id);
  if (!canEdit(existing, req.user)) throw new ApiError(403, 'You can only delete your own posts');
  await Post.remove(existing.post_id);
  logActivity(req, 'post.delete', 'post', existing.post_id, existing.title);
  invalidate('categories:*');
  res.json(successResponse(null, 'Post deleted'));
});

exports.like = asyncHandler(async (req, res) => {
  const post = await load(req.params.id);
  if (post.status !== 'published') throw new ApiError(404, 'Post not found');
  res.json(successResponse(await Post.like(post.post_id)));
});

exports.versions = asyncHandler(async (req, res) => {
  const post = await load(req.params.id);
  if (!canEdit(post, req.user)) throw new ApiError(403, 'Not allowed');
  res.json(successResponse(await Post.versions(post.post_id)));
});

exports.restoreVersion = asyncHandler(async (req, res) => {
  const post = await load(req.params.id);
  if (!canEdit(post, req.user)) throw new ApiError(403, 'Not allowed');
  const v = await Post.version(post.post_id, req.params.versionId);
  if (!v) throw new ApiError(404, 'Version not found');
  const restored = await Post.update(post.post_id, { title: v.title, content: v.content, excerpt: v.excerpt },
    req.user.user_id, `Restored version ${v.version_number}`);
  logActivity(req, 'post.restore', 'post', post.post_id, `version ${v.version_number}`);
  res.json(successResponse(restored, `Restored version ${v.version_number}`));
});
