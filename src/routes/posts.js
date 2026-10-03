const router = require('express').Router();
const c = require('../controllers/postController');
const comments = require('../controllers/commentController');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validation');

const writer = authorize('admin', 'editor', 'author');

router.get('/', optionalAuth, rules.pagination, validate, c.list);
router.post('/', authenticate, writer, rules.post, validate, c.create);
router.get('/:id', optionalAuth, c.get);
router.put('/:id', authenticate, writer, rules.postUpdate, validate, c.update);
router.delete('/:id', authenticate, writer, rules.id(), validate, c.remove);
router.post('/:id/like', rules.id(), validate, c.like);

router.get('/:id/versions', authenticate, writer, rules.id(), validate, c.versions);
router.post('/:id/versions/:versionId/restore', authenticate, writer, rules.id(), rules.id('versionId'), validate, c.restoreVersion);

router.get('/:id/comments', rules.id(), validate, comments.forPost);
router.post('/:id/comments', authenticate, rules.id(), rules.comment, validate, comments.create);

module.exports = router;
