const router = require('express').Router();
const c = require('../controllers/mediaController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validation');
const { upload } = require('../middleware/upload');

router.use(authenticate, authorize('admin', 'editor', 'author'));
router.post('/', upload.single('file'), c.upload);
router.get('/', rules.pagination, validate, c.list);
router.get('/:id', rules.id(), validate, c.get);
router.patch('/:id', rules.mediaUpdate, validate, c.update);
router.delete('/:id', rules.id(), validate, c.remove);

module.exports = router;
