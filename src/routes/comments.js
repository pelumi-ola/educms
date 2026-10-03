const router = require('express').Router();
const c = require('../controllers/commentController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validation');

router.get('/', authenticate, authorize('admin', 'editor'), rules.pagination, validate, c.list);
router.patch('/:id/status', authenticate, authorize('admin', 'editor'), rules.commentStatus, validate, c.setStatus);
router.delete('/:id', authenticate, rules.id(), validate, c.remove);

module.exports = router;
