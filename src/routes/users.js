const router = require('express').Router();
const c = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validation');

router.use(authenticate, authorize('admin'));
router.get('/', rules.pagination, validate, c.list);
router.post('/', rules.adminCreateUser, validate, c.create);
router.get('/:id', rules.id(), validate, c.get);
router.put('/:id', rules.adminUpdateUser, validate, c.update);
router.delete('/:id', rules.id(), validate, c.remove);

module.exports = router;
