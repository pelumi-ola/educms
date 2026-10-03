const router = require('express').Router();
const c = require('../controllers/categoryController');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validation');

const staff = authorize('admin', 'editor');
router.get('/', optionalAuth, c.list);
router.get('/:id', rules.id(), validate, c.get);
router.post('/', authenticate, staff, rules.category, validate, c.create);
router.put('/:id', authenticate, staff, rules.id(), validate, c.update);
router.delete('/:id', authenticate, staff, rules.id(), validate, c.remove);

module.exports = router;
