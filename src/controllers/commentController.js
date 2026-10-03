const Comment = require('../models/Comment');
const Post = require('../models/Post');
const { paginate, getPaginationMeta, successResponse } = require('../utils/helpers');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');
const { isStaff } = require('../middleware/auth');
const { logActivity } = require('../services/activityService');

exports.forPost = asyncHandler(async (req, res) => {
  const post = await Post.find(req.params.id);
  if (!post || post.status !== 'published') throw new ApiError(404, 'Post not found');
  res.json(successResponse(await Comment.forPost(post.post_id)));
});

exports.create = asyncHandler(async (req, res) => {
  const post = await Post.find(req.params.id);
  if (!post || post.status !== 'published') throw new ApiError(404, 'Post not found');
  if (!post.allow_comments) throw new ApiError(403, 'Comments are disabled for this post');
  if (req.body.parent_id) {
    const parent = await Comment.findById(req.body.parent_id);
    if (!parent || parent.post_id !== post.post_id) throw new ApiError(400, 'Invalid parent comment');
  }
  const comment = await Comment.create({
    post_id: post.post_id, user_id: req.user.user_id, parent_id: req.body.parent_id, content: req.body.content,
    status: isStaff(req.user) ? 'approved' : 'pending', ip: req.ip, user_agent: req.get('user-agent'),
  });
  res.status(201).json(successResponse(comment,
    comment.status === 'pending' ? 'Comment submitted and awaiting moderation' : 'Comment posted'));
});

exports.list = asyncHandler(async (req, res) => {
  const p = paginate(req.query.page, req.query.limit);
  const { rows, total } = await Comment.list(req.query, p);
  res.json(successResponse({ comments: rows, pagination: getPaginationMeta(total, p.page, p.limit) }));
});

exports.setStatus = asyncHandler(async (req, res) => {
  const c = await Comment.setStatus(req.params.id, req.body.status);
  if (!c) throw new ApiError(404, 'Comment not found');
  logActivity(req, 'comment.moderate', 'comment', c.comment_id, req.body.status);
  res.json(successResponse(c, 'Comment updated'));
});

exports.remove = asyncHandler(async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) throw new ApiError(404, 'Comment not found');
  if (!isStaff(req.user) && c.user_id !== req.user.user_id) throw new ApiError(403, 'Not allowed');
  await Comment.remove(c.comment_id);
  res.json(successResponse(null, 'Comment deleted'));
});
