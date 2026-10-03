const router = require('express').Router();
const c = require('../controllers/tagController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validation');

const staff = authorize('admin', 'editor');
router.get('/', c.list);
router.post('/', authenticate, staff, rules.tag, validate, c.create);
router.put('/:id', authenticate, staff, rules.id(), validate, c.update);
router.delete('/:id', authenticate, staff, rules.id(), validate, c.remove);

module.exports = router;
